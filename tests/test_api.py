from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from cairnwise.api import create_app


def _register(client: TestClient, username: str, password: str = "correct-horse-123") -> dict:
    response = client.post("/v1/auth/register", json={"username": username, "password": password})
    assert response.status_code == 201, response.text
    body = response.json()
    return {
        "user": body["user"],
        "token": body["access_token"],
        "headers": {"Authorization": f"Bearer {body['access_token']}"},
    }


def _tenant(client: TestClient, username: str, workspace_name: str, brand_name: str) -> dict:
    identity = _register(client, username)
    workspace_response = client.post(
        "/v1/workspaces",
        headers=identity["headers"],
        json={"name": workspace_name},
    )
    assert workspace_response.status_code == 201, workspace_response.text
    workspace = workspace_response.json()
    brand_response = client.post(
        f"/v1/workspaces/{workspace['id']}/brands",
        headers=identity["headers"],
        json={"name": brand_name, "website": f"https://{username}.example"},
    )
    assert brand_response.status_code == 201, brand_response.text
    brand = brand_response.json()
    intake_response = client.post(
        f"/v1/brands/{brand['id']}/candidates/intake",
        headers=identity["headers"],
        json={"fixture_id": "social.lookalike"},
    )
    assert intake_response.status_code == 201, intake_response.text
    candidate = intake_response.json()
    case_response = client.post(
        f"/v1/candidates/{candidate['id']}/cases",
        headers=identity["headers"],
        json={"owner": "payload-cannot-set-actor"},
    )
    assert case_response.status_code == 201, case_response.text
    return {
        **identity,
        "workspace": workspace,
        "brand": brand,
        "candidate": candidate,
        "case": case_response.json(),
        "run_id": candidate["source_run_id"],
    }


def test_local_auth_register_login_me_logout_and_no_token_persistence() -> None:
    app = create_app(":memory:")
    with TestClient(app) as client:
        public_state = client.get("/v1/dev/state")
        assert public_state.status_code == 401
        assert public_state.headers["content-type"].startswith("application/problem+json")
        assert public_state.json()["type"].endswith("/authentication")
        assert client.get("/v1/brands/brand_not_visible").status_code == 401
        assert client.get("/v1/candidates/candidate_not_visible").status_code == 401
        assert client.get("/v1/cases/case_not_visible").status_code == 401
        assert client.get("/v1/connector-runs/run_not_visible").status_code == 401

        identity = _register(client, "Alice")
        token = identity["token"]
        stored_session = app.state.db.fetch_one("SELECT token_hash FROM auth_sessions")
        assert stored_session is not None
        assert token not in stored_session["token_hash"]
        stored_user = app.state.db.fetch_one("SELECT password_salt, password_hash FROM auth_users")
        assert stored_user is not None
        assert "correct-horse-123" not in repr(dict(stored_user))
        foreign_keys = app.state.db.fetch_all("PRAGMA foreign_key_list(workspace_members)")
        assert any(row["table"] == "workspaces" for row in foreign_keys)

        login = client.post(
            "/v1/auth/login",
            json={"username": "alice", "password": "correct-horse-123"},
        )
        assert login.status_code == 200
        login_token = login.json()["access_token"]
        assert login_token != token
        assert client.get("/v1/auth/me", headers={"Authorization": f"Bearer {login_token}"}).json()["user"]["username"] == "alice"

        wrong_password = client.post(
            "/v1/auth/login",
            json={"username": "alice", "password": "wrong-password"},
        )
        assert wrong_password.status_code == 401
        assert wrong_password.headers["www-authenticate"] == "Bearer"

        assert client.post("/v1/auth/logout", headers={"Authorization": f"Bearer {login_token}"}).status_code == 200
        assert client.get("/v1/auth/me", headers={"Authorization": f"Bearer {login_token}"}).status_code == 401


def test_lifespan_reopens_persistent_database(tmp_path: Path) -> None:
    database_path = tmp_path / "cairnwise-auth.sqlite"
    app = create_app(database_path)
    with TestClient(app) as client:
        identity = _register(client, "persisted-user", "persisted-password")
        created = client.post(
            "/v1/workspaces",
            headers=identity["headers"],
            json={"name": "Persisted workspace"},
        )
        assert created.status_code == 201
        workspace_id = created.json()["id"]

    # A second lifespan creates a fresh connection while retaining the local
    # schema, password record, membership, and workspace rows.
    with TestClient(app) as client:
        login = client.post(
            "/v1/auth/login",
            json={"username": "persisted-user", "password": "persisted-password"},
        )
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        workspace = client.get(f"/v1/workspaces/{workspace_id}", headers=headers)
        assert workspace.status_code == 200
        assert workspace.json()["name"] == "Persisted workspace"


def test_cross_tenant_brand_candidate_case_evidence_and_run_fail_closed() -> None:
    app = create_app(":memory:")
    with TestClient(app) as client:
        tenant_a = _tenant(client, "tenant-a", "Workspace A", "Brand A")
        tenant_b = _tenant(client, "tenant-b", "Workspace B", "Brand B")
        headers = tenant_b["headers"]

        object_paths = [
            f"/v1/workspaces/{tenant_a['workspace']['id']}",
            f"/v1/brands/{tenant_a['brand']['id']}",
            f"/v1/brands/{tenant_a['brand']['id']}/assets",
            f"/v1/candidates/{tenant_a['candidate']['id']}",
            f"/v1/candidates/{tenant_a['candidate']['id']}/evidence",
            f"/v1/connector-runs/{tenant_a['run_id']}",
            f"/v1/cases/{tenant_a['case']['id']}",
        ]
        for path in object_paths:
            response = client.get(path, headers=headers)
            assert response.status_code == 404, (path, response.text)
            assert response.headers["content-type"].startswith("application/problem+json")

        cannot_create_brand = client.post(
            f"/v1/workspaces/{tenant_a['workspace']['id']}/brands",
            headers=headers,
            json={"name": "Cross-tenant brand"},
        )
        assert cannot_create_brand.status_code == 404

        cannot_intake = client.post(
            f"/v1/brands/{tenant_a['brand']['id']}/candidates/intake",
            headers=headers,
            json={"fixture_id": "social.official"},
        )
        assert cannot_intake.status_code == 404
        state = client.get("/v1/dev/state", headers=headers).json()
        assert [item["id"] for item in state["workspaces"]] == [tenant_b["workspace"]["id"]]


def test_dev_seed_requires_auth_and_is_scoped_to_the_authenticated_workspace() -> None:
    app = create_app(":memory:")
    with TestClient(app) as client:
        assert client.post("/v1/dev/seed").status_code == 401

        first_user = _register(client, "seed-owner")
        first = client.post("/v1/dev/seed", headers=first_user["headers"])
        assert first.status_code == 200, first.text
        first_body = first.json()
        second = client.post("/v1/dev/seed", headers=first_user["headers"])
        assert second.status_code == 200
        assert second.json()["workspace"]["id"] == first_body["workspace"]["id"]
        assert second.json()["brand"]["id"] == first_body["brand"]["id"]
        assert second.json()["reused"] is True

        other_user = _register(client, "other-seed-owner")
        other = client.post("/v1/dev/seed", headers=other_user["headers"])
        assert other.status_code == 200
        assert other.json()["workspace"]["id"] != first_body["workspace"]["id"]
        cannot_attach = client.post(
            "/v1/dev/seed",
            headers=other_user["headers"],
            json={"workspace_id": first_body["workspace"]["id"]},
        )
        assert cannot_attach.status_code == 404


def test_spoofed_actor_is_ignored_and_role_is_stored_not_payload_controlled() -> None:
    app = create_app(":memory:")
    with TestClient(app) as client:
        owner = _tenant(client, "owner-user", "Owner workspace", "Owner brand")
        spoof_headers = {
            **owner["headers"],
            "X-Cairnwise-Actor": "victim-user",
            "Idempotency-Key": "spoof-check",
        }
        intake = client.post(
            f"/v1/brands/{owner['brand']['id']}/candidates/intake",
            headers=spoof_headers,
            json={"fixture_id": "social.spacing", "actor": "victim-user"},
        )
        assert intake.status_code == 201
        assert intake.json()["source_run"]["response_meta"]["actor"] == owner["user"]["id"]

        analyst = _register(client, "analyst-user")
        app.state.auth.add_membership(owner["workspace"]["id"], analyst["user"]["id"], "analyst")
        analyst_brand = client.post(
            f"/v1/workspaces/{owner['workspace']['id']}/brands",
            headers={**analyst["headers"], "X-Cairnwise-Actor": "owner-user"},
            json={"name": "Payload owner cannot grant this role", "role": "owner"},
        )
        assert analyst_brand.status_code == 403

        analyst_decision = client.post(
            f"/v1/cases/{owner['case']['id']}/decisions",
            headers=analyst["headers"],
            json={
                "disposition": "confirmed_impersonation_under_policy",
                "reason": "analyst cannot self-approve",
                "reviewer_approved": True,
            },
        )
        assert analyst_decision.status_code == 403

        reviewer = _register(client, "reviewer-user")
        app.state.auth.add_membership(owner["workspace"]["id"], reviewer["user"]["id"], "reviewer")
        reviewer_decision = client.post(
            f"/v1/cases/{owner['case']['id']}/decisions",
            headers=reviewer["headers"],
            json={
                "disposition": "confirmed_impersonation_under_policy",
                "reason": "stored reviewer role authorizes this decision",
                "reviewer_approved": False,
            },
        )
        assert reviewer_decision.status_code == 200, reviewer_decision.text
        assert reviewer_decision.json()["disposition"] == "confirmed_impersonation_under_policy"


def test_invalid_payload_limits_and_strict_cors() -> None:
    app = create_app(":memory:")
    with TestClient(app) as client:
        invalid_registration = client.post(
            "/v1/auth/register",
            json={"username": "ab", "password": "short"},
        )
        assert invalid_registration.status_code == 422
        assert invalid_registration.headers["content-type"].startswith("application/problem+json")

        wrong_shape = client.post("/v1/auth/register", json=["not", "an", "object"])
        assert wrong_shape.status_code == 422
        assert wrong_shape.json()["type"].endswith("/validation")

        identity = _register(client, "limit-user")
        oversized = client.post(
            "/v1/workspaces",
            headers=identity["headers"],
            json={"name": "x" * 600_000},
        )
        assert oversized.status_code == 413
        assert oversized.headers["content-type"].startswith("application/problem+json")

        trusted = client.options(
            "/v1/auth/login",
            headers={
                "Origin": "http://localhost:8765",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization",
            },
        )
        assert trusted.status_code == 200
        assert trusted.headers["access-control-allow-origin"] == "http://localhost:8765"

        untrusted = client.options(
            "/v1/auth/login",
            headers={
                "Origin": "https://evil.example",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert untrusted.status_code == 400
        assert "access-control-allow-origin" not in untrusted.headers


def test_foundation_vertical_slice_persists_assessment_trace_case_and_report() -> None:
    app = create_app(":memory:")
    with TestClient(app) as client:
        identity = _register(client, "vertical-owner")
        seeded = client.post("/v1/dev/seed", headers=identity["headers"])
        assert seeded.status_code == 200, seeded.text
        brand_id = seeded.json()["brand"]["id"]

        intake = client.post(
            f"/v1/brands/{brand_id}/candidates/intake",
            headers={**identity["headers"], "Idempotency-Key": "vertical-social-lookalike"},
            json={"fixture_id": "social.lookalike", "source_mode": "synthetic_fixture"},
        )
        assert intake.status_code == 201, intake.text
        candidate = intake.json()
        assert candidate["source_mode"] == "synthetic_fixture"
        assert candidate["latest_observation"]["source_mode"] == "synthetic_fixture"
        assert candidate["latest_assessment"]["decision_state"] == "review_required"
        assert candidate["latest_assessment"]["trace"]["official_assets_considered"] >= 1
        assert len(candidate["evidence"]) >= 2

        reassess = client.post(
            f"/v1/candidates/{candidate['id']}/assessments",
            headers=identity["headers"],
        )
        assert reassess.status_code == 201, reassess.text
        assert reassess.json()["assessment_recheck"] is True
        assert reassess.json()["latest_assessment"]["detector"]["version"] == "0.2.0"

        case_response = client.post(
            f"/v1/candidates/{candidate['id']}/cases",
            headers=identity["headers"],
            json={},
        )
        assert case_response.status_code == 201, case_response.text
        case_id = case_response.json()["id"]
        decision = client.post(
            f"/v1/cases/{case_id}/decisions",
            headers=identity["headers"],
            json={
                "disposition": "insufficient_evidence",
                "reason": "The local fixture lacks independently verified publisher and stable destination proof.",
            },
        )
        assert decision.status_code == 200, decision.text
        assert decision.json()["events"][-1]["action"] == "decision_recorded"

        draft = client.post(f"/v1/cases/{case_id}/report-drafts", headers=identity["headers"])
        assert draft.status_code == 201, draft.text
        draft_body = draft.json()
        assert draft_body["content"]["status"] == "draft"
        assert draft_body["content"]["evidence_ids"]
        assert "not live coverage" in " ".join(draft_body["content"]["limitations"])

        stored_trace = app.state.db.fetch_one("SELECT assessment_json FROM assessments ORDER BY created_at DESC LIMIT 1")
        assert stored_trace is not None
        assert "official_asset_comparisons" in stored_trace["assessment_json"]
