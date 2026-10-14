"""Permitted source connector contracts.

The adapters here are intentionally source-specific and metadata-only.  They
do not scrape pages, bypass access controls, fetch images, or infer a risk
verdict.  Each adapter is disabled until an operator explicitly enables it via
an environment variable or an explicit source-rights manifest.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any, Mapping
from urllib.parse import urlencode

import httpx

from .source_security import BoundedHTTPFetcher, FetchLimits, SourceSecurityError


BLUESKY_CONNECTOR_KEY = "social.bluesky.actor_search.v1"
APPLE_CONNECTOR_KEY = "app.apple.itunes_search_lookup.v1"
USER_SUBMITTED_SOCIAL_KEY = "intake.user_submitted.social.v1"
USER_SUBMITTED_APP_KEY = "intake.user_submitted.app.v1"


def _rights(
    *,
    permissions: str,
    terms: str,
    retention_class: str,
    image_rights: str,
    owner: str,
) -> dict[str, Any]:
    return {
        "permissions": permissions,
        "terms_basis": terms,
        "retention_class": retention_class,
        "image_rights": image_rights,
        "owner": owner,
        "enabled_by_default": False,
        "review_status": "pending_explicit_enablement",
    }


CONNECTOR_MANIFESTS: dict[str, dict[str, Any]] = {
    BLUESKY_CONNECTOR_KEY: {
        "connector_key": BLUESKY_CONNECTOR_KEY,
        "connector_id": BLUESKY_CONNECTOR_KEY,
        "source": "Bluesky public API",
        "asset_type": "social_profile",
        "platform": "bluesky",
        "operations": ["search_profiles", "get_profile"],
        "fields": ["stable_did", "handle", "display_name", "avatar_url", "description", "indexed_at"],
        "auth": "not_required_for_declared_public_queries",
        "endpoint": "https://public.api.bsky.app/xrpc/app.bsky.actor.searchActorsTypeahead",
        "freshness_ceiling": "source-dependent",
        "limits": [
            "source-controlled search semantics and ranking",
            "public actor metadata only",
            "no posts, private data, or authenticated operations",
        ],
        "failure_states": ["timeout", "rate_limited", "unavailable", "schema_changed", "unsupported"],
        "rights": _rights(
            permissions="public API actor metadata; final terms review required",
            terms="Bluesky public API documentation and applicable service terms",
            retention_class="metadata_180d",
            image_rights="avatar URL reference only; image bytes are not retained",
            owner="source-governance",
        ),
    },
    APPLE_CONNECTOR_KEY: {
        "connector_key": APPLE_CONNECTOR_KEY,
        "connector_id": APPLE_CONNECTOR_KEY,
        "source": "Apple iTunes Search/Lookup API",
        "asset_type": "mobile_app",
        "store": "apple_app_store",
        "operations": ["search_listings", "get_listing"],
        "fields": [
            "store_id",
            "title",
            "icon_url",
            "bundle_id",
            "publisher",
            "description",
            "support_url",
            "version",
            "release_date",
            "listing_url",
        ],
        "auth": "public API query; no publisher credentials",
        "endpoint": "https://itunes.apple.com/search or https://itunes.apple.com/lookup",
        "freshness_ceiling": "source-dependent",
        "limits": [
            "Apple API response fields are source-controlled",
            "metadata retrieval is separate from image retention rights",
            "no App Store authentication or publishing operations",
        ],
        "failure_states": ["timeout", "rate_limited", "unavailable", "schema_changed", "unsupported"],
        "rights": _rights(
            permissions="public iTunes Search/Lookup metadata endpoint",
            terms="Apple iTunes Search API terms and applicable App Store terms",
            retention_class="metadata_180d",
            image_rights="artwork URL reference only; image bytes are not retained",
            owner="source-governance",
        ),
    },
}

# These are always available as an intake contract.  They do not make an
# external request; a user explicitly supplies the listing reference and any
# metadata the workspace is permitted to retain.
USER_SUBMITTED_MANIFESTS: dict[str, dict[str, Any]] = {
    USER_SUBMITTED_SOCIAL_KEY: {
        "connector_key": USER_SUBMITTED_SOCIAL_KEY,
        "connector_id": USER_SUBMITTED_SOCIAL_KEY,
        "source": "Cairnwise user-submitted social reference",
        "asset_type": "social_profile",
        "operations": ["intake_metadata"],
        "fields": ["canonical_url", "stable_id", "handle", "display_name", "description", "metadata"],
        "auth": "user_submitted_reference",
        "rights": _rights(
            permissions="workspace user submitted the reference; no external access assertion",
            terms="customer-provided source reference; analyst validates applicable platform terms",
            retention_class="metadata_180d",
            image_rights="image URL reference only; image bytes are not retained",
            owner="workspace-owner",
        ),
        "enabled": True,
    },
    USER_SUBMITTED_APP_KEY: {
        "connector_key": USER_SUBMITTED_APP_KEY,
        "connector_id": USER_SUBMITTED_APP_KEY,
        "source": "Cairnwise user-submitted app listing reference",
        "asset_type": "mobile_app",
        "operations": ["intake_metadata"],
        "fields": ["canonical_url", "store_id", "title", "bundle_id", "publisher", "description", "metadata"],
        "auth": "user_submitted_reference",
        "rights": _rights(
            permissions="workspace user submitted the listing reference; no external access assertion",
            terms="customer-provided source reference; analyst validates applicable store terms",
            retention_class="metadata_180d",
            image_rights="artwork URL reference only; image bytes are not retained",
            owner="workspace-owner",
        ),
        "enabled": True,
    },
}


@dataclass
class ConnectorResult:
    connector_key: str
    operation: str
    source_mode: str = "permitted_connector"
    availability: str = "available"
    source_status: str = "completed"
    records: list[dict[str, Any]] = field(default_factory=list)
    status_code: int | None = None
    response_meta: dict[str, Any] = field(default_factory=dict)
    error_code: str | None = None
    error_message: str | None = None

    @property
    def available(self) -> bool:
        return self.availability == "available" and self.source_status == "completed"


class ConnectorError(RuntimeError):
    def __init__(self, code: str, detail: str, *, availability: str = "unavailable"):
        super().__init__(detail)
        self.code = code
        self.detail = detail
        self.availability = availability


class ConnectorDisabledError(ConnectorError):
    def __init__(self, connector_key: str):
        super().__init__("connector_disabled", f"Connector {connector_key} is not explicitly enabled.", availability="unavailable")


def _parse_rights_manifest(value: str | os.PathLike[str] | Mapping[str, Any] | None) -> dict[str, dict[str, Any]]:
    if value is None:
        return {}
    if isinstance(value, Mapping):
        loaded: Any = value
    else:
        try:
            raw = str(value)
            if os.path.isfile(raw):
                with open(raw, "r", encoding="utf-8") as handle:
                    loaded = json.load(handle)
            else:
                loaded = json.loads(raw)
        except (OSError, TypeError, ValueError, json.JSONDecodeError) as error:
            raise ValueError("CAIRNWISE_SOURCE_RIGHTS_MANIFEST must be a JSON object or readable JSON file") from error
    if isinstance(loaded, list):
        return {
            str(item.get("connector_key")): dict(item)
            for item in loaded
            if isinstance(item, Mapping) and item.get("connector_key")
        }
    if not isinstance(loaded, Mapping):
        raise ValueError("source rights manifest must be a JSON object or list")
    result: dict[str, dict[str, Any]] = {}
    for key, item in loaded.items():
        if isinstance(item, Mapping):
            result[str(key)] = dict(item)
    return result


def _enabled_from_environment(connector_key: str, environ: Mapping[str, str]) -> bool:
    configured = environ.get("CAIRNWISE_ENABLED_CONNECTORS", "")
    enabled_keys = {item.strip() for item in configured.split(",") if item.strip()}
    if connector_key in enabled_keys:
        return True
    slug = connector_key.upper().replace(".", "_").replace("-", "_")
    for name in (f"CAIRNWISE_ENABLE_{slug}", f"CAIRNWISE_{slug}_ENABLED"):
        if environ.get(name, "").strip().casefold() in {"1", "true", "yes", "on", "enabled"}:
            return True
    return False


def _merged_manifest(base: Mapping[str, Any], rights_override: Mapping[str, Any] | None, enabled: bool) -> dict[str, Any]:
    manifest = dict(base)
    base_rights = dict(base.get("rights") or {})
    override = dict(rights_override or {})
    # An explicit rights manifest may supply the complete metadata envelope or
    # only approved values.  It cannot remove required fields.
    if "rights" in override and isinstance(override["rights"], Mapping):
        base_rights.update(dict(override.pop("rights")))
    base_rights.update({key: value for key, value in override.items() if key in {
        "permissions", "terms_basis", "terms_reviewed_at", "retention_class", "image_rights", "owner", "review_status"
    }})
    manifest["rights"] = base_rights
    manifest["enabled"] = bool(enabled or override.get("enabled") is True)
    manifest["source_rights_status"] = "enabled" if manifest["enabled"] else "disabled"
    # Keep rights fields top-level too so simple SQL/API consumers do not need
    # to understand a nested manifest to display governance state.
    manifest["permissions"] = base_rights.get("permissions")
    manifest["terms_basis"] = base_rights.get("terms_basis")
    manifest["retention_class"] = base_rights.get("retention_class", "metadata_180d")
    manifest["image_rights"] = base_rights.get("image_rights")
    manifest["owner"] = base_rights.get("owner")
    return manifest


class ConnectorRegistry:
    """Manifest registry and adapter factory for permitted connectors."""

    def __init__(
        self,
        *,
        environ: Mapping[str, str] | None = None,
        rights_manifest: str | os.PathLike[str] | Mapping[str, Any] | None = None,
        transport: httpx.BaseTransport | None = None,
        fetch_limits: FetchLimits | None = None,
    ):
        self.environ = environ or os.environ
        rights_value = rights_manifest if rights_manifest is not None else self.environ.get("CAIRNWISE_SOURCE_RIGHTS_MANIFEST")
        self.rights_manifest = _parse_rights_manifest(rights_value)
        self.transport = transport
        self.fetch_limits = fetch_limits

    def manifests(self) -> dict[str, dict[str, Any]]:
        external = {
            key: _merged_manifest(
                manifest,
                self.rights_manifest.get(key),
                _enabled_from_environment(key, self.environ),
            )
            for key, manifest in CONNECTOR_MANIFESTS.items()
        }
        return {**external, **{key: dict(value) for key, value in USER_SUBMITTED_MANIFESTS.items()}}

    def manifest(self, connector_key: str) -> dict[str, Any]:
        try:
            return self.manifests()[connector_key]
        except KeyError as error:
            raise ConnectorError("connector_not_found", f"Unknown connector {connector_key}.", availability="unsupported") from error

    def adapter(self, connector_key: str) -> "BaseConnectorAdapter":
        manifest = self.manifest(connector_key)
        if not manifest.get("enabled"):
            raise ConnectorDisabledError(connector_key)
        if connector_key == BLUESKY_CONNECTOR_KEY:
            return BlueskyActorSearchAdapter(manifest, transport=self.transport, fetch_limits=self.fetch_limits)
        if connector_key == APPLE_CONNECTOR_KEY:
            return AppleITunesAdapter(manifest, transport=self.transport, fetch_limits=self.fetch_limits)
        raise ConnectorError("connector_unsupported", f"No adapter is registered for {connector_key}.", availability="unsupported")


class BaseConnectorAdapter:
    def __init__(self, manifest: Mapping[str, Any], *, transport: httpx.BaseTransport | None = None, fetch_limits: FetchLimits | None = None):
        self.manifest = dict(manifest)
        self.transport = transport
        self.fetcher = BoundedHTTPFetcher(limits=fetch_limits, transport=transport)

    def _result_from_fetch(self, operation: str, response: Any) -> ConnectorResult:
        if response.availability == "unsupported":
            return ConnectorResult(
                connector_key=self.manifest["connector_key"],
                operation=operation,
                availability="unsupported",
                source_status=response.source_status,
                status_code=response.status_code,
                response_meta={"content_type": response.content_type, "redirect_chain": response.redirect_chain},
                error_code=response.error_code,
                error_message=response.error_message,
            )
        if not response.available:
            return ConnectorResult(
                connector_key=self.manifest["connector_key"],
                operation=operation,
                availability="unavailable",
                source_status=response.source_status,
                status_code=response.status_code,
                response_meta={"content_type": response.content_type, "redirect_chain": response.redirect_chain},
                error_code=response.error_code,
                error_message=response.error_message,
            )
        try:
            payload = json.loads(response.body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            return ConnectorResult(
                connector_key=self.manifest["connector_key"],
                operation=operation,
                availability="unavailable",
                source_status="failed",
                status_code=response.status_code,
                response_meta={"content_type": response.content_type, "redirect_chain": response.redirect_chain},
                error_code="invalid_json",
                error_message="The permitted source returned metadata that was not valid JSON.",
            )
        return ConnectorResult(
            connector_key=self.manifest["connector_key"],
            operation=operation,
            status_code=response.status_code,
            response_meta={"content_type": response.content_type, "redirect_chain": response.redirect_chain, "payload_type": type(payload).__name__},
        )


class BlueskyActorSearchAdapter(BaseConnectorAdapter):
    def search_profiles(self, query: str, *, limit: int = 25) -> ConnectorResult:
        query = str(query or "").strip()
        if not query:
            raise ConnectorError("query_required", "A Bluesky actor search query is required.", availability="unsupported")
        limit = max(1, min(int(limit), 50))
        url = self.manifest["endpoint"] + "?" + urlencode({"q": query, "limit": limit})
        try:
            response = self.fetcher.fetch(url)
        except SourceSecurityError as error:
            raise ConnectorError(error.code, error.detail) from error
        result = self._result_from_fetch("search_profiles", response)
        if not result.available:
            return result
        try:
            payload = json.loads(response.body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return result
        actors = payload.get("actors") if isinstance(payload, dict) else None
        if not isinstance(actors, list):
            result.availability = "unavailable"
            result.source_status = "failed"
            result.error_code = "schema_changed"
            result.error_message = "The Bluesky response did not contain an actors list."
            return result
        result.records = [self._record(actor) for actor in actors if isinstance(actor, Mapping)]
        return result

    def get_profile(self, actor: str) -> ConnectorResult:
        # The public actor search endpoint is the first permitted contract. A
        # direct profile read is deliberately unsupported until a separate
        # terms/capability review is recorded.
        raise ConnectorError("operation_unsupported", "Direct Bluesky profile reads are not enabled by this adapter.", availability="unsupported")

    def run(self, operation: str, **kwargs: Any) -> ConnectorResult:
        if operation != "search_profiles":
            return ConnectorResult(
                connector_key=self.manifest["connector_key"],
                operation=operation,
                availability="unsupported",
                source_status="unsupported",
                error_code="operation_unsupported",
                error_message="Only public actor search is enabled for the Bluesky adapter.",
            )
        return self.search_profiles(str(kwargs.get("query") or kwargs.get("value") or ""), limit=int(kwargs.get("limit") or 25))

    @staticmethod
    def _record(actor: Mapping[str, Any]) -> dict[str, Any]:
        did = actor.get("did")
        handle = actor.get("handle")
        record: dict[str, Any] = {
            "asset_type": "social_profile",
            "platform": "bluesky",
            "stable_id": str(did) if did else None,
            "source_identity": str(did or handle or ""),
            "handle": str(handle) if handle else None,
            "display_name": actor.get("displayName"),
            "avatar_url": actor.get("avatar"),
            "description": actor.get("description"),
            "indexed_at": actor.get("indexedAt"),
            "source_locator": f"https://bsky.app/profile/{handle}" if handle else None,
        }
        return {key: value for key, value in record.items() if value is not None}


class AppleITunesAdapter(BaseConnectorAdapter):
    def search_listings(self, term: str, *, country: str = "us", limit: int = 25) -> ConnectorResult:
        term = str(term or "").strip()
        if not term:
            raise ConnectorError("query_required", "An Apple app search term is required.", availability="unsupported")
        limit = max(1, min(int(limit), 50))
        url = "https://itunes.apple.com/search?" + urlencode(
            {"entity": "software", "term": term, "country": country, "limit": limit}
        )
        return self._listing_request("search_listings", url)

    def lookup_listing(self, listing_id: str, *, country: str = "us") -> ConnectorResult:
        listing_id = str(listing_id or "").strip()
        if not listing_id.isdigit():
            raise ConnectorError("invalid_listing_id", "Apple listing IDs must be numeric.", availability="unsupported")
        url = "https://itunes.apple.com/lookup?" + urlencode({"entity": "software", "id": listing_id, "country": country})
        return self._listing_request("get_listing", url)

    def _listing_request(self, operation: str, url: str) -> ConnectorResult:
        try:
            response = self.fetcher.fetch(url)
        except SourceSecurityError as error:
            raise ConnectorError(error.code, error.detail) from error
        result = self._result_from_fetch(operation, response)
        if not result.available:
            return result
        try:
            payload = json.loads(response.body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return result
        records = payload.get("results") if isinstance(payload, dict) else None
        if not isinstance(records, list):
            result.availability = "unavailable"
            result.source_status = "failed"
            result.error_code = "schema_changed"
            result.error_message = "The Apple response did not contain a results list."
            return result
        result.records = [self._record(item) for item in records if isinstance(item, Mapping)]
        return result

    def run(self, operation: str, **kwargs: Any) -> ConnectorResult:
        country = str(kwargs.get("country") or "us")[:2].casefold()
        if operation == "search_listings":
            return self.search_listings(str(kwargs.get("query") or kwargs.get("term") or kwargs.get("value") or ""), country=country, limit=int(kwargs.get("limit") or 25))
        if operation == "get_listing":
            return self.lookup_listing(str(kwargs.get("listing_id") or kwargs.get("store_id") or kwargs.get("value") or ""), country=country)
        return ConnectorResult(
            connector_key=self.manifest["connector_key"],
            operation=operation,
            availability="unsupported",
            source_status="unsupported",
            error_code="operation_unsupported",
            error_message="The requested Apple connector operation is not supported.",
        )

    @staticmethod
    def _record(item: Mapping[str, Any]) -> dict[str, Any]:
        track_id = item.get("trackId")
        record: dict[str, Any] = {
            "asset_type": "mobile_app",
            "store": "apple_app_store",
            "source_identity": f"apple:{track_id}" if track_id is not None else str(item.get("bundleId") or ""),
            "store_id": str(track_id) if track_id is not None else None,
            "stable_id": str(track_id) if track_id is not None else None,
            "title": item.get("trackName") or item.get("trackCensoredName"),
            "display_name": item.get("trackName") or item.get("trackCensoredName"),
            "icon_url": item.get("artworkUrl100") or item.get("artworkUrl512"),
            "bundle_id": item.get("bundleId"),
            "publisher": item.get("sellerName") or item.get("artistName"),
            "description": item.get("description"),
            "support_url": item.get("supportUrl"),
            "version": item.get("version"),
            "release_date": item.get("releaseDate"),
            "listing_url": item.get("trackViewUrl"),
            "source_locator": item.get("trackViewUrl"),
            "country": item.get("country"),
        }
        return {key: value for key, value in record.items() if value is not None}


def connector_manifests(
    *,
    environ: Mapping[str, str] | None = None,
    rights_manifest: str | os.PathLike[str] | Mapping[str, Any] | None = None,
) -> dict[str, dict[str, Any]]:
    """Return the external connector manifests with effective enablement."""

    return ConnectorRegistry(environ=environ, rights_manifest=rights_manifest).manifests()


__all__ = [
    "APPLE_CONNECTOR_KEY",
    "BLUESKY_CONNECTOR_KEY",
    "AppleITunesAdapter",
    "BlueskyActorSearchAdapter",
    "CONNECTOR_MANIFESTS",
    "ConnectorDisabledError",
    "ConnectorError",
    "ConnectorRegistry",
    "ConnectorResult",
    "USER_SUBMITTED_APP_KEY",
    "USER_SUBMITTED_MANIFESTS",
    "USER_SUBMITTED_SOCIAL_KEY",
    "connector_manifests",
]
