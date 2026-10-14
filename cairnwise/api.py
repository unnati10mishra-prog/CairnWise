"""FastAPI transport and authorization boundary for the Cairnwise foundation."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Awaitable, Callable

from fastapi import Body, FastAPI, Header, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response

from .auth import AUTHORIZATION_PROBLEM, AuthError, LocalAuth, SupabaseAuth, SupabaseConfig
from .db import Database
from .normalization import compact_name
from .service import CairnwiseService, DomainError


ROOT = Path(__file__).resolve().parents[1]
MAX_REQUEST_BYTES = 512 * 1024
MAX_BODY_KEYS = 64
MAX_IDENTIFIER_LENGTH = 128
MAX_TEXT_LENGTH = 2048

DEFAULT_CORS_ORIGINS = (
    "http://127.0.0.1:8765",
    "http://localhost:8765",
    "http://127.0.0.1:3000",
    "http://localhost:3000",
)


def _cors_origins() -> list[str]:
    configured = os.getenv("CAIRNWISE_CORS_ORIGINS")
    values = configured.split(",") if configured is not None else list(DEFAULT_CORS_ORIGINS)
    # A wildcard would make bearer-token browser requests unnecessarily broad.
    return [origin.strip() for origin in values if origin.strip() and origin.strip() != "*"]


def _problem_response(
    request: Request,
    *,
    status: int,
    title: str,
    detail: str,
    error_type: str = "about:blank",
    errors: list[dict[str, Any]] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    content: dict[str, Any] = {
        "type": error_type,
        "title": title,
        "status": status,
        "detail": detail,
        "instance": str(request.url),
    }
    if errors:
        content["errors"] = errors
    return JSONResponse(
        status_code=status,
        media_type="application/problem+json",
        content=content,
        headers=headers,
    )


def _payload(value: Any) -> dict[str, Any]:
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise DomainError(
            422,
            "Validation failed",
            "The request body must be a JSON object.",
            error_type="https://cairnwise.local/problems/validation",
        )
    if len(value) > MAX_BODY_KEYS:
        raise DomainError(
            422,
            "Validation failed",
            f"The request body may contain at most {MAX_BODY_KEYS} fields.",
            error_type="https://cairnwise.local/problems/validation",
        )
    return value


def _bounded_text(value: Any, field: str, *, required: bool = False, limit: int = MAX_TEXT_LENGTH) -> str | None:
    if value is None:
        if required:
            raise DomainError(
                422,
                "Validation failed",
                f"{field} is required.",
                error_type="https://cairnwise.local/problems/validation",
            )
        return None
    if not isinstance(value, str):
        raise DomainError(
            422,
            "Validation failed",
            f"{field} must be a string.",
            error_type="https://cairnwise.local/problems/validation",
        )
    text = value.strip()
    if required and not text:
        raise DomainError(
            422,
            "Validation failed",
            f"{field} is required.",
            error_type="https://cairnwise.local/problems/validation",
        )
    if len(text) > limit:
        raise DomainError(
            422,
            "Validation failed",
            f"{field} must be at most {limit} characters.",
            error_type="https://cairnwise.local/problems/validation",
        )
    return text


def _identifier(value: str, field: str = "id") -> str:
    if not isinstance(value, str) or not value or len(value) > MAX_IDENTIFIER_LENGTH:
        raise DomainError(404, "Resource not found", "The requested resource does not exist or is not available.")
    return value


def _not_found(title: str = "Resource not found") -> DomainError:
    return DomainError(
        404,
        title,
        "The requested resource does not exist or is not available.",
        error_type="https://cairnwise.local/problems/not-found",
    )


def _forbidden(detail: str = "The authenticated user is not allowed to perform this operation.") -> DomainError:
    return DomainError(
        403,
        "Forbidden",
        detail,
        error_type=AUTHORIZATION_PROBLEM,
    )


def _validate_workspace_payload(payload: dict[str, Any]) -> None:
    _bounded_text(payload.get("name"), "name", required=True, limit=200)


def _validate_brand_payload(payload: dict[str, Any]) -> None:
    _bounded_text(payload.get("name"), "name", required=True, limit=200)
    _bounded_text(payload.get("website"), "website", limit=2048)
    _bounded_text(payload.get("locale"), "locale", limit=32)
    regions = payload.get("regions")
    if regions is not None:
        if not isinstance(regions, list) or len(regions) > 50 or any(not isinstance(item, str) or len(item) > 32 for item in regions):
            raise DomainError(
                422,
                "Validation failed",
                "regions must be a list of at most 50 short strings.",
                error_type="https://cairnwise.local/problems/validation",
            )


def _validate_asset_payload(payload: dict[str, Any]) -> None:
    _bounded_text(payload.get("asset_type"), "asset_type", required=True, limit=32)
    for field, limit in (
        ("canonical_url", 2048),
        ("url", 2048),
        ("display_name", 256),
        ("name", 256),
        ("stable_external_id", 512),
        ("stable_id", 512),
        ("package_id", 512),
        ("platform", 128),
        ("store", 128),
        ("publisher", 512),
        ("description", 4096),
        ("scope", 512),
        ("authorization_state", 64),
        ("verification_source", 512),
    ):
        _bounded_text(payload.get(field), field, limit=limit)


def _validate_fixture_payload(payload: dict[str, Any]) -> None:
    for field in ("fixture_id", "value", "source_mode", "locale"):
        _bounded_text(payload.get(field), field, limit=256)


def _validate_intake_payload(payload: dict[str, Any]) -> None:
    for field, limit in (
        ("fixture_id", 256),
        ("value", 2048),
        ("url", 2048),
        ("listing_url", 2048),
        ("input_type", 64),
        ("asset_type", 64),
        ("source_mode", 64),
        ("locale", 32),
        ("store_id", 256),
        ("idempotency_key", 256),
        ("retention_class", 64),
    ):
        _bounded_text(payload.get(field), field, limit=limit)
    metadata = payload.get("metadata")
    if metadata is not None and not isinstance(metadata, dict):
        raise DomainError(
            422,
            "Validation failed",
            "metadata must be a JSON object.",
            error_type="https://cairnwise.local/problems/validation",
        )


def _validate_connector_run_payload(payload: dict[str, Any]) -> None:
    for field, limit in (
        ("connector_key", 128),
        ("operation", 128),
        ("query", 512),
        ("term", 512),
        ("listing_id", 128),
        ("store_id", 128),
        ("value", 512),
        ("country", 8),
        ("idempotency_key", 256),
    ):
        _bounded_text(payload.get(field), field, limit=limit)


def _validate_export_format(value: str | None) -> str:
    normalized = (value or "json").casefold()
    if normalized not in {"json", "csv"}:
        raise DomainError(422, "Unsupported export format", "format must be json or csv.")
    return normalized


def _validate_decision_payload(payload: dict[str, Any]) -> None:
    _bounded_text(payload.get("disposition"), "disposition", required=True, limit=128)
    _bounded_text(payload.get("reason"), "reason", required=True, limit=4096)
    _bounded_text(payload.get("request_id"), "request_id", limit=256)


def create_app(db_path: str | os.PathLike[str] | None = None) -> FastAPI:
    """Create an isolated Cairnwise app.

    The database connection is deliberately opened only inside the lifespan.
    Importing this module, constructing an app, and discovering its routes do
    not create a local database file or initialize global service state.
    """

    configured_path = db_path if db_path is not None else os.getenv("CAIRNWISE_DB_PATH")
    # Supabase is selected once per app instance.  Do not silently fall back
    # to local passwords when production verifier configuration is present.
    supabase_config = SupabaseConfig.from_env()

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        database = Database(configured_path)
        application.state.db = database
        application.state.service = CairnwiseService(database)
        application.state.auth = (
            SupabaseAuth(database, supabase_config)
            if supabase_config.enabled
            else LocalAuth(database)
        )
        application.state.auth_mode = "supabase_google_jwt" if supabase_config.enabled else "local_password_development"
        try:
            application.state.service.initialize()
            application.state.auth.initialize()
            application.state.ready = True
            yield
        finally:
            application.state.ready = False
            database.close()

    app = FastAPI(
        title="Cairnwise API",
        version="0.1.0-foundation",
        description="Evidence-first digital identity risk operations foundation.",
        lifespan=lifespan,
    )
    app.state.db_path = configured_path
    app.state.ready = False
    app.state.supabase_config = supabase_config
    app.state.auth_mode = "supabase_google_jwt" if supabase_config.enabled else "local_password_development"

    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins(),
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
    )

    @app.middleware("http")
    async def request_size_limit(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        raw_length = request.headers.get("content-length")
        if raw_length is not None:
            try:
                length = int(raw_length)
            except ValueError:
                return _problem_response(
                    request,
                    status=400,
                    title="Invalid request",
                    detail="Content-Length must be a valid integer.",
                    error_type="https://cairnwise.local/problems/validation",
                )
            if length > MAX_REQUEST_BYTES:
                return _problem_response(
                    request,
                    status=413,
                    title="Request too large",
                    detail=f"Request bodies are limited to {MAX_REQUEST_BYTES} bytes.",
                    error_type="https://cairnwise.local/problems/request-too-large",
                )
        return await call_next(request)

    @app.exception_handler(DomainError)
    async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
        return _problem_response(
            request,
            status=exc.status,
            title=exc.title,
            detail=exc.detail,
            error_type=exc.error_type,
        )

    @app.exception_handler(AuthError)
    async def auth_error_handler(request: Request, exc: AuthError) -> JSONResponse:
        return _problem_response(
            request,
            status=exc.status,
            title=exc.title,
            detail=exc.detail,
            error_type=exc.error_type,
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def request_validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        # Do not echo ``input`` from validation errors: a malformed auth body
        # must never reflect a submitted password or bearer token.
        errors = [
            {
                "loc": list(item.get("loc", ())),
                "msg": str(item.get("msg", "Invalid value.")),
                "type": str(item.get("type", "value_error")),
            }
            for item in exc.errors()
        ]
        return _problem_response(
            request,
            status=422,
            title="Validation failed",
            detail="The request body or path parameters are invalid.",
            error_type="https://cairnwise.local/problems/validation",
            errors=errors,
        )

    @app.exception_handler(HTTPException)
    async def http_error_handler(request: Request, exc: HTTPException) -> JSONResponse:
        return _problem_response(
            request,
            status=exc.status_code,
            title="HTTP error",
            detail=str(exc.detail),
            error_type="https://cairnwise.local/problems/http",
            headers=exc.headers,
        )

    def state(request: Request) -> tuple[Database, CairnwiseService, LocalAuth | SupabaseAuth]:
        try:
            if not request.app.state.ready:
                raise DomainError(503, "Service unavailable", "The local service has not started yet.")
            return request.app.state.db, request.app.state.service, request.app.state.auth
        except AttributeError as error:
            raise DomainError(503, "Service unavailable", "The local service has not started yet.") from error

    def current_user(request: Request) -> dict[str, Any]:
        _, _, auth = state(request)
        return auth.authenticate(request.headers.get("authorization"))

    def require_workspace(request: Request, workspace_id: str, minimum: str = "member") -> tuple[dict[str, Any], dict[str, Any]]:
        _, _, auth = state(request)
        user = current_user(request)
        workspace_id = _identifier(workspace_id, "workspace_id")
        membership = auth.membership(workspace_id, user["id"])
        if not membership or membership["status"] != "active":
            # Missing membership and a non-existent workspace are intentionally
            # indistinguishable to prevent cross-tenant enumeration.
            raise _not_found("Workspace not found")
        if not auth.role_allows(membership["role"], minimum):
            raise _forbidden()
        return user, membership

    def resolve_brand(request: Request, brand_id: str, minimum: str = "member") -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
        database, _, _ = state(request)
        # Authenticate before touching the object table so an unauthenticated
        # caller cannot turn object existence into an enumeration oracle.
        current_user(request)
        brand_id = _identifier(brand_id, "brand_id")
        row = database.fetch_one("SELECT id, workspace_id FROM brands WHERE id = ?", (brand_id,))
        if not row:
            raise _not_found("Brand not found")
        user, membership = require_workspace(request, row["workspace_id"], minimum)
        return user, membership, dict(row)

    def resolve_candidate(request: Request, candidate_id: str, minimum: str = "member") -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
        database, _, _ = state(request)
        current_user(request)
        candidate_id = _identifier(candidate_id, "candidate_id")
        row = database.fetch_one(
            """
            SELECT c.id, c.brand_id, b.workspace_id
            FROM candidates c
            JOIN brands b ON b.id = c.brand_id
            WHERE c.id = ?
            """,
            (candidate_id,),
        )
        if not row:
            raise _not_found("Candidate not found")
        user, membership = require_workspace(request, row["workspace_id"], minimum)
        return user, membership, dict(row)

    def resolve_case(request: Request, case_id: str, minimum: str = "member") -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
        database, _, _ = state(request)
        current_user(request)
        case_id = _identifier(case_id, "case_id")
        row = database.fetch_one(
            """
            SELECT cs.id, cs.candidate_id, cs.brand_id, b.workspace_id
            FROM cases cs
            JOIN candidates c ON c.id = cs.candidate_id
            JOIN brands b ON b.id = c.brand_id
            WHERE cs.id = ? AND cs.brand_id = b.id
            """,
            (case_id,),
        )
        if not row:
            raise _not_found("Case not found")
        user, membership = require_workspace(request, row["workspace_id"], minimum)
        return user, membership, dict(row)

    def resolve_run(request: Request, run_id: str, minimum: str = "member") -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
        database, _, _ = state(request)
        current_user(request)
        run_id = _identifier(run_id, "run_id")
        row = database.fetch_one(
            """
            SELECT sr.id, sr.brand_id, sr.workspace_id, b.workspace_id AS resolved_workspace_id
            FROM source_runs sr
            JOIN brands b ON b.id = sr.brand_id
            WHERE sr.id = ?
            """,
            (run_id,),
        )
        if not row:
            raise _not_found("Source run not found")
        workspace_id = row["resolved_workspace_id"]
        if workspace_id != row["workspace_id"]:
            raise _not_found("Source run not found")
        user, membership = require_workspace(request, workspace_id, minimum)
        return user, membership, dict(row)

    def require_global_role(request: Request, minimum: str = "admin") -> dict[str, Any]:
        database, _, auth = state(request)
        user = current_user(request)
        rows = database.fetch_all(
            """
            SELECT role FROM workspace_members
            WHERE user_id = ? AND status = 'active'
            """,
            (user["id"],),
        )
        if not rows or not any(auth.role_allows(row["role"], minimum) for row in rows):
            raise _forbidden()
        return user

    def actor(user: dict[str, Any]) -> str:
        # This value is server-derived and cannot be replaced by a request
        # header or a body field.
        return user["id"]

    @app.get("/", include_in_schema=False)
    def landing_page() -> FileResponse:
        path = ROOT / "index.html"
        if not path.is_file():
            raise _not_found("Landing page not found")
        return FileResponse(path)

    @app.get("/workspace", include_in_schema=False)
    @app.get("/workspace.html", include_in_schema=False)
    @app.get("/api-review", include_in_schema=False)
    def workspace_page() -> FileResponse:
        path = ROOT / "workspace.html"
        if not path.is_file():
            raise _not_found("Workspace page not found")
        return FileResponse(path)

    @app.get("/health")
    def health(request: Request) -> dict[str, Any]:
        _, service, _ = state(request)
        result = service.health()
        result["authentication"] = request.app.state.auth_mode
        result["authorization"] = "workspace_membership_roles"
        return result

    @app.get("/v1/auth/config")
    def auth_config(request: Request) -> dict[str, Any]:
        # This endpoint intentionally does not call ``state``: the browser
        # needs public provider metadata before it has a session, and config
        # discovery must not initialize or expose the local database.
        configured = request.app.state.supabase_config
        origin = configured.redirect_origin or f"{request.url.scheme}://{request.url.netloc}"
        return configured.public_config(redirect_origin=origin)

    @app.post("/v1/auth/register", status_code=201)
    def register(request: Request, payload: Any = Body(default=None)) -> dict[str, Any]:
        _, _, auth = state(request)
        body = _payload(payload)
        username = body.get("username", body.get("email"))
        return auth.register(username, body.get("password"))

    @app.post("/v1/auth/login")
    def login(request: Request, payload: Any = Body(default=None)) -> dict[str, Any]:
        _, _, auth = state(request)
        body = _payload(payload)
        username = body.get("username", body.get("email"))
        return auth.login(username, body.get("password"))

    @app.post("/v1/auth/logout")
    def logout(request: Request) -> dict[str, Any]:
        _, _, auth = state(request)
        current_user(request)
        return auth.logout(request.headers.get("authorization"))

    @app.get("/v1/auth/me")
    def me(request: Request) -> dict[str, Any]:
        _, _, auth = state(request)
        user = current_user(request)
        return auth.me(user["id"])

    @app.get("/v1/dev/state")
    def dev_state(request: Request) -> dict[str, Any]:
        database, _, _ = state(request)
        user = current_user(request)
        rows = database.fetch_all(
            """
            SELECT w.id, w.name, w.status, w.created_at, wm.role
            FROM workspace_members wm
            JOIN workspaces w ON w.id = wm.workspace_id
            WHERE wm.user_id = ? AND wm.status = 'active'
            ORDER BY w.created_at
            """,
            (user["id"],),
        )
        return {"development_mode": True, "user_id": user["id"], "workspaces": [dict(row) for row in rows]}

    @app.post("/v1/dev/seed", status_code=200)
    def seed_demo(request: Request, payload: Any = Body(default=None)) -> dict[str, Any]:
        database, service, auth = state(request)
        user = current_user(request)
        body = _payload(payload)
        requested_workspace = body.get("workspace_id")
        if requested_workspace is not None:
            requested_workspace = _bounded_text(requested_workspace, "workspace_id", required=True, limit=MAX_IDENTIFIER_LENGTH)
            _, membership = require_workspace(request, requested_workspace, "admin")
            workspace_id = membership["workspace_id"]
            workspace = service.get_workspace(workspace_id)
        else:
            workspace_name = body.get("name") or f"Northstar Pay / Local Verification ({user['username']})"
            workspace_name = _bounded_text(workspace_name, "name", required=True, limit=200)
            existing_workspace = database.fetch_one(
                """
                SELECT w.id
                FROM workspaces w
                JOIN workspace_members wm ON wm.workspace_id = w.id
                WHERE wm.user_id = ? AND wm.role = 'owner' AND wm.status = 'active' AND w.name = ?
                ORDER BY w.created_at LIMIT 1
                """,
                (user["id"], workspace_name),
            )
            if existing_workspace:
                workspace_id = existing_workspace["id"]
                workspace = service.get_workspace(workspace_id)
            else:
                workspace = service.create_workspace({"name": workspace_name})
                workspace_id = workspace["id"]
                auth.add_membership(workspace_id, user["id"], "owner")

        existing_brand = database.fetch_one(
            "SELECT id FROM brands WHERE workspace_id = ? AND canonical_name = ?",
            (workspace_id, compact_name("Northstar Pay")),
        )
        if existing_brand:
            brand_id = existing_brand["id"]
            reused = True
        else:
            brand = service.create_brand(
                workspace_id,
                {
                    "name": "Northstar Pay",
                    "website": "https://northstarpay.example",
                    "locale": "en-IN",
                    "regions": ["IN", "EU"],
                },
            )
            brand_id = brand["id"]
            reused = False
            service.add_asset(
                brand_id,
                {
                    "asset_type": "logo",
                    "display_name": "Northstar Pay primary logo",
                    "authorization_state": "authorized",
                    "metadata": {"fingerprint": "northstar-logo-v1", "retention": "metadata_only"},
                    "verification_source": "fictional local fixture",
                },
                actor=actor(user),
            )
            service.add_asset(
                brand_id,
                {
                    "asset_type": "social_profile",
                    "platform": "fixture_social",
                    "canonical_url": "https://social.example/northstarpay",
                    "stable_external_id": "did:example:northstar-official",
                    "display_name": "Northstar Pay",
                    "authorization_state": "authorized",
                    "metadata": {"handle": "northstarpay", "avatar_hash": "northstar-logo-v1"},
                    "verification_source": "fictional local fixture",
                },
                actor=actor(user),
            )
            service.add_asset(
                brand_id,
                {
                    "asset_type": "social_profile",
                    "platform": "fixture_social",
                    "canonical_url": "https://social.example/northstar-rewards-eu",
                    "stable_external_id": "did:example:northstar-rewards-eu",
                    "display_name": "Northstar Rewards EU",
                    "authorization_state": "authorized_with_scope",
                    "scope": "EU rewards partner",
                    "metadata": {"handle": "northstarrewardseu", "avatar_hash": "northstar-rewards-logo"},
                    "verification_source": "fictional local fixture",
                },
                actor=actor(user),
            )
            service.add_asset(
                brand_id,
                {
                    "asset_type": "mobile_app",
                    "store": "fixture_app_store",
                    "canonical_url": "https://apps.example/northstar-pay-mobile",
                    "stable_external_id": "com.northstar.pay",
                    "package_id": "com.northstar.pay",
                    "display_name": "Northstar Pay Mobile",
                    "publisher": "Northstar Payments Ltd",
                    "description": "The official Northstar Pay mobile application.",
                    "authorization_state": "authorized",
                    "metadata": {"store_id": "10001", "icon_hash": "northstar-app-icon-v1"},
                    "verification_source": "fictional local fixture",
                },
                actor=actor(user),
            )
        return {
            "workspace": service.get_workspace(workspace_id),
            "brand": service.get_brand(brand_id),
            "assets": service.list_assets(brand_id),
            "source_mode": "synthetic_fixture",
            "fixture_notice": "Offline fixture — not live coverage.",
            "reused": reused,
        }

    @app.post("/v1/workspaces", status_code=201)
    def create_workspace(request: Request, payload: Any = Body(default=None)) -> dict[str, Any]:
        _, service, auth = state(request)
        user = current_user(request)
        body = _payload(payload)
        _validate_workspace_payload(body)
        workspace = service.create_workspace(body)
        auth.add_membership(workspace["id"], user["id"], "owner")
        return {**workspace, "role": "owner"}

    @app.get("/v1/workspaces/{workspace_id}")
    def get_workspace(request: Request, workspace_id: str) -> dict[str, Any]:
        _, service, _ = state(request)
        _, _ = require_workspace(request, workspace_id, "member")
        return service.get_workspace(_identifier(workspace_id, "workspace_id"))

    @app.get("/v1/workspaces/{workspace_id}/brands")
    def list_brands(request: Request, workspace_id: str) -> dict[str, Any]:
        _, service, _ = state(request)
        _, _ = require_workspace(request, workspace_id, "member")
        return {"items": service.list_brands(_identifier(workspace_id, "workspace_id"))}

    @app.post("/v1/workspaces/{workspace_id}/brands", status_code=201)
    def create_brand(request: Request, workspace_id: str, payload: Any = Body(default=None)) -> dict[str, Any]:
        _, service, _ = state(request)
        _, _ = require_workspace(request, workspace_id, "admin")
        body = _payload(payload)
        _validate_brand_payload(body)
        return service.create_brand(_identifier(workspace_id, "workspace_id"), body)

    @app.get("/v1/brands/{brand_id}")
    def get_brand(request: Request, brand_id: str) -> dict[str, Any]:
        _, service, _ = state(request)
        _, _, row = resolve_brand(request, brand_id, "member")
        return service.get_brand(row["id"])

    @app.get("/v1/brands/{brand_id}/assets")
    def list_assets(request: Request, brand_id: str) -> dict[str, Any]:
        _, service, _ = state(request)
        _, _, row = resolve_brand(request, brand_id, "member")
        return {"items": service.list_assets(row["id"])}

    @app.post("/v1/brands/{brand_id}/assets", status_code=201)
    def add_asset(request: Request, brand_id: str, payload: Any = Body(default=None)) -> dict[str, Any]:
        _, service, _ = state(request)
        user, _, row = resolve_brand(request, brand_id, "admin")
        body = _payload(payload)
        _validate_asset_payload(body)
        return service.add_asset(row["id"], body, actor=actor(user))

    @app.get("/v1/brands/{brand_id}/candidates")
    def list_candidates(request: Request, brand_id: str) -> dict[str, Any]:
        _, service, _ = state(request)
        _, _, row = resolve_brand(request, brand_id, "member")
        return {"items": service.list_candidates(row["id"])}

    @app.post("/v1/brands/{brand_id}/candidates/intake", status_code=201)
    def intake_candidate(
        request: Request,
        brand_id: str,
        payload: Any = Body(default=None),
        idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    ) -> dict[str, Any]:
        _, service, _ = state(request)
        user, _, row = resolve_brand(request, brand_id, "analyst")
        body = _payload(payload)
        _validate_intake_payload(body)
        key = _bounded_text(idempotency_key or body.get("idempotency_key"), "Idempotency-Key", limit=256)
        source_mode = str(body.get("source_mode") or "synthetic_fixture").strip()
        if source_mode == "user_submitted":
            return service.intake_user_submitted(row["id"], body, idempotency_key=key, actor=actor(user))
        if source_mode != "synthetic_fixture":
            raise DomainError(
                422,
                "Unsupported source mode",
                "Use synthetic_fixture for offline fixtures or user_submitted for declared URL/listing intake.",
                error_type="https://cairnwise.local/problems/unsupported-source",
            )
        return service.intake_fixture(row["id"], body, idempotency_key=key, actor=actor(user))

    @app.post("/v1/brands/{brand_id}/connector-runs", status_code=201)
    def connector_run(request: Request, brand_id: str, payload: Any = Body(default=None)) -> dict[str, Any]:
        _, service, _ = state(request)
        user, _, row = resolve_brand(request, brand_id, "analyst")
        body = _payload(payload)
        if body.get("connector_key"):
            _validate_connector_run_payload(body)
            key = _bounded_text(
                body.get("idempotency_key") or request.headers.get("idempotency-key"),
                "idempotency_key",
                limit=256,
            )
            return service.run_connector(row["id"], body, idempotency_key=key, actor=actor(user))
        fixture_ids = body.get("fixture_ids")
        if fixture_ids is None:
            fixture_ids = [body.get("fixture_id") or body.get("value")]
        if not isinstance(fixture_ids, list) or len(fixture_ids) > 50:
            raise DomainError(422, "Validation failed", "fixture_ids must contain at most 50 values.", error_type="https://cairnwise.local/problems/validation")
        normalized_fixture_ids: list[str] = []
        for fixture_id in fixture_ids:
            value = _bounded_text(fixture_id, "fixture_id", required=True, limit=256)
            normalized_fixture_ids.append(value or "")
        if not normalized_fixture_ids:
            raise DomainError(
                422,
                "Validation failed",
                "fixture_id or fixture_ids is required.",
                error_type="https://cairnwise.local/problems/validation",
            )
        base_key = body.get("idempotency_key") or request.headers.get("idempotency-key") or "run"
        base_key = _bounded_text(base_key, "idempotency_key", required=True, limit=256)
        source_mode = body.get("source_mode", "synthetic_fixture")
        source_mode = _bounded_text(source_mode, "source_mode", required=True, limit=64)
        results = []
        for index, fixture_id in enumerate(normalized_fixture_ids):
            results.append(
                service.intake_fixture(
                    row["id"],
                    {"fixture_id": fixture_id, "source_mode": source_mode},
                    idempotency_key=f"{base_key}-{index}",
                    actor=actor(user),
                )
            )
        return {"brand_id": row["id"], "items": results, "source_mode": source_mode}

    @app.get("/v1/connector-runs/{run_id}")
    def get_connector_run(request: Request, run_id: str) -> dict[str, Any]:
        _, service, _ = state(request)
        _, _, row = resolve_run(request, run_id, "member")
        return service.get_source_run(row["id"])

    @app.get("/v1/candidates/{candidate_id}")
    def get_candidate(request: Request, candidate_id: str) -> dict[str, Any]:
        _, service, _ = state(request)
        _, _, row = resolve_candidate(request, candidate_id, "member")
        return service.get_candidate(row["id"])

    @app.post("/v1/candidates/{candidate_id}/assessments", status_code=201)
    def assess_candidate(request: Request, candidate_id: str) -> dict[str, Any]:
        _, service, _ = state(request)
        user, _, row = resolve_candidate(request, candidate_id, "analyst")
        return service.assess_candidate(row["id"], actor=actor(user))

    @app.get("/v1/candidates/{candidate_id}/evidence")
    def get_candidate_evidence(request: Request, candidate_id: str) -> dict[str, Any]:
        _, service, _ = state(request)
        _, _, row = resolve_candidate(request, candidate_id, "member")
        candidate = service.get_candidate(row["id"])
        return {
            "candidate_id": row["id"],
            "items": candidate.get("evidence", []),
            "evidence_mode": (candidate.get("latest_observation") or {}).get("source_mode"),
        }

    @app.get("/v1/candidates/{candidate_id}/evidence/export", response_model=None)
    def export_candidate_evidence(
        request: Request,
        candidate_id: str,
        format: str = Query(default="json"),
    ) -> Response | dict[str, Any]:
        _, service, _ = state(request)
        user, _, row = resolve_candidate(request, candidate_id, "member")
        export_format = _validate_export_format(format)
        result = service.export_candidate_evidence(
            row["id"],
            export_format=export_format,
            actor=actor(user),
            request_id=request.headers.get("X-Request-Id"),
        )
        if export_format == "csv":
            return Response(
                content=result["content"],
                media_type="text/csv",
                headers={
                    "Content-Disposition": f'attachment; filename="cairnwise-evidence-{row["id"]}.csv"',
                    "X-Cairnwise-Export-Hash": result["export_hash"],
                    "X-Cairnwise-Audit-Event": result["audit_event_id"],
                },
            )
        return result

    @app.post("/v1/candidates/{candidate_id}/cases", status_code=201)
    def create_case(request: Request, candidate_id: str, payload: Any = Body(default=None)) -> dict[str, Any]:
        _, service, _ = state(request)
        user, _, row = resolve_candidate(request, candidate_id, "analyst")
        body = _payload(payload)
        _bounded_text(body.get("request_id"), "request_id", limit=256)
        service_payload = dict(body)
        # A caller may not assign a case to an arbitrary actor through the
        # payload; assignment is derived from the authenticated principal.
        service_payload["owner"] = actor(user)
        return service.create_case(row["id"], service_payload, actor=actor(user))

    @app.get("/v1/cases/{case_id}")
    def get_case(request: Request, case_id: str) -> dict[str, Any]:
        _, service, _ = state(request)
        _, _, row = resolve_case(request, case_id, "member")
        return service.get_case(row["id"])

    @app.post("/v1/cases/{case_id}/decisions")
    def record_decision(request: Request, case_id: str, payload: Any = Body(default=None)) -> dict[str, Any]:
        _, service, _ = state(request)
        user, membership, row = resolve_case(request, case_id, "analyst")
        body = _payload(payload)
        _validate_decision_payload(body)
        disposition = body.get("disposition")
        if disposition == "confirmed_impersonation_under_policy":
            if not LocalAuth.role_allows(membership["role"], "reviewer"):
                raise _forbidden("A stored reviewer, admin, or owner membership is required for this disposition.")
            # The service has a legacy UI-shaped guard.  Only after the stored
            # role check succeeds do we satisfy it server-side; the request's
            # reviewer_approved field is never treated as authorization.
            service_payload = dict(body)
            service_payload["reviewer_approved"] = True
        else:
            service_payload = dict(body)
        return service.record_decision(row["id"], service_payload, actor=actor(user))

    @app.post("/v1/cases/{case_id}/report-drafts", status_code=201)
    def create_report_draft(request: Request, case_id: str) -> dict[str, Any]:
        _, service, _ = state(request)
        user, _, row = resolve_case(request, case_id, "analyst")
        return service.create_report_draft(row["id"], actor=actor(user))

    @app.get("/v1/brands/{brand_id}/coverage")
    def coverage(request: Request, brand_id: str) -> dict[str, Any]:
        _, service, _ = state(request)
        _, _, row = resolve_brand(request, brand_id, "member")
        return service.coverage(row["id"])

    @app.get("/v1/workspaces/{workspace_id}/retention/preview")
    def retention_preview(request: Request, workspace_id: str) -> dict[str, Any]:
        _, service, _ = state(request)
        require_workspace(request, workspace_id, "admin")
        return service.retention_preview(_identifier(workspace_id, "workspace_id"))

    @app.post("/v1/workspaces/{workspace_id}/retention/delete")
    def retention_delete(
        request: Request,
        workspace_id: str,
        payload: Any = Body(default=None),
    ) -> dict[str, Any]:
        _, service, _ = state(request)
        user, _ = require_workspace(request, workspace_id, "admin")
        body = _payload(payload)
        confirm = body.get("confirm")
        if confirm is not True:
            raise DomainError(409, "Explicit confirmation required", "Retention deletion requires confirm=true.")
        _bounded_text(body.get("as_of"), "as_of", limit=64)
        _bounded_text(body.get("request_id"), "request_id", limit=256)
        return service.execute_retention(
            _identifier(workspace_id, "workspace_id"),
            actor=actor(user),
            confirm=True,
            as_of=body.get("as_of"),
            request_id=body.get("request_id") or request.headers.get("X-Request-Id"),
        )

    @app.post("/v1/workspaces/{workspace_id}/retention/legal-holds")
    def legal_hold(request: Request, workspace_id: str, payload: Any = Body(default=None)) -> dict[str, Any]:
        _, service, _ = state(request)
        user, _ = require_workspace(request, workspace_id, "admin")
        body = _payload(payload)
        object_type = _bounded_text(body.get("object_type"), "object_type", required=True, limit=32)
        object_id = _bounded_text(body.get("object_id"), "object_id", required=True, limit=128)
        reason = _bounded_text(body.get("reason"), "reason", required=True, limit=4096)
        hold = body.get("hold")
        if not isinstance(hold, bool):
            raise DomainError(422, "Validation failed", "hold must be a boolean.")
        return service.set_legal_hold(
            _identifier(workspace_id, "workspace_id"),
            object_type or "",
            object_id or "",
            hold=hold,
            actor=actor(user),
            reason=reason or "",
            request_id=body.get("request_id") or request.headers.get("X-Request-Id"),
        )

    @app.get("/v1/connector-manifests")
    def connector_manifests(request: Request) -> dict[str, Any]:
        _, service, _ = state(request)
        require_global_role(request, "admin")
        return {"items": service.connector_manifests()}

    @app.get("/v1/health/connectors")
    def connector_health(request: Request) -> dict[str, Any]:
        database, _, _ = state(request)
        require_global_role(request, "admin")
        rows = database.fetch_all(
            "SELECT connector_key, source, asset_type, enabled, manifest_json, rights_json FROM connectors ORDER BY connector_key"
        )
        import json

        result = []
        for row in rows:
            item = dict(row)
            item["manifest"] = json.loads(item.pop("manifest_json"))
            item["rights"] = json.loads(item.pop("rights_json") or "{}")
            item["source_status"] = "enabled" if item["enabled"] else "disabled"
            result.append(item)
        return {"items": result, "source_mode": "mixed_fixture_and_permitted_contracts"}

    return app


# Uvicorn imports this object by dotted path.  It is only an ASGI route graph;
# database creation and schema initialization happen when its lifespan starts.
app = create_app()


__all__ = ["app", "create_app"]
