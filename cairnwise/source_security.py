"""Security policy and bounded HTTP collection for external source intake.

The collector in this module is deliberately small and conservative.  It is a
metadata fetcher, not a crawler: it performs one bounded GET at a time, never
forwards caller credentials, validates every redirect target, and treats the
response as untrusted bytes.  Parsing and connector-specific normalization are
kept outside the transport boundary.
"""

from __future__ import annotations

import ipaddress
import socket
from dataclasses import dataclass, field
from typing import Any, Callable, Iterable
from urllib.parse import urljoin, urlsplit, urlunsplit

import httpx


DEFAULT_TIMEOUT_SECONDS = 5.0
DEFAULT_MAX_REDIRECTS = 3
DEFAULT_MAX_RESPONSE_BYTES = 1_048_576
DEFAULT_MAX_DNS_ADDRESSES = 8
DEFAULT_ALLOWED_CONTENT_TYPES = frozenset(
    {
        "application/json",
        "application/ld+json",
        "text/html",
        "text/plain",
    }
)


class SourceSecurityError(ValueError):
    """A URL or response failed a source collection policy."""

    def __init__(self, code: str, detail: str):
        super().__init__(detail)
        self.code = code
        self.detail = detail


@dataclass(frozen=True)
class FetchLimits:
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS
    max_redirects: int = DEFAULT_MAX_REDIRECTS
    max_response_bytes: int = DEFAULT_MAX_RESPONSE_BYTES
    max_dns_addresses: int = DEFAULT_MAX_DNS_ADDRESSES
    allowed_content_types: frozenset[str] = DEFAULT_ALLOWED_CONTENT_TYPES


@dataclass(frozen=True)
class ValidatedURL:
    original: str
    canonical: str
    scheme: str
    hostname: str
    port: int


@dataclass
class FetchResult:
    """Bounded response data suitable for metadata parsing.

    ``body`` is retained only for the caller's immediate parsing operation.  A
    service may choose to persist normalized metadata and a content hash, but
    this transport never executes or interprets response content.
    """

    requested_url: str
    final_url: str
    status_code: int | None
    content_type: str | None
    body: bytes = b""
    availability: str = "available"
    source_status: str = "completed"
    error_code: str | None = None
    error_message: str | None = None
    redirect_chain: list[str] = field(default_factory=list)
    response_headers: dict[str, str] = field(default_factory=dict)

    @property
    def available(self) -> bool:
        return self.availability == "available" and self.source_status == "completed"


def _host_is_blocked(hostname: str) -> bool:
    host = hostname.rstrip(".").casefold()
    if not host:
        return True
    if host == "localhost" or host.endswith(".localhost"):
        return True
    # Common cloud metadata aliases are blocked before DNS is consulted.
    if host in {
        "metadata",
        "metadata.google.internal",
        "metadata.google",
        "instance-data.ec2.internal",
        "metadata.azure.internal",
    }:
        return True
    if host.endswith(".local") or host.endswith(".internal"):
        return True
    return False


def is_forbidden_ip(value: str | ipaddress._BaseAddress) -> bool:
    """Return whether an address must not be used as an egress target."""

    try:
        address = value if not isinstance(value, str) else ipaddress.ip_address(value)
    except ValueError:
        return True
    # ``is_private`` covers RFC1918 and IPv6 ULA.  ``is_global`` additionally
    # excludes shared, documentation, reserved, multicast and unspecified
    # ranges that are not safe egress destinations for this collector.
    mapped = getattr(address, "ipv4_mapped", None)
    if mapped is not None:
        address = mapped
    return bool(
        address.is_private
        or address.is_loopback
        or address.is_link_local
        or address.is_reserved
        or address.is_multicast
        or address.is_unspecified
        or not address.is_global
    )


def canonicalize_url(value: str, *, max_length: int = 2048) -> ValidatedURL:
    """Validate and canonicalize a user-supplied HTTP(S) URL.

    DNS is intentionally not resolved by this syntax-level function.  The
    bounded collector calls :func:`resolve_public_host` immediately before
    every request, including every redirect target.
    """

    if not isinstance(value, str):
        raise SourceSecurityError("invalid_url", "URL must be a string")
    raw = value.strip()
    if not raw or len(raw) > max_length:
        raise SourceSecurityError("invalid_url", f"URL must be between 1 and {max_length} characters")
    if any(ord(character) < 0x20 for character in raw):
        raise SourceSecurityError("invalid_url", "URL contains control characters")
    parsed = urlsplit(raw)
    scheme = parsed.scheme.casefold()
    if scheme not in {"http", "https"}:
        raise SourceSecurityError("unsupported_scheme", "URL must use http or https")
    if not parsed.netloc:
        raise SourceSecurityError("invalid_url", "URL must include a host")
    if parsed.username is not None or parsed.password is not None or "@" in parsed.netloc:
        raise SourceSecurityError("credentials_not_allowed", "URL credentials are not supported")
    try:
        hostname = parsed.hostname or ""
        port = parsed.port
    except ValueError as error:
        raise SourceSecurityError("invalid_port", "URL port is invalid") from error
    hostname = hostname.rstrip(".").casefold()
    if not hostname or _host_is_blocked(hostname):
        raise SourceSecurityError("blocked_host", "Local, internal, or metadata hosts are not allowed")
    try:
        literal = ipaddress.ip_address(hostname)
    except ValueError:
        literal = None
    if literal is not None and is_forbidden_ip(literal):
        raise SourceSecurityError("blocked_ip", "Private, link-local, loopback, or metadata IPs are not allowed")

    if port is None:
        port = 443 if scheme == "https" else 80
    host_for_url = hostname
    if ":" in host_for_url and not host_for_url.startswith("["):
        host_for_url = f"[{host_for_url}]"
    if not ((scheme == "http" and port == 80) or (scheme == "https" and port == 443)):
        host_for_url = f"{host_for_url}:{port}"

    path = parsed.path or "/"
    # Keep percent-encoded octets intact while removing only repeated slashes
    # and dot segments that make dedupe/redirect policy ambiguous.
    while "//" in path:
        path = path.replace("//", "/")
    segments: list[str] = []
    for segment in path.split("/"):
        if segment in {"", "."}:
            continue
        if segment == "..":
            if segments:
                segments.pop()
            continue
        segments.append(segment)
    normalized_path = "/" + "/".join(segments)
    if not normalized_path:
        normalized_path = "/"
    canonical = urlunsplit((scheme, host_for_url, normalized_path, parsed.query, ""))
    return ValidatedURL(
        original=raw,
        canonical=canonical,
        scheme=scheme,
        hostname=hostname,
        port=port,
    )


def resolve_public_host(
    hostname: str,
    port: int,
    *,
    max_addresses: int = DEFAULT_MAX_DNS_ADDRESSES,
    resolver: Callable[..., list[tuple[Any, ...]]] | None = None,
) -> tuple[str, ...]:
    """Resolve a hostname with a bounded result set and reject unsafe answers."""

    try:
        literal = ipaddress.ip_address(hostname)
    except ValueError:
        literal = None
    if literal is not None:
        if is_forbidden_ip(literal):
            raise SourceSecurityError("blocked_ip", "Private, link-local, loopback, or metadata IPs are not allowed")
        return (str(literal),)

    if _host_is_blocked(hostname):
        raise SourceSecurityError("blocked_host", "Local, internal, or metadata hosts are not allowed")
    getaddrinfo = resolver or socket.getaddrinfo
    try:
        records = getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
    except (OSError, socket.gaierror) as error:
        raise SourceSecurityError("dns_resolution_failed", "The source host could not be resolved") from error
    addresses: list[str] = []
    for record in records:
        if len(record) < 5:
            continue
        sockaddr = record[4]
        if not sockaddr:
            continue
        address = str(sockaddr[0])
        if address not in addresses:
            addresses.append(address)
        if len(addresses) > max(0, max_addresses):
            raise SourceSecurityError("dns_result_limit", "The source host returned too many addresses")
    if not addresses:
        raise SourceSecurityError("dns_resolution_failed", "The source host returned no addresses")
    unsafe = next((address for address in addresses if is_forbidden_ip(address)), None)
    if unsafe:
        raise SourceSecurityError("blocked_ip", "DNS resolved to a private, link-local, or metadata IP")
    return tuple(addresses)


def _content_type(value: str | None) -> str:
    if not value:
        return ""
    return value.split(";", 1)[0].strip().casefold()


class BoundedHTTPFetcher:
    """Perform a bounded, credential-free metadata GET.

    ``transport`` is injectable so tests can use ``httpx.MockTransport`` and
    never contact an arbitrary network target.
    """

    def __init__(
        self,
        *,
        limits: FetchLimits | None = None,
        transport: httpx.BaseTransport | None = None,
        resolver: Callable[..., list[tuple[Any, ...]]] | None = None,
        client_factory: Callable[..., httpx.Client] | None = None,
    ):
        self.limits = limits or FetchLimits()
        self.transport = transport
        self.resolver = resolver
        self.client_factory = client_factory or httpx.Client

    def _client(self) -> httpx.Client:
        kwargs: dict[str, Any] = {
            "timeout": httpx.Timeout(self.limits.timeout_seconds),
            "follow_redirects": False,
            "trust_env": False,
            # The collector must not carry browser cookies, caller bearer
            # tokens, or proxy credentials into a source request.
            "headers": {
                "Accept": "application/json, application/ld+json, text/html, text/plain;q=0.8",
                "Accept-Encoding": "identity",
                "User-Agent": "Cairnwise-source-collector/1.0",
            },
        }
        if self.transport is not None:
            kwargs["transport"] = self.transport
        return self.client_factory(**kwargs)

    def fetch(self, value: str) -> FetchResult:
        try:
            requested = canonicalize_url(value)
        except SourceSecurityError:
            raise
        current = requested.canonical
        redirect_chain: list[str] = []

        try:
            with self._client() as client:
                for redirect_index in range(self.limits.max_redirects + 1):
                    target = canonicalize_url(current)
                    # Resolve before every request.  This catches unsafe DNS
                    # answers and prevents an otherwise safe redirect from
                    # reaching an internal address.
                    resolve_public_host(
                        target.hostname,
                        target.port,
                        max_addresses=self.limits.max_dns_addresses,
                        resolver=self.resolver,
                    )
                    with client.stream("GET", target.canonical) as response:
                        status_code = response.status_code
                        headers = {
                            key.casefold(): value
                            for key, value in response.headers.items()
                            if key.casefold() in {"content-type", "content-length", "location", "etag", "last-modified", "date"}
                        }
                        if status_code in {301, 302, 303, 307, 308}:
                            location = response.headers.get("location")
                            if not location:
                                return FetchResult(
                                    requested_url=requested.canonical,
                                    final_url=target.canonical,
                                    status_code=status_code,
                                    content_type=None,
                                    availability="unavailable",
                                    source_status="failed",
                                    error_code="redirect_without_location",
                                    error_message="The source returned a redirect without a location.",
                                    redirect_chain=redirect_chain,
                                    response_headers=headers,
                                )
                            if redirect_index >= self.limits.max_redirects:
                                return FetchResult(
                                    requested_url=requested.canonical,
                                    final_url=target.canonical,
                                    status_code=status_code,
                                    content_type=None,
                                    availability="unavailable",
                                    source_status="failed",
                                    error_code="redirect_limit",
                                    error_message="The source exceeded the redirect limit.",
                                    redirect_chain=redirect_chain,
                                    response_headers=headers,
                                )
                            next_url = urljoin(target.canonical, location)
                            next_target = canonicalize_url(next_url)
                            redirect_chain.append(next_target.canonical)
                            current = next_target.canonical
                            continue

                        media_type = _content_type(response.headers.get("content-type"))
                        allowed = media_type in self.limits.allowed_content_types or media_type.endswith("+json")
                        if not allowed:
                            return FetchResult(
                                requested_url=requested.canonical,
                                final_url=target.canonical,
                                status_code=status_code,
                                content_type=media_type or None,
                                availability="unsupported",
                                source_status="completed",
                                error_code="unsupported_content_type",
                                error_message="The source content type is not permitted for metadata intake.",
                                redirect_chain=redirect_chain,
                                response_headers=headers,
                            )
                        declared_length = response.headers.get("content-length")
                        if declared_length:
                            try:
                                if int(declared_length) > self.limits.max_response_bytes:
                                    return FetchResult(
                                        requested_url=requested.canonical,
                                        final_url=target.canonical,
                                        status_code=status_code,
                                        content_type=media_type,
                                        availability="unavailable",
                                        source_status="failed",
                                        error_code="response_too_large",
                                        error_message="The source response exceeds the configured size limit.",
                                        redirect_chain=redirect_chain,
                                        response_headers=headers,
                                    )
                            except ValueError:
                                return FetchResult(
                                    requested_url=requested.canonical,
                                    final_url=target.canonical,
                                    status_code=status_code,
                                    content_type=media_type,
                                    availability="unavailable",
                                    source_status="failed",
                                    error_code="invalid_content_length",
                                    error_message="The source returned an invalid content length.",
                                    redirect_chain=redirect_chain,
                                    response_headers=headers,
                                )

                        body = bytearray()
                        for chunk in response.iter_bytes():
                            body.extend(chunk)
                            if len(body) > self.limits.max_response_bytes:
                                return FetchResult(
                                    requested_url=requested.canonical,
                                    final_url=target.canonical,
                                    status_code=status_code,
                                    content_type=media_type,
                                    availability="unavailable",
                                    source_status="failed",
                                    error_code="response_too_large",
                                    error_message="The source response exceeds the configured size limit.",
                                    redirect_chain=redirect_chain,
                                    response_headers=headers,
                                )
                        if not 200 <= status_code < 300:
                            return FetchResult(
                                requested_url=requested.canonical,
                                final_url=target.canonical,
                                status_code=status_code,
                                content_type=media_type,
                                body=bytes(body),
                                availability="unavailable",
                                source_status="failed",
                                error_code=f"http_{status_code}",
                                error_message="The source did not return a successful response.",
                                redirect_chain=redirect_chain,
                                response_headers=headers,
                            )
                        return FetchResult(
                            requested_url=requested.canonical,
                            final_url=target.canonical,
                            status_code=status_code,
                            content_type=media_type,
                            body=bytes(body),
                            availability="available",
                            source_status="completed",
                            redirect_chain=redirect_chain,
                            response_headers=headers,
                        )
        except SourceSecurityError:
            raise
        except httpx.TimeoutException as error:
            return FetchResult(
                requested_url=requested.canonical,
                final_url=current,
                status_code=None,
                content_type=None,
                availability="unavailable",
                source_status="timeout",
                error_code="timeout",
                error_message="The source request exceeded the timeout.",
                redirect_chain=redirect_chain,
            )
        except httpx.HTTPError as error:
            return FetchResult(
                requested_url=requested.canonical,
                final_url=current,
                status_code=None,
                content_type=None,
                availability="unavailable",
                source_status="failed",
                error_code="http_error",
                error_message="The source request failed before metadata was collected.",
                redirect_chain=redirect_chain,
            )
        except OSError:
            return FetchResult(
                requested_url=requested.canonical,
                final_url=current,
                status_code=None,
                content_type=None,
                availability="unavailable",
                source_status="failed",
                error_code="network_error",
                error_message="The source request failed before metadata was collected.",
                redirect_chain=redirect_chain,
            )


# Compatibility aliases make the policy boundary easy to use from callers and
# tests without exposing the underlying httpx client as part of the contract.
validate_url = canonicalize_url
SafeURLFetcher = BoundedHTTPFetcher


__all__ = [
    "BoundedHTTPFetcher",
    "DEFAULT_ALLOWED_CONTENT_TYPES",
    "DEFAULT_MAX_DNS_ADDRESSES",
    "DEFAULT_MAX_REDIRECTS",
    "DEFAULT_MAX_RESPONSE_BYTES",
    "DEFAULT_TIMEOUT_SECONDS",
    "FetchLimits",
    "FetchResult",
    "SafeURLFetcher",
    "SourceSecurityError",
    "ValidatedURL",
    "canonicalize_url",
    "is_forbidden_ip",
    "resolve_public_host",
    "validate_url",
]
