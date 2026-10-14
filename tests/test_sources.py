from __future__ import annotations

import json
import socket
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from cairnwise.api import create_app
from cairnwise.connectors import (
    APPLE_CONNECTOR_KEY,
    BLUESKY_CONNECTOR_KEY,
    ConnectorRegistry,
)
from cairnwise.source_security import (
    BoundedHTTPFetcher,
    FetchLimits,
    SourceSecurityError,
    canonicalize_url,
)


def _register(client: TestClient, username: str, password: str = "correct-horse-123") -> dict:
    response = client.post("/v1/auth/register", json={"username": username, "password": password})
    assert response.status_code == 201, response.text
    body = response.json()
    return {
        "user": body["user"],
        "token": body["access_token"],
        "headers": {"Authorization": f"Bearer {body['access_token']}"},
    }


def _seed(client: TestClient, username: str) -> dict:
    identity = _register(client, username)
    response = client.post("/v1/dev/seed", headers=identity["headers"])
    assert response.status_code == 200, response.text
    return {**identity, **response.json()}


def _public_resolver(*args, **kwargs):
    return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))]


@pytest.mark.parametrize(
    "value,code",
    [
        ("http://localhost/admin", "blocked_host"),
        ("http://127.0.0.1:8080/admin", "blocked_ip"),
        ("http://192.168.10.4/private", "blocked_ip"),
        ("http://[::1]/admin", "blocked_ip"),
        ("http://[fe80::1]/admin", "blocked_ip"),
        ("http://169.254.169.254/latest/meta-data", "blocked_ip"),
        ("https://user:secret@example.com/private", "credentials_not_allowed"),
        ("file:///etc/passwd", "unsupported_scheme"),
        ("ftp://example.com/file", "unsupported_scheme"),
    ],
)
def test_user_source_url_rejects_ssrf_targets_and_unsupported_schemes(value: str, code: str) -> None:
    with pytest.raises(SourceSecurityError) as error:
        canonicalize_url(value)
    assert error.value.code == code


def test_source_fetcher_enforces_size_content_type_redirect_and_credential_policies() -> None:
    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        if request.url.path == "/too-large":
            return httpx.Response(200, headers={"content-type": "application/json", "content-length": "11"}, content=b"01234567890")
        if request.url.path == "/xml":
            return httpx.Response(200, headers={"content-type": "application/xml"}, content=b"<xml/>")
        if request.url.path == "/redirect":
            return httpx.Response(302, headers={"location": "https://safe.example/final"})
        if request.url.path == "/final":
            return httpx.Response(200, headers={"content-type": "application/json"}, content=b"{\"ok\":1}")
        return httpx.Response(302, headers={"location": "https://safe.example/redirect"})

    transport = httpx.MockTransport(handler)
    limited = BoundedHTTPFetcher(
        limits=FetchLimits(max_response_bytes=10, max_redirects=1),
        transport=transport,
        resolver=_public_resolver,
    )
    too_large = limited.fetch("https://safe.example/too-large")
    assert too_large.error_code == "response_too_large"
    assert too_large.availability == "unavailable"

    unsupported = limited.fetch("https://safe.example/xml")
    assert unsupported.availability == "unsupported"
    assert unsupported.error_code == "unsupported_content_type"

    redirected = limited.fetch("https://safe.example/redirect")
    assert redirected.available is True
    assert redirected.final_url == "https://safe.example/final"
    assert redirected.redirect_chain == ["https://safe.example/final"]
    assert "authorization" not in {key.casefold() for key in calls[-1].headers}
    assert "cookie" not in {key.casefold() for key in calls[-1].headers}

    redirect_limited = BoundedHTTPFetcher(
        limits=FetchLimits(max_response_bytes=100, max_redirects=0),
        transport=transport,
        resolver=_public_resolver,
    )
    exceeded = redirect_limited.fetch("https://safe.example/redirect")
    assert exceeded.error_code == "redirect_limit"
    assert exceeded.availability == "unavailable"


def test_private_redirect_is_rejected_before_network_request() -> None:
    called = False

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal called
        called = True
        return httpx.Response(302, headers={"location": "http://127.0.0.1/internal"})

    fetcher = BoundedHTTPFetcher(
        transport=httpx.MockTransport(handler),
        resolver=_public_resolver,
    )
    with pytest.raises(SourceSecurityError) as error:
        fetcher.fetch("https://safe.example/start")
    assert error.value.code == "blocked_ip"
    assert called is True


def test_connector_contracts_are_disabled_until_explicitly_enabled_and_mocked_requests_work() -> None:
    disabled = ConnectorRegistry(environ={})
    assert disabled.manifest(BLUESKY_CONNECTOR_KEY)["enabled"] is False
    assert disabled.manifest(APPLE_CONNECTOR_KEY)["enabled"] is False
    with pytest.raises(Exception) as error:
        disabled.adapter(BLUESKY_CONNECTOR_KEY)
    assert "not explicitly enabled" in str(error.value)

    def handler(request: httpx.Request) -> httpx.Response:
        if "bsky" in request.url.host:
            return httpx.Response(
                200,
                headers={"content-type": "application/json"},
                json={"actors": [{"did": "did:plc:123", "handle": "northstar.example", "displayName": "Northstar"}]},
            )
        return httpx.Response(
            200,
            headers={"content-type": "application/json"},
            json={"resultCount": 1, "results": [{"trackId": 123, "trackName": "Northstar", "bundleId": "com.example.app", "sellerName": "Example"}]},
        )

    environ = {"CAIRNWISE_ENABLED_CONNECTORS": f"{BLUESKY_CONNECTOR_KEY},{APPLE_CONNECTOR_KEY}"}
    enabled = ConnectorRegistry(environ=environ, transport=httpx.MockTransport(handler))
    bluesky = enabled.adapter(BLUESKY_CONNECTOR_KEY)
    bluesky.fetcher.resolver = _public_resolver
    result = bluesky.run("search_profiles", query="northstar")
    assert result.available is True
    assert result.records[0]["stable_id"] == "did:plc:123"


def test_api_manifest_disabled_state_and_safe_user_submitted_metadata_path() -> None:
    app = create_app(":memory:")
    with TestClient(app) as client:
        tenant = _seed(client, "source-owner")
        manifests = client.get("/v1/connector-manifests", headers=tenant["headers"])
        assert manifests.status_code == 200, manifests.text
        by_key = {item["connector_key"]: item for item in manifests.json()["items"]}
        assert by_key[BLUESKY_CONNECTOR_KEY]["enabled"] is False
        assert by_key[BLUESKY_CONNECTOR_KEY]["source_rights_status"] == "disabled"
        assert by_key[APPLE_CONNECTOR_KEY]["enabled"] is False

        disabled_run = client.post(
            f"/v1/brands/{tenant['brand']['id']}/connector-runs",
            headers=tenant["headers"],
            json={"connector_key": BLUESKY_CONNECTOR_KEY, "operation": "search_profiles", "query": "northstar"},
        )
        assert disabled_run.status_code == 201, disabled_run.text
        assert disabled_run.json()["availability"] == "unavailable"
        assert disabled_run.json()["source_status"] == "unavailable"

        intake = client.post(
            f"/v1/brands/{tenant['brand']['id']}/candidates/intake",
            headers=tenant["headers"],
            json={
                "source_mode": "user_submitted",
                "input_type": "profile_url",
                "value": "https://social.example/northstar-support",
                "metadata": {
                    "stable_id": "did:submitted:1",
                    "handle": "northstar-support",
                    "display_name": "Northstar Support",
                    "description": "Submitted metadata only",
                },
                "fetch_metadata": False,
            },
        )
        assert intake.status_code == 201, intake.text
        body = intake.json()
        assert body["source_mode"] == "user_submitted"
        assert body["availability"] == "available"
        assert body["latest_observation"]["source_mode"] == "user_submitted"
        assert body["latest_observation"]["raw"]["submitted_metadata"]["stable_id"] == "did:submitted:1"
        assert "html" not in json.dumps(body).casefold()

        for unsafe in (
            "http://localhost/internal",
            "http://10.0.0.8/internal",
            "http://[::1]/internal",
            "http://169.254.169.254/latest/meta-data",
            "https://u:p@example.com/private",
            "file:///tmp/source",
        ):
            rejected = client.post(
                f"/v1/brands/{tenant['brand']['id']}/candidates/intake",
                headers=tenant["headers"],
                json={"source_mode": "user_submitted", "input_type": "profile_url", "value": unsafe},
            )
            assert rejected.status_code == 422, (unsafe, rejected.text)


def test_retention_legal_hold_requires_explicit_delete_and_records_proof() -> None:
    app = create_app(":memory:")
    with TestClient(app) as client:
        tenant = _seed(client, "retention-owner")
        intake = client.post(
            f"/v1/brands/{tenant['brand']['id']}/candidates/intake",
            headers=tenant["headers"],
            json={"fixture_id": "social.lookalike"},
        )
        assert intake.status_code == 201, intake.text
        candidate = intake.json()
        observation_id = candidate["latest_observation"]["id"]
        app.state.db.execute(
            "UPDATE observations SET retention_expires_at = '2000-01-01T00:00:00Z' WHERE id = ?",
            (observation_id,),
        )
        app.state.db.execute(
            "UPDATE evidence SET retention_expires_at = '2000-01-01T00:00:00Z' WHERE observation_id = ?",
            (observation_id,),
        )

        preview = client.get(
            f"/v1/workspaces/{tenant['workspace']['id']}/retention/preview",
            headers=tenant["headers"],
        )
        assert preview.status_code == 200
        assert preview.json()["expired_observations"] == 1

        held = client.post(
            f"/v1/workspaces/{tenant['workspace']['id']}/retention/legal-holds",
            headers=tenant["headers"],
            json={"object_type": "observation", "object_id": observation_id, "hold": True, "reason": "active review"},
        )
        assert held.status_code == 200, held.text
        held_preview = client.get(
            f"/v1/workspaces/{tenant['workspace']['id']}/retention/preview",
            headers=tenant["headers"],
        )
        assert held_preview.json()["expired_observations"] == 0
        assert held_preview.json()["held_objects"] >= 1

        not_confirmed = client.post(
            f"/v1/workspaces/{tenant['workspace']['id']}/retention/delete",
            headers=tenant["headers"],
            json={"confirm": False},
        )
        assert not_confirmed.status_code == 409
        held_delete = client.post(
            f"/v1/workspaces/{tenant['workspace']['id']}/retention/delete",
            headers=tenant["headers"],
            json={"confirm": True},
        )
        assert held_delete.status_code == 200
        assert held_delete.json()["deleted_count"] == 0
        assert app.state.db.fetch_one("SELECT id FROM observations WHERE id = ?", (observation_id,)) is not None

        released = client.post(
            f"/v1/workspaces/{tenant['workspace']['id']}/retention/legal-holds",
            headers=tenant["headers"],
            json={"object_type": "observation", "object_id": observation_id, "hold": False, "reason": "review closed"},
        )
        assert released.status_code == 200
        app.state.db.execute(
            "UPDATE observations SET retention_expires_at = '2000-01-01T00:00:00Z' WHERE id = ?",
            (observation_id,),
        )
        deleted = client.post(
            f"/v1/workspaces/{tenant['workspace']['id']}/retention/delete",
            headers=tenant["headers"],
            json={"confirm": True},
        )
        assert deleted.status_code == 200, deleted.text
        assert deleted.json()["deleted_count"] >= 1
        assert app.state.db.fetch_one("SELECT id FROM observations WHERE id = ?", (observation_id,)) is None
        proof = app.state.db.fetch_one("SELECT * FROM deletion_proofs WHERE id = ?", (deleted.json()["deletion_proof_id"],))
        assert proof is not None
        assert proof["record_ids_hash"]
        audit = app.state.db.fetch_one(
            "SELECT * FROM audit_events WHERE event_type = 'retention_deletion_executed' AND entity_id = ?",
            (deleted.json()["deletion_proof_id"],),
        )
        assert audit is not None


def test_export_is_tenant_scoped_contains_trace_rights_hash_and_audit() -> None:
    app = create_app(":memory:")
    with TestClient(app) as client:
        tenant_a = _seed(client, "export-a")
        tenant_b = _seed(client, "export-b")
        intake_a = client.post(
            f"/v1/brands/{tenant_a['brand']['id']}/candidates/intake",
            headers=tenant_a["headers"],
            json={"fixture_id": "social.lookalike"},
        )
        assert intake_a.status_code == 201, intake_a.text
        candidate_id = intake_a.json()["id"]

        foreign = client.get(
            f"/v1/candidates/{candidate_id}/evidence/export",
            headers=tenant_b["headers"],
        )
        assert foreign.status_code == 404

        exported = client.get(
            f"/v1/candidates/{candidate_id}/evidence/export?format=json",
            headers=tenant_a["headers"],
        )
        assert exported.status_code == 200, exported.text
        body = exported.json()
        assert body["workspace"]["id"] == tenant_a["workspace"]["id"]
        assert body["provenance"]["source_mode"] == "synthetic_fixture"
        assert body["assessment"]["trace"]
        assert body["evidence"]
        assert body["export_hash"]
        assert body["public_url"] is None
        rights = body["source_rights"]
        assert rights["retention_class"] == "metadata_180d"
        assert rights["owner"]
        audit = app.state.db.fetch_one(
            "SELECT * FROM audit_events WHERE event_type = 'evidence_exported' AND entity_id = ?",
            (candidate_id,),
        )
        assert audit is not None

        csv_export = client.get(
            f"/v1/candidates/{candidate_id}/evidence/export?format=csv",
            headers=tenant_a["headers"],
        )
        assert csv_export.status_code == 200
        assert csv_export.headers["content-type"].startswith("text/csv")
        assert "evidence_hash" in csv_export.text


def test_fixture_flow_remains_explicit_and_regressed_state_is_available() -> None:
    app = create_app(":memory:")
    with TestClient(app) as client:
        tenant = _seed(client, "fixture-regression")
        result = client.post(
            f"/v1/brands/{tenant['brand']['id']}/candidates/intake",
            headers=tenant["headers"],
            json={"fixture_id": "social.lookalike", "source_mode": "synthetic_fixture"},
        )
        assert result.status_code == 201, result.text
        body = result.json()
        assert body["source_mode"] == "synthetic_fixture"
        assert body["availability"] == "available"
        assert body["latest_assessment"]["decision_state"] == "review_required"
        assert len(body["evidence"]) >= 2
