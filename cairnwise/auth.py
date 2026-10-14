"""Authentication adapters and workspace membership persistence.

Local password authentication remains available for development, but it is
not a production identity provider.  When the Supabase environment is
configured, :class:`SupabaseAuth` verifies the bearer token before it creates
or updates a local authorization principal.  Passwords, bearer tokens, and
authorization headers are never persisted by this module.  Local sessions
store only a salted scrypt password digest and a SHA-256 digest of each opaque
session token; Supabase sessions are kept by the browser and are never copied
into SQLite.

Supabase setup variables (the public-key variables are safe for a browser;
the JWT secret and JWKS URL are server-only configuration):

``CAIRNWISE_SUPABASE_URL``
    Project URL, for example ``https://example.supabase.co``.
``CAIRNWISE_SUPABASE_JWT_SECRET`` or ``CAIRNWISE_SUPABASE_JWKS_URL``
    Exactly one verifier is normally used.  HS256 uses the server-only JWT
    secret.  RS256/ES256 use the configured JWKS endpoint.
``CAIRNWISE_SUPABASE_JWT_AUDIENCE`` / ``CAIRNWISE_SUPABASE_JWT_ISSUER``
    Optional claim overrides.  The defaults are ``authenticated`` and
    ``<SUPABASE_URL>/auth/v1``.
``CAIRNWISE_SUPABASE_ANON_KEY`` or ``CAIRNWISE_SUPABASE_PUBLISHABLE_KEY``
    Optional browser-safe key returned by ``/v1/auth/config``.
``CAIRNWISE_SUPABASE_REDIRECT_ORIGIN``
    Optional browser OAuth redirect origin.  Without it the request origin is
    used; production deployments should set this explicitly.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import math
import os
import re
import secrets
import sqlite3
import threading
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Mapping

from .db import Database, new_id, utc_now


AUTH_PROBLEM = "https://cairnwise.local/problems/authentication"
AUTHORIZATION_PROBLEM = "https://cairnwise.local/problems/authorization"

SESSION_TTL = timedelta(hours=8)
PASSWORD_SALT_BYTES = 16
PASSWORD_HASH_BYTES = 64
PASSWORD_SCRYPT_N = 2**14
PASSWORD_SCRYPT_R = 8
PASSWORD_SCRYPT_P = 1
MAX_BEARER_TOKEN_LENGTH = 8192
LOCAL_MAX_BEARER_TOKEN_LENGTH = 512
SUPABASE_AUTH_PROVIDER = "supabase"
SUPABASE_DEFAULT_AUDIENCE = "authenticated"
SUPABASE_JWKS_CACHE_SECONDS = 300

ROLES = ("member", "analyst", "reviewer", "admin", "owner")
ROLE_RANK = {role: index for index, role in enumerate(ROLES)}


class AuthError(Exception):
    """A safe, RFC 9457-compatible authentication error."""

    def __init__(
        self,
        status: int,
        title: str,
        detail: str,
        *,
        error_type: str = AUTH_PROBLEM,
        headers: dict[str, str] | None = None,
    ):
        super().__init__(detail)
        self.status = status
        self.title = title
        self.detail = detail
        self.error_type = error_type
        self.headers = headers if headers is not None else ({"WWW-Authenticate": "Bearer"} if status == 401 else {})


def _env_text(name: str) -> str | None:
    """Return a trimmed environment value without ever logging it."""

    value = os.getenv(name)
    if value is None:
        return None
    value = value.strip()
    return value or None


@dataclass(frozen=True)
class SupabaseConfig:
    """Server configuration for the Supabase JWT boundary.

    ``jwt_secret`` and ``jwks_url`` intentionally have a redacted repr so an
    accidental debug representation cannot put verifier configuration into a
    log.  ``anon_key`` and ``publishable_key`` are public browser values, but
    they are still only returned by the explicit public config endpoint.
    """

    url: str | None = None
    jwt_secret: str | None = field(default=None, repr=False)
    jwks_url: str | None = field(default=None, repr=False)
    anon_key: str | None = None
    publishable_key: str | None = None
    issuer: str | None = None
    audience: str = SUPABASE_DEFAULT_AUDIENCE
    redirect_origin: str | None = None

    @classmethod
    def from_env(cls) -> "SupabaseConfig":
        """Read the documented ``CAIRNWISE_SUPABASE_*`` variables.

        A Supabase deployment is considered enabled only when both the project
        URL and at least one server-side verifier are present.  A URL and a
        browser key alone therefore continue to use the explicit local
        development fallback rather than accepting unverified tokens.
        """

        url = _env_text("CAIRNWISE_SUPABASE_URL")
        if url:
            url = url.rstrip("/")
        issuer = _env_text("CAIRNWISE_SUPABASE_JWT_ISSUER")
        audience = _env_text("CAIRNWISE_SUPABASE_JWT_AUDIENCE") or SUPABASE_DEFAULT_AUDIENCE
        return cls(
            url=url,
            jwt_secret=_env_text("CAIRNWISE_SUPABASE_JWT_SECRET"),
            jwks_url=_env_text("CAIRNWISE_SUPABASE_JWKS_URL"),
            anon_key=_env_text("CAIRNWISE_SUPABASE_ANON_KEY"),
            publishable_key=_env_text("CAIRNWISE_SUPABASE_PUBLISHABLE_KEY"),
            issuer=issuer.rstrip("/") if issuer else None,
            audience=audience,
            redirect_origin=_env_text("CAIRNWISE_SUPABASE_REDIRECT_ORIGIN"),
        )

    @property
    def enabled(self) -> bool:
        return bool(self.url and (self.jwt_secret or self.jwks_url))

    @property
    def expected_issuer(self) -> str | None:
        if self.issuer:
            return self.issuer
        return f"{self.url.rstrip('/')}/auth/v1" if self.url else None

    def public_config(self, *, redirect_origin: str | None = None) -> dict[str, Any]:
        """Return the deliberately small browser-safe configuration object."""

        result: dict[str, Any] = {
            "enabled": self.enabled,
            # The project URL is public metadata; the server verifier is not.
            "supabase_url": self.url.rstrip("/") if self.url else None,
            "provider": "google",
            "redirect_origin": redirect_origin or self.redirect_origin,
        }
        if self.anon_key:
            result["anon_key"] = self.anon_key
        if self.publishable_key:
            result["publishable_key"] = self.publishable_key
        return result


def _base64url_decode(value: str, *, field: str) -> bytes:
    if not isinstance(value, str) or not value or not re.fullmatch(r"[A-Za-z0-9_-]+", value):
        raise AuthError(401, "Authentication failed", f"The Supabase token contains an invalid {field}.")
    try:
        return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
    except (ValueError, binascii.Error) as error:
        raise AuthError(401, "Authentication failed", f"The Supabase token contains an invalid {field}.") from error


def _jwt_parts(token: str) -> tuple[str, dict[str, Any], dict[str, Any], bytes]:
    if not isinstance(token, str) or not token or len(token) > MAX_BEARER_TOKEN_LENGTH:
        raise AuthError(401, "Authentication failed", "The Supabase bearer token is malformed.")
    parts = token.split(".")
    if len(parts) != 3:
        raise AuthError(401, "Authentication failed", "The Supabase bearer token is malformed.")
    encoded_header, encoded_payload, encoded_signature = parts
    try:
        header = json.loads(_base64url_decode(encoded_header, field="header"))
        claims = json.loads(_base64url_decode(encoded_payload, field="claims"))
    except (UnicodeDecodeError, json.JSONDecodeError, TypeError) as error:
        raise AuthError(401, "Authentication failed", "The Supabase bearer token is malformed.") from error
    if not isinstance(header, dict) or not isinstance(claims, dict):
        raise AuthError(401, "Authentication failed", "The Supabase bearer token is malformed.")
    signature = _base64url_decode(encoded_signature, field="signature")
    return f"{encoded_header}.{encoded_payload}", header, claims, signature


def _claim_number(claims: Mapping[str, Any], name: str) -> float:
    value = claims.get(name)
    # bool is an int subclass but is not a valid NumericDate.
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(float(value)):
        raise AuthError(401, "Authentication failed", f"The Supabase token is missing a valid {name} claim.")
    return float(value)


def _validate_supabase_claims(claims: Mapping[str, Any], config: SupabaseConfig) -> dict[str, Any]:
    issuer = claims.get("iss")
    expected_issuer = config.expected_issuer
    if not isinstance(issuer, str) or not expected_issuer or not hmac.compare_digest(issuer, expected_issuer):
        raise AuthError(401, "Authentication failed", "The Supabase token issuer is invalid.")

    audience = claims.get("aud")
    valid_audiences = audience if isinstance(audience, list) else [audience]
    if not isinstance(config.audience, str) or not any(
        isinstance(item, str) and hmac.compare_digest(item, config.audience) for item in valid_audiences
    ):
        raise AuthError(401, "Authentication failed", "The Supabase token audience is invalid.")

    now = time.time()
    if _claim_number(claims, "exp") <= now:
        raise AuthError(401, "Authentication failed", "The Supabase token has expired.")
    if "nbf" in claims and _claim_number(claims, "nbf") > now:
        raise AuthError(401, "Authentication failed", "The Supabase token is not active yet.")

    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject.strip() or len(subject) > 256:
        raise AuthError(401, "Authentication failed", "The Supabase token subject is invalid.")
    return dict(claims)


def _verify_hs256(signing_input: str, signature: bytes, secret: str) -> None:
    expected = hmac.new(secret.encode("utf-8"), signing_input.encode("ascii"), hashlib.sha256).digest()
    if not hmac.compare_digest(signature, expected):
        raise AuthError(401, "Authentication failed", "The Supabase token signature is invalid.")


def _cryptography_setup_error() -> AuthError:
    return AuthError(
        503,
        "Authentication unavailable",
        "Supabase JWKS verification requires the 'cryptography' package; install requirements.txt and restart the API.",
    )


def _ensure_jwks_dependency() -> None:
    """Fail before any network fetch when asymmetric verification is unavailable."""

    try:
        from cryptography.hazmat.primitives import hashes  # noqa: F401
        from cryptography.hazmat.primitives.asymmetric import ec, padding, rsa  # noqa: F401
        from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature  # noqa: F401
        from cryptography.exceptions import InvalidSignature  # noqa: F401
    except ImportError as error:
        raise _cryptography_setup_error() from error


def _verify_jwks_signature(signing_input: str, signature: bytes, header: Mapping[str, Any], jwks: Mapping[str, Any]) -> None:
    try:
        from cryptography.exceptions import InvalidSignature
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric import ec, padding, rsa
        from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature
    except ImportError as error:
        raise _cryptography_setup_error() from error

    kid = header.get("kid")
    algorithm = header.get("alg")
    keys = jwks.get("keys")
    if not isinstance(kid, str) or not isinstance(keys, list):
        raise AuthError(503, "Authentication unavailable", "The configured Supabase JWKS response is invalid.")
    key = next((item for item in keys if isinstance(item, dict) and item.get("kid") == kid), None)
    if not isinstance(key, dict):
        raise AuthError(401, "Authentication failed", "The Supabase token signing key is unknown.")
    if key.get("alg") not in (None, algorithm) or key.get("use") not in (None, "sig"):
        raise AuthError(401, "Authentication failed", "The Supabase token signing key is not accepted.")

    try:
        kty = key.get("kty")
        if algorithm == "RS256" and kty == "RSA":
            modulus = int.from_bytes(_base64url_decode(str(key["n"]), field="JWKS modulus"), "big")
            exponent = int.from_bytes(_base64url_decode(str(key["e"]), field="JWKS exponent"), "big")
            public_key = rsa.RSAPublicNumbers(exponent, modulus).public_key()
            public_key.verify(signature, signing_input.encode("ascii"), padding.PKCS1v15(), hashes.SHA256())
        elif algorithm in {"ES256", "ES384", "ES512"} and kty == "EC":
            curve_by_name = {
                "P-256": (ec.SECP256R1, hashes.SHA256, 32),
                "P-384": (ec.SECP384R1, hashes.SHA384, 48),
                "P-521": (ec.SECP521R1, hashes.SHA512, 66),
            }
            curve_spec = curve_by_name.get(key.get("crv"))
            if curve_spec is None:
                raise AuthError(401, "Authentication failed", "The Supabase token signing curve is unsupported.")
            curve_type, hash_type, coordinate_size = curve_spec
            x = int.from_bytes(_base64url_decode(str(key["x"]), field="JWKS x coordinate"), "big")
            y = int.from_bytes(_base64url_decode(str(key["y"]), field="JWKS y coordinate"), "big")
            if len(signature) != coordinate_size * 2:
                raise AuthError(401, "Authentication failed", "The Supabase token signature is malformed.")
            r = int.from_bytes(signature[:coordinate_size], "big")
            s = int.from_bytes(signature[coordinate_size:], "big")
            public_key = ec.EllipticCurvePublicNumbers(x, y, curve_type()).public_key()
            public_key.verify(
                encode_dss_signature(r, s),
                signing_input.encode("ascii"),
                ec.ECDSA(hash_type()),
            )
        else:
            raise AuthError(401, "Authentication failed", "The Supabase token signing algorithm is unsupported.")
    except AuthError:
        raise
    except (KeyError, ValueError, TypeError) as error:
        raise AuthError(503, "Authentication unavailable", "The configured Supabase JWKS response is invalid.") from error
    except InvalidSignature as error:
        # cryptography uses InvalidSignature, which is intentionally not
        # exposed to callers and must never be treated as a verified token.
        raise AuthError(401, "Authentication failed", "The Supabase token signature is invalid.") from error
    except Exception as error:
        raise AuthError(503, "Authentication unavailable", "Supabase JWT verification failed to initialize.") from error


class _JwksCache:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._url: str | None = None
        self._expires_at = 0.0
        self._keys: dict[str, Any] | None = None

    def get(self, url: str) -> dict[str, Any]:
        with self._lock:
            if self._url == url and self._keys is not None and self._expires_at > time.time():
                return self._keys
        if not url.startswith("https://"):
            raise AuthError(503, "Authentication unavailable", "CAIRNWISE_SUPABASE_JWKS_URL must use HTTPS.")
        try:
            request = urllib.request.Request(url, headers={"Accept": "application/json"}, method="GET")
            with urllib.request.urlopen(request, timeout=5) as response:
                body = response.read(512 * 1024)
            value = json.loads(body)
        except (OSError, urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            raise AuthError(503, "Authentication unavailable", "The Supabase JWKS endpoint could not be reached.") from error
        if not isinstance(value, dict) or not isinstance(value.get("keys"), list):
            raise AuthError(503, "Authentication unavailable", "The configured Supabase JWKS response is invalid.")
        with self._lock:
            self._url = url
            self._keys = value
            self._expires_at = time.time() + SUPABASE_JWKS_CACHE_SECONDS
        return value


_JWKS_CACHE = _JwksCache()


def verify_supabase_jwt(token: str, config: SupabaseConfig) -> dict[str, Any]:
    """Verify a Supabase JWT, including its signature and registered claims.

    This function intentionally has no decode-only mode.  HS256 is verified
    with the server-only JWT secret.  RS256/ES256/ES512 are verified against
    the configured JWKS URL using ``cryptography``.  A missing verifier or an
    unavailable JWKS dependency is an explicit setup error, never a reason to
    trust the token payload.
    """

    if not config.enabled:
        raise AuthError(
            503,
            "Authentication unavailable",
            "Supabase authentication is not configured. Set CAIRNWISE_SUPABASE_URL and a JWT verifier secret or JWKS URL.",
        )
    signing_input, header, claims, signature = _jwt_parts(token)
    algorithm = header.get("alg")
    if not isinstance(algorithm, str) or algorithm in {"none", ""}:
        raise AuthError(401, "Authentication failed", "The Supabase token algorithm is not accepted.")

    if algorithm == "HS256" and config.jwt_secret:
        _verify_hs256(signing_input, signature, config.jwt_secret)
    elif algorithm in {"RS256", "ES256", "ES384", "ES512"} and config.jwks_url:
        _ensure_jwks_dependency()
        _verify_jwks_signature(signing_input, signature, header, _JWKS_CACHE.get(config.jwks_url))
    elif algorithm == "HS256" and not config.jwt_secret:
        raise AuthError(503, "Authentication unavailable", "Supabase HS256 verification requires CAIRNWISE_SUPABASE_JWT_SECRET.")
    elif algorithm in {"RS256", "ES256", "ES384", "ES512"} and not config.jwks_url:
        raise AuthError(503, "Authentication unavailable", "Supabase asymmetric verification requires CAIRNWISE_SUPABASE_JWKS_URL.")
    else:
        raise AuthError(401, "Authentication failed", "The Supabase token signing algorithm is unsupported.")
    return _validate_supabase_claims(claims, config)


def _utc_after(delta: timedelta) -> str:
    return (datetime.now(timezone.utc) + delta).isoformat(timespec="seconds").replace("+00:00", "Z")


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _password_digest(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=PASSWORD_SCRYPT_N,
        r=PASSWORD_SCRYPT_R,
        p=PASSWORD_SCRYPT_P,
        dklen=PASSWORD_HASH_BYTES,
    )


class LocalAuth:
    """SQLite-backed users, opaque sessions, and workspace memberships."""

    def __init__(self, db: Database):
        self.db = db

    def initialize(self) -> None:
        """Create auth-owned tables after the domain schema exists."""

        schema = """
        CREATE TABLE IF NOT EXISTS auth_users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password_salt TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            password_auth_enabled INTEGER NOT NULL DEFAULT 1 CHECK (password_auth_enabled IN (0, 1)),
            auth_provider TEXT NOT NULL DEFAULT 'local' CHECK (auth_provider IN ('local', 'supabase')),
            supabase_subject TEXT,
            email TEXT,
            display_name TEXT,
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS auth_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
            token_hash TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            last_seen_at TEXT,
            revoked_at TEXT
        );

        CREATE INDEX IF NOT EXISTS auth_sessions_user
            ON auth_sessions (user_id, expires_at);

        CREATE TABLE IF NOT EXISTS workspace_members (
            workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
            role TEXT NOT NULL CHECK (role IN ('member', 'analyst', 'reviewer', 'admin', 'owner')),
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
            created_at TEXT NOT NULL,
            PRIMARY KEY (workspace_id, user_id)
        );

        CREATE INDEX IF NOT EXISTS workspace_members_user
            ON workspace_members (user_id, status);
        """
        with self.db.transaction() as connection:
            connection.executescript(schema)
            # Existing local development databases predate the provider
            # columns.  Migrate them in-place without touching domain tables.
            columns = {
                row["name"]
                for row in connection.execute("PRAGMA table_info(auth_users)").fetchall()
            }
            migrations = (
                ("password_auth_enabled", "ALTER TABLE auth_users ADD COLUMN password_auth_enabled INTEGER NOT NULL DEFAULT 1"),
                ("auth_provider", "ALTER TABLE auth_users ADD COLUMN auth_provider TEXT NOT NULL DEFAULT 'local'"),
                ("supabase_subject", "ALTER TABLE auth_users ADD COLUMN supabase_subject TEXT"),
                ("email", "ALTER TABLE auth_users ADD COLUMN email TEXT"),
                ("display_name", "ALTER TABLE auth_users ADD COLUMN display_name TEXT"),
            )
            for column, statement in migrations:
                if column not in columns:
                    connection.execute(statement)
            connection.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS auth_users_supabase_subject "
                "ON auth_users (supabase_subject) WHERE supabase_subject IS NOT NULL"
            )

    @staticmethod
    def normalize_username(value: Any) -> str:
        if not isinstance(value, str):
            raise AuthError(422, "Validation failed", "username must be a string.")
        username = value.strip().casefold()
        if not 3 <= len(username) <= 128:
            raise AuthError(422, "Validation failed", "username must be between 3 and 128 characters.")
        if any(character.isspace() for character in username):
            raise AuthError(422, "Validation failed", "username must not contain whitespace.")
        return username

    @staticmethod
    def validate_password(value: Any) -> str:
        if not isinstance(value, str):
            raise AuthError(422, "Validation failed", "password must be a string.")
        if not 8 <= len(value) <= 256:
            raise AuthError(422, "Validation failed", "password must be between 8 and 256 characters.")
        if len(value.encode("utf-8")) > 1024:
            raise AuthError(422, "Validation failed", "password is too large.")
        return value

    def register(self, username: Any, password: Any) -> dict[str, Any]:
        normalized_username = self.normalize_username(username)
        normalized_password = self.validate_password(password)
        user_id = new_id("user")
        created_at = utc_now()
        salt = secrets.token_bytes(PASSWORD_SALT_BYTES)
        password_hash = _password_digest(normalized_password, salt)
        token = secrets.token_urlsafe(32)
        expires_at = _utc_after(SESSION_TTL)
        try:
            with self.db.transaction() as connection:
                connection.execute(
                    """
                    INSERT INTO auth_users
                        (id, username, password_salt, password_hash, password_auth_enabled, auth_provider, created_at)
                    VALUES (?, ?, ?, ?, 1, 'local', ?)
                    """,
                    (user_id, normalized_username, salt.hex(), password_hash.hex(), created_at),
                )
                connection.execute(
                    """
                    INSERT INTO auth_sessions
                        (id, user_id, token_hash, created_at, expires_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (new_id("session"), user_id, _token_hash(token), created_at, expires_at),
                )
        except sqlite3.IntegrityError as error:
            if "auth_users.username" in str(error) or "UNIQUE constraint failed: auth_users.username" in str(error):
                raise AuthError(409, "Username unavailable", "That username is already registered.") from error
            raise
        return self._session_response(user_id, token, expires_at)

    def login(self, username: Any, password: Any) -> dict[str, Any]:
        normalized_username = self.normalize_username(username)
        normalized_password = self.validate_password(password)
        row = self.db.fetch_one(
            "SELECT * FROM auth_users WHERE username = ? AND status = 'active' AND password_auth_enabled = 1",
            (normalized_username,),
        )
        if row:
            salt = bytes.fromhex(row["password_salt"])
            expected = bytes.fromhex(row["password_hash"])
            actual = _password_digest(normalized_password, salt)
            valid = hmac.compare_digest(actual, expected)
        else:
            # Perform equivalent work for unknown users without revealing
            # whether an account exists through the response path.
            dummy_salt = b"cairnwise-local-salt"
            dummy_hash = _password_digest(normalized_password, dummy_salt)
            valid = hmac.compare_digest(dummy_hash, b"\x00" * PASSWORD_HASH_BYTES)
        if not row or not valid:
            raise AuthError(
                401,
                "Authentication failed",
                "The username or password is incorrect.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        token = secrets.token_urlsafe(32)
        expires_at = _utc_after(SESSION_TTL)
        now = utc_now()
        with self.db.transaction() as connection:
            connection.execute(
                """
                INSERT INTO auth_sessions
                    (id, user_id, token_hash, created_at, expires_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (new_id("session"), row["id"], _token_hash(token), now, expires_at),
            )
        return self._session_response(row["id"], token, expires_at)

    def authenticate(self, authorization: str | None) -> dict[str, Any]:
        token = self._bearer_token(authorization)
        now = utc_now()
        row = self.db.fetch_one(
            """
            SELECT s.id AS session_id, s.user_id, s.expires_at,
                   u.username, u.status AS user_status
            FROM auth_sessions s
            JOIN auth_users u ON u.id = s.user_id
            WHERE s.token_hash = ?
              AND s.revoked_at IS NULL
              AND s.expires_at > ?
              AND u.status = 'active'
              AND u.auth_provider = 'local'
            """,
            (_token_hash(token), now),
        )
        if not row:
            raise AuthError(
                401,
                "Authentication required",
                "A valid, unexpired bearer session is required.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        with self.db.transaction() as connection:
            connection.execute(
                "UPDATE auth_sessions SET last_seen_at = ? WHERE id = ?",
                (now, row["session_id"]),
            )
        return {
            "id": row["user_id"],
            "username": row["username"],
            "session_id": row["session_id"],
            "expires_at": row["expires_at"],
        }

    def logout(self, authorization: str | None) -> dict[str, Any]:
        token = self._bearer_token(authorization)
        now = utc_now()
        with self.db.transaction() as connection:
            cursor = connection.execute(
                """
                UPDATE auth_sessions
                   SET revoked_at = ?
                 WHERE token_hash = ? AND revoked_at IS NULL
                """,
                (now, _token_hash(token)),
            )
        if cursor.rowcount != 1:
            raise AuthError(
                401,
                "Authentication required",
                "A valid, unexpired bearer session is required.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return {"logged_out": True}

    def user(self, user_id: str) -> dict[str, Any] | None:
        row = self.db.fetch_one(
            """
            SELECT id, username, email, display_name, auth_provider, status, created_at
            FROM auth_users
            WHERE id = ?
            """,
            (user_id,),
        )
        if not row:
            return None
        result = {
            "id": row["id"],
            "username": row["username"],
            "status": row["status"],
            "created_at": row["created_at"],
        }
        if row["auth_provider"] == SUPABASE_AUTH_PROVIDER:
            result.update(
                {
                    "email": row["email"],
                    "display_name": row["display_name"],
                    "auth_provider": row["auth_provider"],
                }
            )
        return result

    def me(self, user_id: str) -> dict[str, Any]:
        user = self.user(user_id)
        if not user:
            raise AuthError(401, "Authentication required", "The authenticated user no longer exists.")
        memberships = self.db.fetch_all(
            """
            SELECT wm.workspace_id, wm.role, wm.status, w.name, w.status AS workspace_status
            FROM workspace_members wm
            JOIN workspaces w ON w.id = wm.workspace_id
            WHERE wm.user_id = ? AND wm.status = 'active'
            ORDER BY w.created_at
            """,
            (user_id,),
        )
        return {
            "user": user,
            "workspaces": [dict(row) for row in memberships],
        }

    def add_membership(self, workspace_id: str, user_id: str, role: str) -> None:
        if role not in ROLE_RANK:
            raise AuthError(422, "Validation failed", "Unsupported workspace role.")
        now = utc_now()
        try:
            with self.db.transaction() as connection:
                connection.execute(
                    """
                    INSERT INTO workspace_members (workspace_id, user_id, role, created_at)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(workspace_id, user_id) DO UPDATE SET role = excluded.role, status = 'active'
                    """,
                    (workspace_id, user_id, role, now),
                )
        except sqlite3.IntegrityError as error:
            # Keep the outward error safe and independent of SQLite wording.
            raise AuthError(404, "Workspace not found", "The workspace or user does not exist.") from error

    def membership(self, workspace_id: str, user_id: str) -> dict[str, Any] | None:
        row = self.db.fetch_one(
            """
            SELECT workspace_id, user_id, role, status, created_at
            FROM workspace_members
            WHERE workspace_id = ? AND user_id = ?
            """,
            (workspace_id, user_id),
        )
        return dict(row) if row else None

    @staticmethod
    def role_allows(role: str | None, minimum: str) -> bool:
        if role not in ROLE_RANK or minimum not in ROLE_RANK:
            return False
        return ROLE_RANK[role] >= ROLE_RANK[minimum]

    @staticmethod
    def _bearer_token(authorization: str | None) -> str:
        if not authorization or not isinstance(authorization, str):
            raise AuthError(
                401,
                "Authentication required",
                "A bearer session is required.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        scheme, separator, token = authorization.partition(" ")
        if scheme.casefold() != "bearer" or not separator or not token or len(token) > LOCAL_MAX_BEARER_TOKEN_LENGTH or token != token.strip():
            raise AuthError(
                401,
                "Authentication required",
                "A bearer session is required.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return token

    def _session_response(self, user_id: str, token: str, expires_at: str) -> dict[str, Any]:
        user = self.user(user_id)
        if not user:
            raise AuthError(500, "Authentication unavailable", "The local authentication store is unavailable.")
        return {
            "user": user,
            "access_token": token,
            "token_type": "bearer",
            "expires_at": expires_at,
            "expires_in": int(SESSION_TTL.total_seconds()),
        }


class SupabaseAuth(LocalAuth):
    """Supabase JWT authentication backed by local authorization records.

    The application constructs this adapter only when both the Supabase
    project URL and a server-side verifier are configured.  ``token_verifier``
    is a narrow test seam for a fake *already-verified* claims adapter; the
    production app never supplies it and always calls
    :func:`verify_supabase_jwt`.
    """

    def __init__(
        self,
        db: Database,
        config: SupabaseConfig | None = None,
        *,
        token_verifier: Callable[[str], Mapping[str, Any]] | None = None,
        verifier: Callable[[str], Mapping[str, Any]] | None = None,
    ):
        super().__init__(db)
        self.config = config or SupabaseConfig.from_env()
        if token_verifier is not None and verifier is not None:
            raise ValueError("Provide only one Supabase test verifier.")
        self._token_verifier = token_verifier or verifier

    def register(self, username: Any, password: Any) -> dict[str, Any]:
        raise AuthError(
            403,
            "Local authentication disabled",
            "Local password accounts are development-only and disabled while Supabase authentication is configured.",
        )

    def login(self, username: Any, password: Any) -> dict[str, Any]:
        raise AuthError(
            403,
            "Local authentication disabled",
            "Use the configured Supabase provider to sign in.",
        )

    @staticmethod
    def _bearer_token(authorization: str | None) -> str:
        if not authorization or not isinstance(authorization, str):
            raise AuthError(
                401,
                "Authentication required",
                "A bearer session is required.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        scheme, separator, token = authorization.partition(" ")
        if scheme.casefold() != "bearer" or not separator or not token or len(token) > MAX_BEARER_TOKEN_LENGTH or token != token.strip():
            raise AuthError(
                401,
                "Authentication required",
                "A bearer session is required.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return token

    def authenticate(self, authorization: str | None) -> dict[str, Any]:
        token = self._bearer_token(authorization)
        claims = self.verify_token(token)
        user = self._upsert_claims_user(claims)
        expires_at = _numeric_date_iso(claims.get("exp"))
        return {
            **user,
            "session_id": None,
            "expires_at": expires_at,
            "token_type": "bearer",
        }

    def logout(self, authorization: str | None) -> dict[str, Any]:
        # JWT access tokens are owned and revoked by Supabase.  This endpoint
        # only verifies the caller before allowing the browser to clear its
        # session; it never stores or pretends to revoke the JWT locally.
        self.authenticate(authorization)
        return {"logged_out": True}

    def verify_token(self, token: str) -> dict[str, Any]:
        """Verify one bearer token and return only its verified claims.

        Production instances use the configured cryptographic verifier.  The
        optional injected callable exists for tests that provide an explicit
        already-verified claims adapter and is never wired by ``create_app``.
        """

        return self._verified_claims(token)

    def _verified_claims(self, token: str) -> dict[str, Any]:
        if not self.config.enabled and self._token_verifier is None:
            raise AuthError(
                503,
                "Authentication unavailable",
                "Supabase authentication is not configured. Set CAIRNWISE_SUPABASE_URL and a JWT verifier secret or JWKS URL.",
            )
        if self._token_verifier is not None:
            try:
                if callable(self._token_verifier):
                    claims = self._token_verifier(token)
                elif hasattr(self._token_verifier, "verify_token"):
                    claims = self._token_verifier.verify_token(token)  # type: ignore[union-attr]
                else:
                    claims = self._token_verifier.verify(token)  # type: ignore[union-attr]
            except AuthError:
                raise
            except Exception as error:
                raise AuthError(401, "Authentication failed", "The Supabase bearer token could not be verified.") from error
            if not isinstance(claims, Mapping):
                raise AuthError(401, "Authentication failed", "The Supabase bearer token could not be verified.")
            # The injected callable represents a test verifier, but the same
            # required identity/expiry shape is retained for role tests.
            subject = claims.get("sub")
            if not isinstance(subject, str) or not subject.strip():
                raise AuthError(401, "Authentication failed", "The verified Supabase subject is invalid.")
            if "exp" in claims:
                _claim_number(claims, "exp")
            return dict(claims)
        return verify_supabase_jwt(token, self.config)

    @staticmethod
    def _claim_text(claims: Mapping[str, Any], *names: str, limit: int) -> str | None:
        for name in names:
            value: Any = claims
            for part in name.split("."):
                if not isinstance(value, Mapping):
                    value = None
                    break
                value = value.get(part)
            if isinstance(value, str):
                value = value.strip()
                if value:
                    return value[:limit]
        return None

    def _upsert_claims_user(self, claims: Mapping[str, Any]) -> dict[str, Any]:
        subject = str(claims["sub"]).strip()
        email = self._claim_text(claims, "email", "user_metadata.email", limit=320)
        display_name = self._claim_text(
            claims,
            "name",
            "full_name",
            "user_metadata.full_name",
            "user_metadata.name",
            "preferred_username",
            limit=256,
        )
        created_at = utc_now()
        with self.db.transaction() as connection:
            row = connection.execute(
                "SELECT * FROM auth_users WHERE supabase_subject = ? AND auth_provider = 'supabase'",
                (subject,),
            ).fetchone()
            if row is not None:
                if row["status"] != "active":
                    raise AuthError(403, "Account disabled", "The authenticated account is disabled.")
                connection.execute(
                    """
                    UPDATE auth_users
                       SET email = COALESCE(?, email),
                           display_name = COALESCE(?, display_name)
                     WHERE id = ?
                    """,
                    (email, display_name, row["id"]),
                )
                user_id = row["id"]
            else:
                username = self._new_supabase_username(connection, email, display_name, subject)
                user_id = new_id("user")
                # Password fields are retained for the existing local schema,
                # but password_auth_enabled=0 makes this row unusable for local
                # password login.  No Supabase credential is persisted.
                connection.execute(
                    """
                    INSERT INTO auth_users
                        (id, username, password_salt, password_hash,
                         password_auth_enabled, auth_provider, supabase_subject,
                         email, display_name, created_at)
                    VALUES (?, ?, ?, ?, 0, 'supabase', ?, ?, ?, ?)
                    """,
                    (
                        user_id,
                        username,
                        secrets.token_bytes(PASSWORD_SALT_BYTES).hex(),
                        (b"\x00" * PASSWORD_HASH_BYTES).hex(),
                        subject,
                        email,
                        display_name,
                        created_at,
                    ),
                )
        user = self.user(user_id)
        if not user:
            raise AuthError(500, "Authentication unavailable", "The local authentication store is unavailable.")
        return {"id": user["id"], "username": user["username"], **user}

    @staticmethod
    def _new_supabase_username(connection: sqlite3.Connection, email: str | None, name: str | None, subject: str) -> str:
        source = email or name or "supabase-user"
        source = source.split("@", 1)[0] if email else source
        source = re.sub(r"[^a-zA-Z0-9._+-]+", "-", source.strip().casefold()).strip("-._+")
        source = source or "supabase-user"
        suffix = hashlib.sha256(subject.encode("utf-8")).hexdigest()[:12]
        candidate = f"{source[:110]}-{suffix}"
        if len(candidate) < 3:
            candidate = f"user-{suffix}"
        if connection.execute("SELECT 1 FROM auth_users WHERE username = ?", (candidate,)).fetchone() is None:
            return candidate
        # The subject hash is already stable, so a collision here indicates a
        # pre-existing username from a different provider.  Make the fallback
        # deterministic while preserving the local username constraints.
        fallback = f"supabase-{hashlib.sha256(subject.encode('utf-8')).hexdigest()}"
        if connection.execute("SELECT 1 FROM auth_users WHERE username = ?", (fallback,)).fetchone() is None:
            return fallback
        raise AuthError(500, "Authentication unavailable", "A unique local identity could not be allocated.")


def _numeric_date_iso(value: Any) -> str | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(float(value)):
        return None
    try:
        return datetime.fromtimestamp(float(value), timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    except (OverflowError, OSError, ValueError):
        return None


__all__ = [
    "AUTH_PROBLEM",
    "AUTHORIZATION_PROBLEM",
    "AuthError",
    "LocalAuth",
    "SupabaseAuth",
    "SupabaseConfig",
    "verify_supabase_jwt",
]
