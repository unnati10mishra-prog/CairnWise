from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time

from fastapi.testclient import TestClient

from cairnwise.api import create_app
from cairnwise.auth import SupabaseAuth, SupabaseConfig


def _segment(value: object) -> str:
    return base64.urlsafe_b64encode(json.dumps(value, separators=(",", ":")).encode()).decode().rstrip("=")


def _hs256_token(claims: dict, secret: str = "test-secret", *, algorithm: str = "HS256") -> str:
    header = _segment({"alg": algorithm, "typ": "JWT"})
    payload = _segment(claims)
    signing_input = f"{header}.{payload}"
    signature = hmac.new(secret.encode(), signing_input.encode(), hashlib.sha256).digest()
    encoded_signature = base64.urlsafe_b64encode(signature).decode().rstrip("=")
    return f"{signing_input}.{encoded_signature}"


def test_config_absent_keeps_explicit_local_development_fallback(monkeypatch) -> None:
    for name in (
        "CAIRNWISE_SUPABASE_URL",
        "CAIRNWISE_SUPABASE_JWT_SECRET",
        "CAIRNWISE_SUPABASE_JWKS_URL",
        "CAIRNWISE_SUPABASE_ANON_KEY",
        "CAIRNWISE_SUPABASE_PUBLISHABLE_KEY",
        "CAIRNWISE_SUPABASE_JWT_AUDIENCE",
        "CAIRNWISE_SUPABASE_JWT_ISSUER",
        "CAIRNWISE_SUPABASE_REDIRECT_ORIGIN",
    ):
        monkeypatch.delenv(name, raising=False)

    app = create_app(":memory:")
    with TestClient(app) as client:
        config = client.get("/v1/auth/config")
        assert config.status_code == 200
        assert config.json() == {
            "enabled": False,
            "supabase_url": None,
            "provider": "google",
            "redirect_origin": "http://testserver",
        }
        registered = client.post(
            "/v1/auth/register",
            json={"username": "local-dev", "password": "correct-horse-123"},
        )
        assert registered.status_code == 201
        assert app.state.auth.__class__.__name__ == "LocalAuth"


def test_supabase_mode_rejects_unsigned_and_bad_signature_tokens(monkeypatch) -> None:
    monkeypatch.setenv("CAIRNWISE_SUPABASE_URL", "https://demo.supabase.co")
    monkeypatch.setenv("CAIRNWISE_SUPABASE_JWT_SECRET", "test-secret")
    app = create_app(":memory:")
    claims = {
        "iss": "https://demo.supabase.co/auth/v1",
        "aud": "authenticated",
        "exp": time.time() + 300,
        "sub": "supabase-subject",
    }
    unsigned = f"{_segment({'alg': 'none', 'typ': 'JWT'})}.{_segment(claims)}."
    bad_signature = _hs256_token(claims, "wrong-secret")

    with TestClient(app) as client:
        assert client.post("/v1/auth/register", json={"username": "local-dev", "password": "correct-horse-123"}).status_code == 403
        for token in (unsigned, bad_signature):
            response = client.get("/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
            assert response.status_code == 401
            assert response.json()["type"].endswith("/authentication")


def test_public_config_redacts_server_verifiers(monkeypatch) -> None:
    monkeypatch.setenv("CAIRNWISE_SUPABASE_URL", "https://demo.supabase.co/")
    monkeypatch.setenv("CAIRNWISE_SUPABASE_JWT_SECRET", "server-only-secret")
    monkeypatch.setenv("CAIRNWISE_SUPABASE_JWKS_URL", "https://demo.supabase.co/auth/v1/.well-known/jwks.json")
    monkeypatch.setenv("CAIRNWISE_SUPABASE_ANON_KEY", "public-anon-key")
    monkeypatch.setenv("CAIRNWISE_SUPABASE_REDIRECT_ORIGIN", "https://app.example")

    app = create_app(":memory:")
    with TestClient(app) as client:
        body = client.get("/v1/auth/config").json()
    assert body == {
        "enabled": True,
        "supabase_url": "https://demo.supabase.co",
        "anon_key": "public-anon-key",
        "provider": "google",
        "redirect_origin": "https://app.example",
    }
    serialized = json.dumps(body)
    assert "server-only-secret" not in serialized
    assert "jwks.json" not in serialized
    assert "jwt_secret" not in body
    assert "jwks_url" not in body


def test_verified_claim_adapter_upserts_user_and_resolves_stored_role(monkeypatch) -> None:
    monkeypatch.setenv("CAIRNWISE_SUPABASE_URL", "https://demo.supabase.co")
    monkeypatch.setenv("CAIRNWISE_SUPABASE_JWT_SECRET", "production-secret")
    app = create_app(":memory:")
    claims = {
        "iss": "https://demo.supabase.co/auth/v1",
        "aud": "authenticated",
        "exp": time.time() + 300,
        "sub": "verified-subject",
        "email": "reviewer@example.com",
        "user_metadata": {"full_name": "Verified Reviewer"},
    }

    with TestClient(app) as client:
        # This adapter stands in for a verifier that has already checked the
        # signature.  The production app never supplies token_verifier.
        app.state.auth = SupabaseAuth(
            app.state.db,
            SupabaseConfig.from_env(),
            token_verifier=lambda token: claims if token == "fake-verified-token" else {},
        )
        app.state.auth.initialize()
        user = app.state.auth.authenticate("Bearer fake-verified-token")
        workspace = app.state.service.create_workspace({"name": "Reviewer workspace"})
        app.state.auth.add_membership(workspace["id"], user["id"], "reviewer")

        response = client.get(
            "/v1/auth/me",
            headers={"Authorization": "Bearer fake-verified-token"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["user"]["email"] == "reviewer@example.com"
        assert body["user"]["display_name"] == "Verified Reviewer"
        assert body["user"]["auth_provider"] == "supabase"
        assert body["workspaces"] == [
            {
                "workspace_id": workspace["id"],
                "role": "reviewer",
                "status": "active",
                "name": "Reviewer workspace",
                "workspace_status": "active",
            }
        ]
