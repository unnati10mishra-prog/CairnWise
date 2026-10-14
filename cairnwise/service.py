"""Application services that implement the first Cairnwise vertical slice."""

from __future__ import annotations

import csv
import json
from datetime import datetime, timedelta, timezone
from io import StringIO
from typing import Any

from .connectors import (
    APPLE_CONNECTOR_KEY,
    BLUESKY_CONNECTOR_KEY,
    ConnectorError,
    ConnectorRegistry,
    ConnectorResult,
    USER_SUBMITTED_APP_KEY,
    USER_SUBMITTED_SOCIAL_KEY,
)
from .db import Database, json_text, new_id, sha256_json, utc_now
from .detector import assess_observation
from .evidence import (
    DEFAULT_AUDIT_RETENTION_CLASS,
    DEFAULT_RETENTION_CLASS,
    build_export_payload,
    content_hash,
    export_csv,
    ids_hash,
    retention_metadata,
    sanitize_metadata,
    utc_datetime,
    utc_iso,
)
from .fixtures import CONNECTOR_MANIFESTS, connector_for_fixture, get_fixture
from .normalization import NORMALIZATION_VERSION, canonical_url, compact_name, normalize_text
from .source_security import BoundedHTTPFetcher, SourceSecurityError, canonicalize_url


class DomainError(Exception):
    def __init__(self, status: int, title: str, detail: str, *, error_type: str = "about:blank"):
        super().__init__(detail)
        self.status = status
        self.title = title
        self.detail = detail
        self.error_type = error_type


def _decode(value: str | None, fallback: Any) -> Any:
    if value is None:
        return fallback
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return fallback


class CairnwiseService:
    def __init__(
        self,
        db: Database,
        *,
        connector_registry: ConnectorRegistry | None = None,
        fetcher: BoundedHTTPFetcher | None = None,
    ):
        self.db = db
        self.connector_registry = connector_registry or ConnectorRegistry()
        self.fetcher = fetcher or BoundedHTTPFetcher()

    def initialize(self) -> None:
        self.db.initialize()
        self._ensure_connectors()

    def _ensure_connectors(self) -> None:
        now = utc_now()
        manifests = {
            **CONNECTOR_MANIFESTS,
            **self.connector_registry.manifests(),
        }
        with self.db.transaction() as connection:
            for connector_key, manifest in manifests.items():
                # Fixture connectors are the only always-on offline path.  The
                # permitted adapters come from the explicit registry below and
                # remain disabled unless their effective manifest says so.
                rights = manifest.get("rights") if isinstance(manifest.get("rights"), dict) else {}
                rights = {
                    "permissions": rights.get("permissions") or manifest.get("auth") or "declared_fixture_only",
                    "terms_basis": rights.get("terms_basis") or manifest.get("terms_basis") or "source contract",
                    "retention_class": rights.get("retention_class") or manifest.get("retention_class") or DEFAULT_RETENTION_CLASS,
                    "image_rights": rights.get("image_rights") or "metadata/hash only; image bytes are not retained",
                    "owner": rights.get("owner") or ("fixture-governance" if connector_key.startswith("fixture.") else "source-governance"),
                    **rights,
                }
                manifest = {**manifest, "rights": rights}
                enabled = bool(manifest.get("enabled", connector_key in CONNECTOR_MANIFESTS))
                connection.execute(
                    """
                    INSERT INTO connectors (
                        id, connector_key, source, asset_type, manifest_json, rights_json,
                        permissions, terms_basis, retention_class, image_rights, owner,
                        enabled, created_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(connector_key) DO UPDATE SET
                        source = excluded.source,
                        asset_type = excluded.asset_type,
                        manifest_json = excluded.manifest_json,
                        rights_json = excluded.rights_json,
                        permissions = excluded.permissions,
                        terms_basis = excluded.terms_basis,
                        retention_class = excluded.retention_class,
                        image_rights = excluded.image_rights,
                        owner = excluded.owner,
                        enabled = excluded.enabled
                    """,
                    (
                        str(manifest.get("connector_id") or connector_key),
                        connector_key,
                        manifest["source"],
                        manifest["asset_type"],
                        json_text(manifest),
                        json_text(rights),
                        rights.get("permissions") or manifest.get("permissions"),
                        rights.get("terms_basis") or manifest.get("terms_basis"),
                        rights.get("retention_class") or manifest.get("retention_class") or DEFAULT_RETENTION_CLASS,
                        rights.get("image_rights") or manifest.get("image_rights"),
                        rights.get("owner") or manifest.get("owner"),
                        1 if enabled else 0,
                        now,
                    ),
                )

    def _manifest_from_row(self, row: Any) -> dict[str, Any]:
        manifest = _decode(row["manifest_json"] if row is not None else None, {})
        if not isinstance(manifest, dict):
            manifest = {}
        rights = _decode(row["rights_json"] if row is not None and "rights_json" in row.keys() else None, {})
        if not isinstance(rights, dict):
            rights = {}
        manifest["rights"] = {**rights, **(manifest.get("rights") if isinstance(manifest.get("rights"), dict) else {})}
        manifest.setdefault("connector_key", row["connector_key"] if row is not None and "connector_key" in row.keys() else None)
        manifest.setdefault("source", row["source"] if row is not None and "source" in row.keys() else None)
        manifest.setdefault("asset_type", row["asset_type"] if row is not None and "asset_type" in row.keys() else None)
        manifest["enabled"] = bool(row["enabled"]) if row is not None and "enabled" in row.keys() else bool(manifest.get("enabled"))
        for key in ("permissions", "terms_basis", "retention_class", "image_rights", "owner"):
            if row is not None and key in row.keys() and row[key] is not None:
                manifest[key] = row[key]
                manifest["rights"].setdefault(key, row[key])
        return manifest

    def connector_manifests(self) -> list[dict[str, Any]]:
        rows = self.db.fetch_all("SELECT * FROM connectors ORDER BY connector_key")
        return [self._manifest_from_row(row) for row in rows]

    def connector_manifest(self, connector_key: str) -> dict[str, Any]:
        row = self.db.fetch_one("SELECT * FROM connectors WHERE connector_key = ?", (connector_key,))
        if not row:
            raise DomainError(404, "Connector not found", f"No connector manifest exists for {connector_key}.")
        return self._manifest_from_row(row)

    def health(self) -> dict[str, Any]:
        row = self.db.fetch_one("SELECT COUNT(*) AS count FROM connectors")
        return {
            "status": "ok",
            "service": "cairnwise-api",
            "phase": "foundation",
            "version": "0.1.0-foundation",
            "storage": "sqlite_local",
            "development_mode": True,
            "authentication": "not_implemented_local_only",
            "connectors_registered": int(row["count"] if row else 0),
        }

    def create_workspace(self, payload: dict[str, Any]) -> dict[str, Any]:
        name = str(payload.get("name") or "").strip()
        if not name:
            raise DomainError(422, "Validation failed", "Workspace name is required.")
        workspace_id = new_id("ws")
        now = utc_now()
        with self.db.transaction() as connection:
            connection.execute(
                "INSERT INTO workspaces (id, name, created_at) VALUES (?, ?, ?)",
                (workspace_id, name, now),
            )
        return {"id": workspace_id, "name": name, "status": "active", "created_at": now}

    def get_workspace(self, workspace_id: str) -> dict[str, Any]:
        row = self.db.fetch_one("SELECT * FROM workspaces WHERE id = ?", (workspace_id,))
        if not row:
            raise DomainError(404, "Workspace not found", f"No workspace exists for id {workspace_id}.")
        return dict(row)

    def list_brands(self, workspace_id: str) -> list[dict[str, Any]]:
        self.get_workspace(workspace_id)
        rows = self.db.fetch_all("SELECT * FROM brands WHERE workspace_id = ? ORDER BY created_at", (workspace_id,))
        return [self._brand_from_row(row) for row in rows]

    def create_brand(self, workspace_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        self.get_workspace(workspace_id)
        name = str(payload.get("name") or "").strip()
        if not name:
            raise DomainError(422, "Validation failed", "Brand name is required.")
        website = str(payload.get("website") or "").strip() or None
        if website:
            try:
                website = canonical_url(website)
            except ValueError as error:
                raise DomainError(422, "Validation failed", str(error)) from error
        brand_id = new_id("brand")
        now = utc_now()
        canonical_name = compact_name(name)
        if not canonical_name:
            raise DomainError(422, "Validation failed", "Brand name must contain letters or numbers.")
        regions = payload.get("regions") if isinstance(payload.get("regions"), list) else []
        with self.db.transaction() as connection:
            try:
                connection.execute(
                    """
                    INSERT INTO brands (id, workspace_id, name, canonical_name, website, locale, regions_json, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        brand_id,
                        workspace_id,
                        name,
                        canonical_name,
                        website,
                        str(payload.get("locale") or "en-IN"),
                        json_text(regions),
                        now,
                    ),
                )
            except Exception as error:
                if "UNIQUE constraint failed" in str(error):
                    raise DomainError(409, "Duplicate brand", "A brand with this normalized name already exists in the workspace.") from error
                raise
        return self.get_brand(brand_id)

    def get_brand(self, brand_id: str) -> dict[str, Any]:
        row = self.db.fetch_one("SELECT * FROM brands WHERE id = ?", (brand_id,))
        if not row:
            raise DomainError(404, "Brand not found", f"No brand exists for id {brand_id}.")
        return self._brand_from_row(row)

    def _brand_from_row(self, row: Any) -> dict[str, Any]:
        result = dict(row)
        result["regions"] = _decode(result.pop("regions_json", None), [])
        return result

    def list_assets(self, brand_id: str) -> list[dict[str, Any]]:
        self.get_brand(brand_id)
        rows = self.db.fetch_all("SELECT * FROM assets WHERE brand_id = ? ORDER BY created_at", (brand_id,))
        return [self._asset_from_row(row) for row in rows]

    def add_asset(self, brand_id: str, payload: dict[str, Any], *, actor: str = "local.owner") -> dict[str, Any]:
        brand = self.get_brand(brand_id)
        asset_type = str(payload.get("asset_type") or "").strip()
        if asset_type not in {"logo", "social_profile", "mobile_app"}:
            raise DomainError(422, "Validation failed", "asset_type must be logo, social_profile, or mobile_app.")
        raw_url = str(payload.get("canonical_url") or payload.get("url") or "").strip()
        canonical = None
        if raw_url:
            try:
                canonical = canonical_url(raw_url)
            except ValueError as error:
                raise DomainError(422, "Validation failed", str(error)) from error
        if asset_type != "logo" and not canonical:
            raise DomainError(422, "Validation failed", "A social or app asset requires a canonical URL.")
        display_name = str(payload.get("display_name") or payload.get("name") or "").strip() or None
        stable_id = str(payload.get("stable_external_id") or payload.get("stable_id") or payload.get("package_id") or "").strip() or None
        now = utc_now()
        asset_id = new_id("asset")
        metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
        authorization_state = str(payload.get("authorization_state") or "self_declared")
        if authorization_state not in {"self_declared", "authorized", "authorized_with_scope"}:
            raise DomainError(422, "Validation failed", "Unsupported authorization_state.")
        asset = {
            "asset_type": asset_type,
            "platform": payload.get("platform"),
            "store": payload.get("store"),
            "canonical_url": canonical,
            "stable_external_id": stable_id,
            "display_name": display_name,
            "publisher": payload.get("publisher"),
            "package_id": payload.get("package_id"),
            "description": payload.get("description"),
            "metadata": metadata,
            "authorization_state": authorization_state,
            "scope": payload.get("scope"),
        }
        with self.db.transaction() as connection:
            try:
                connection.execute(
                    """
                    INSERT INTO assets (
                        id, brand_id, asset_type, platform, store, canonical_url, stable_external_id,
                        display_name, publisher, package_id, description, metadata_json,
                        authorization_state, scope, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        asset_id,
                        brand_id,
                        asset_type,
                        asset["platform"],
                        asset["store"],
                        canonical,
                        stable_id,
                        display_name,
                        asset["publisher"],
                        asset["package_id"],
                        asset["description"],
                        json_text(metadata),
                        authorization_state,
                        asset["scope"],
                        now,
                    ),
                )
            except Exception as error:
                if "UNIQUE constraint failed" in str(error):
                    raise DomainError(409, "Duplicate official asset", "The stable identifier is already registered.") from error
                raise
            version_json = {**asset, "brand_id": brand_id, "created_by": actor}
            connection.execute(
                """
                INSERT INTO asset_versions (
                    id, asset_id, version_number, raw_json, normalized_json, content_hash,
                    verified_by, verification_source, valid_from
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    new_id("assetver"),
                    asset_id,
                    1,
                    json_text(payload),
                    json_text(version_json),
                    sha256_json(version_json),
                    actor,
                    payload.get("verification_source") or "local_baseline_entry",
                    now,
                ),
            )
        return self.get_asset(asset_id)

    def get_asset(self, asset_id: str) -> dict[str, Any]:
        row = self.db.fetch_one("SELECT * FROM assets WHERE id = ?", (asset_id,))
        if not row:
            raise DomainError(404, "Asset not found", f"No asset exists for id {asset_id}.")
        return self._asset_from_row(row)

    def _asset_from_row(self, row: Any) -> dict[str, Any]:
        result = dict(row)
        result["metadata"] = _decode(result.pop("metadata_json", None), {})
        return result

    def seed_demo(self) -> dict[str, Any]:
        """Create the fictional Northstar Pay baseline for local verification."""

        existing = self.db.fetch_one(
            "SELECT b.id, b.workspace_id FROM brands b WHERE b.canonical_name = ?",
            (compact_name("Northstar Pay"),),
        )
        if existing:
            return self._seed_payload(existing["workspace_id"], existing["id"], reused=True)

        workspace = self.create_workspace({"name": "Northstar Pay / Local Verification"})
        brand = self.create_brand(
            workspace["id"],
            {
                "name": "Northstar Pay",
                "website": "https://northstarpay.example",
                "locale": "en-IN",
                "regions": ["IN", "EU"],
            },
        )
        self.add_asset(
            brand["id"],
            {
                "asset_type": "logo",
                "display_name": "Northstar Pay primary logo",
                "authorization_state": "authorized",
                "metadata": {"fingerprint": "northstar-logo-v1", "retention": "metadata_only"},
                "verification_source": "fictional local fixture",
            },
        )
        self.add_asset(
            brand["id"],
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
        )
        self.add_asset(
            brand["id"],
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
        )
        self.add_asset(
            brand["id"],
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
        )
        return self._seed_payload(workspace["id"], brand["id"], reused=False)

    def _seed_payload(self, workspace_id: str, brand_id: str, *, reused: bool) -> dict[str, Any]:
        return {
            "workspace": self.get_workspace(workspace_id),
            "brand": self.get_brand(brand_id),
            "assets": self.list_assets(brand_id),
            "source_mode": "synthetic_fixture",
            "fixture_notice": "Offline fixture — not live coverage.",
            "reused": reused,
        }

    def list_candidates(self, brand_id: str) -> list[dict[str, Any]]:
        self.get_brand(brand_id)
        rows = self.db.fetch_all("SELECT * FROM candidates WHERE brand_id = ? ORDER BY last_seen DESC", (brand_id,))
        return [self.get_candidate(row["id"]) for row in rows]

    def intake_fixture(
        self,
        brand_id: str,
        payload: dict[str, Any],
        *,
        idempotency_key: str | None = None,
        actor: str = "local.owner",
    ) -> dict[str, Any]:
        brand = self.get_brand(brand_id)
        fixture_id = str(payload.get("value") or payload.get("fixture_id") or "").strip()
        source_mode = str(payload.get("source_mode") or "synthetic_fixture")
        if source_mode != "synthetic_fixture":
            raise DomainError(
                422,
                "Unsupported source mode",
                "Phase 1 accepts only explicit synthetic_fixture observations. Live and user-submitted adapters are not enabled yet.",
            )
        if not fixture_id:
            raise DomainError(422, "Validation failed", "A fixture_id is required for the foundation flow.")
        try:
            fixture = get_fixture(fixture_id)
            connector_key = connector_for_fixture(fixture_id)
        except KeyError as error:
            raise DomainError(404, "Fixture not found", f"No deterministic fixture exists for {fixture_id}.") from error

        connector = self.db.fetch_one("SELECT * FROM connectors WHERE connector_key = ?", (connector_key,))
        if not connector:
            raise DomainError(503, "Connector unavailable", f"Connector {connector_key} is not registered.")
        existing_run = None
        if idempotency_key:
            existing_run = self.db.fetch_one(
                "SELECT * FROM source_runs WHERE brand_id = ? AND idempotency_key = ?",
                (brand_id, idempotency_key),
            )
        if existing_run:
            return self._run_result(existing_run["id"])

        run_id = new_id("run")
        started_at = utc_now()
        with self.db.transaction() as connection:
            connection.execute(
                """
                INSERT INTO source_runs (
                    id, workspace_id, brand_id, connector_id, operation, source_mode,
                    idempotency_key, status, started_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    brand["workspace_id"],
                    brand_id,
                    connector["id"],
                    "get_profile" if fixture["asset_type"] == "social_profile" else "get_listing",
                    source_mode,
                    idempotency_key,
                    "running",
                    started_at,
                ),
            )

        if fixture.get("availability_state") == "unavailable":
            ended_at = utc_now()
            result = {
                "source_run_id": run_id,
                "source_status": "unavailable",
                "availability": "unavailable",
                "next_action": "retry_or_use_another_permitted_source",
                "evidence_mode": source_mode,
                "fixture_notice": "Offline fixture — not live coverage.",
            }
            with self.db.transaction() as connection:
                connection.execute(
                    """
                    UPDATE source_runs SET status = ?, ended_at = ?, error_code = ?, error_message = ?,
                        availability_state = ?, response_meta_json = ?, source_rights_json = ?, result_json = ? WHERE id = ?
                    """,
                    (
                        "unavailable",
                        ended_at,
                        fixture.get("failure_code"),
                        fixture.get("failure_message"),
                        "unavailable",
                        json_text({"fixture_id": fixture_id, "connector": connector_key}),
                        connector["rights_json"] if "rights_json" in connector.keys() else "{}",
                        json_text(result),
                        run_id,
                    ),
                )
            return result

        observation = self._store_observation(
            brand,
            fixture,
            run_id,
            source_mode,
            source_rights=self._manifest_from_row(connector),
        )
        assets = self.list_assets(brand_id)
        assessment = assess_observation(brand=brand, assets=assets, observation=observation)
        assessment_id = new_id("assessment")
        now = utc_now()
        with self.db.transaction() as connection:
            connection.execute(
                """
                INSERT INTO assessments (
                    id, candidate_id, observation_id, detector_name, detector_version,
                    identity_resemblance, authorization_state, authorization_conflict,
                    potential_harm_level, observed_harm, evidence_quality, exposure_or_recency,
                    queue_priority, decision_state, reasons_json, counterevidence_json, missing_json,
                    assessment_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    assessment_id,
                    observation["candidate_id"],
                    observation["id"],
                    assessment["detector_name"],
                    assessment["detector_version"],
                    assessment["identity_resemblance"],
                    assessment["authorization_state"],
                    assessment["authorization_conflict"],
                    assessment["potential_harm_level"],
                    assessment["observed_harm"],
                    assessment["evidence_quality"],
                    assessment["exposure_or_recency"],
                    assessment["queue_priority"],
                    assessment["decision_state"],
                    json_text(assessment["reasons"]),
                    json_text(assessment["counterevidence"]),
                    json_text(assessment["missing"]),
                    json_text(assessment),
                    now,
                ),
            )
            evidence_ids = []
            evidence_items = self._evidence_items(fixture, assessment)
            for item in evidence_items:
                evidence_id = new_id("evidence")
                evidence_ids.append(evidence_id)
                connection.execute(
                    """
                    INSERT INTO evidence (
                        id, observation_id, assessment_id, evidence_type, source_locator,
                        excerpt, integrity_hash, retention_class, retention_expires_at, legal_hold, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        evidence_id,
                        observation["id"],
                        assessment_id,
                        item["evidence_type"],
                        fixture.get("source_locator"),
                        item["excerpt"],
                        sha256_json({"observation_id": observation["id"], **item}),
                        observation.get("retention_class", DEFAULT_RETENTION_CLASS),
                        observation.get("retention_expires_at"),
                        1 if observation.get("legal_hold") else 0,
                        now,
                    ),
                )
            result = {
                "source_run_id": run_id,
                "candidate_id": observation["candidate_id"],
                "observation_id": observation["id"],
                "assessment_id": assessment_id,
                "source_status": "completed",
                "availability": "available",
                "next_action": "create_case_for_human_review" if assessment["decision_state"] not in {"authorized"} else "no_review_required",
                "evidence_mode": source_mode,
                "fixture_notice": "Offline fixture — not live coverage.",
                "supporting_evidence_ids": evidence_ids,
            }
            connection.execute(
                """
                UPDATE source_runs SET status = ?, ended_at = ?, record_count = ?,
                    availability_state = ?, response_meta_json = ?, source_rights_json = ?, result_json = ? WHERE id = ?
                """,
                (
                    "completed",
                    utc_now(),
                    1,
                    "available",
                    json_text({"fixture_id": fixture_id, "connector": connector_key, "actor": actor}),
                    connector["rights_json"] if "rights_json" in connector.keys() else "{}",
                    json_text(result),
                    run_id,
                ),
            )
        candidate = self.get_candidate(observation["candidate_id"])
        candidate.update(
            {
                "source_run_id": run_id,
                "source_status": "completed",
                "availability": "available",
                "next_action": result["next_action"],
                "source_mode": source_mode,
                "evidence_mode": source_mode,
                "fixture_notice": "Offline fixture — not live coverage.",
                "supporting_evidence_ids": evidence_ids,
            }
        )
        candidate["source_run"] = self.get_source_run(run_id)
        return candidate

    def _store_observation(
        self,
        brand: dict[str, Any],
        fixture: dict[str, Any],
        run_id: str,
        source_mode: str,
        *,
        source_rights: dict[str, Any] | None = None,
        retention_class: str | None = None,
        retention_expires_at: str | None = None,
        legal_hold: bool = False,
    ) -> dict[str, Any]:
        asset_type = fixture["asset_type"]
        source_identity = str(fixture.get("source_identity") or fixture.get("store_id") or "")
        source_locator = str(fixture.get("source_locator") or "")
        try:
            locator_key = canonical_url(source_locator)
        except ValueError:
            locator_key = source_locator
        dedupe_key = f"{asset_type}:{source_identity or locator_key}"
        now = utc_now()
        observed_at = fixture.get("observed_at") or now
        raw = sanitize_metadata(fixture)
        rights = source_rights or {}
        selected_retention = retention_class or rights.get("retention_class") or DEFAULT_RETENTION_CLASS
        try:
            retention = retention_metadata(selected_retention, legal_hold=legal_hold)
        except ValueError:
            retention = retention_metadata(DEFAULT_RETENTION_CLASS, legal_hold=legal_hold)
            selected_retention = DEFAULT_RETENTION_CLASS
        if retention_expires_at is not None:
            retention["expires_at"] = retention_expires_at
        normalized = {
            "display_name": normalize_text(fixture.get("display_name") or fixture.get("title")),
            "compact_name": compact_name(fixture.get("display_name") or fixture.get("title")),
            "source_locator": locator_key,
            "stable_id": fixture.get("stable_id") or fixture.get("package_id") or fixture.get("bundle_id"),
            "normalization_version": NORMALIZATION_VERSION,
        }
        with self.db.transaction() as connection:
            candidate_row = connection.execute(
                "SELECT * FROM candidates WHERE brand_id = ? AND dedupe_key = ?",
                (brand["id"], dedupe_key),
            ).fetchone()
            if candidate_row:
                candidate_id = candidate_row["id"]
                connection.execute(
                    "UPDATE candidates SET last_seen = ? WHERE id = ?",
                    (now, candidate_id),
                )
            else:
                candidate_id = new_id("candidate")
                connection.execute(
                    """
                    INSERT INTO candidates (
                        id, brand_id, asset_type, source_identity, canonical_locator,
                        dedupe_key, first_seen, last_seen
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        candidate_id,
                        brand["id"],
                        asset_type,
                        source_identity,
                        locator_key,
                        dedupe_key,
                        now,
                        now,
                    ),
                )
            observation_id = new_id("observation")
            availability = str(fixture.get("availability_state", "available"))
            if availability not in {"available", "unavailable", "unsupported", "stale"}:
                availability = "unavailable"
            connection.execute(
                """
                INSERT INTO observations (
                    id, candidate_id, source_run_id, observed_at, collected_at, source_mode,
                    availability_state, source_locator, raw_json, normalized_json, content_hash,
                    retention_class, retention_expires_at, legal_hold
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    observation_id,
                    candidate_id,
                    run_id,
                    observed_at,
                    now,
                    source_mode,
                    availability,
                    source_locator,
                    json_text(raw),
                    json_text(normalized),
                    sha256_json(raw),
                    selected_retention,
                    retention["expires_at"],
                    1 if retention["legal_hold"] else 0,
                ),
            )
        return {
            "id": observation_id,
            "candidate_id": candidate_id,
            "asset_type": asset_type,
            "source_mode": source_mode,
            "availability_state": availability,
            "source_locator": source_locator,
            "raw": raw,
            "normalized": normalized,
            "retention_class": selected_retention,
            "retention_expires_at": retention["expires_at"],
            "legal_hold": retention["legal_hold"],
            "source_rights": rights,
        }

    def _evidence_items(self, fixture: dict[str, Any], assessment: dict[str, Any]) -> list[dict[str, str]]:
        items = [
            {
                "evidence_type": "source_observation",
                "excerpt": f"Observed {fixture.get('display_name') or fixture.get('title') or 'candidate'} from {fixture.get('source_locator') or 'fixture source'}.",
            },
            {
                "evidence_type": "detector_reason",
                "excerpt": "Detector reasons: " + (", ".join(assessment["reasons"]) if assessment["reasons"] else "no comparison signal recorded"),
            },
        ]
        if assessment["counterevidence"]:
            items.append(
                {
                    "evidence_type": "counterevidence",
                    "excerpt": "Counterevidence or missing proof: " + "; ".join(assessment["counterevidence"]),
                }
            )
        return items

    def _store_assessment_and_evidence(
        self,
        *,
        brand: dict[str, Any],
        observation: dict[str, Any],
        raw_record: dict[str, Any],
        actor: str,
    ) -> tuple[dict[str, Any], str, list[str]]:
        """Persist one immutable detector result and its evidence rows."""

        assets = self.list_assets(brand["id"])
        assessment = assess_observation(brand=brand, assets=assets, observation=observation)
        assessment_id = new_id("assessment")
        now = utc_now()
        evidence_ids: list[str] = []
        evidence_items = self._evidence_items(raw_record, assessment)
        with self.db.transaction() as connection:
            connection.execute(
                """
                INSERT INTO assessments (
                    id, candidate_id, observation_id, detector_name, detector_version,
                    identity_resemblance, authorization_state, authorization_conflict,
                    potential_harm_level, observed_harm, evidence_quality, exposure_or_recency,
                    queue_priority, decision_state, reasons_json, counterevidence_json, missing_json,
                    assessment_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    assessment_id,
                    observation["candidate_id"],
                    observation["id"],
                    assessment["detector_name"],
                    assessment["detector_version"],
                    assessment["identity_resemblance"],
                    assessment["authorization_state"],
                    assessment["authorization_conflict"],
                    assessment["potential_harm_level"],
                    assessment["observed_harm"],
                    assessment["evidence_quality"],
                    assessment["exposure_or_recency"],
                    assessment["queue_priority"],
                    assessment["decision_state"],
                    json_text(assessment["reasons"]),
                    json_text(assessment["counterevidence"]),
                    json_text(assessment["missing"]),
                    json_text(assessment),
                    now,
                ),
            )
            for item in evidence_items:
                evidence_id = new_id("evidence")
                evidence_ids.append(evidence_id)
                connection.execute(
                    """
                    INSERT INTO evidence (
                        id, observation_id, assessment_id, evidence_type, source_locator,
                        excerpt, integrity_hash, retention_class, retention_expires_at, legal_hold, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        evidence_id,
                        observation["id"],
                        assessment_id,
                        item["evidence_type"],
                        observation.get("source_locator"),
                        item["excerpt"],
                        sha256_json({"observation_id": observation["id"], **item}),
                        observation.get("retention_class", DEFAULT_RETENTION_CLASS),
                        observation.get("retention_expires_at"),
                        1 if observation.get("legal_hold") else 0,
                        now,
                    ),
                )
        return assessment, assessment_id, evidence_ids

    @staticmethod
    def _connector_failure_result(
        *,
        connector_key: str,
        operation: str,
        availability: str,
        source_status: str,
        error_code: str | None,
        error_message: str | None,
    ) -> dict[str, Any]:
        return {
            "connector_key": connector_key,
            "operation": operation,
            "source_mode": "permitted_connector",
            "source_status": source_status,
            "availability": availability,
            "next_action": "enable_source_rights_or_use_user_submitted_reference",
            "error_code": error_code,
            "error_message": error_message,
            "evidence_mode": "permitted_connector",
        }

    def intake_user_submitted(
        self,
        brand_id: str,
        payload: dict[str, Any],
        *,
        idempotency_key: str | None = None,
        actor: str = "local.owner",
    ) -> dict[str, Any]:
        """Persist a user-submitted social/app reference and safe metadata.

        The default path is metadata-only and makes no external request.  A
        caller may explicitly request a bounded metadata fetch with
        ``fetch_metadata=true``; only the HTTP boundary in ``source_security``
        can then contact the submitted host.
        """

        brand = self.get_brand(brand_id)
        input_type = str(payload.get("input_type") or payload.get("asset_type") or "").strip().casefold()
        if input_type in {"social_profile", "profile", "profile_url", "social_url"}:
            asset_type = "social_profile"
            connector_key = USER_SUBMITTED_SOCIAL_KEY
        elif input_type in {"mobile_app", "app", "app_listing", "app_listing_url", "listing_url", "store_id"}:
            asset_type = "mobile_app"
            connector_key = USER_SUBMITTED_APP_KEY
        else:
            raise DomainError(
                422,
                "Unsupported asset type",
                "input_type must declare a social profile URL or mobile app listing URL/store ID.",
                error_type="https://cairnwise.local/problems/unsupported-source",
            )

        value = str(payload.get("value") or payload.get("url") or payload.get("listing_url") or "").strip()
        if input_type == "store_id" and not value:
            value = str(payload.get("store_id") or "").strip()
        metadata_input = payload.get("metadata")
        if metadata_input is not None and not isinstance(metadata_input, dict):
            raise DomainError(422, "Validation failed", "metadata must be a JSON object.")
        submitted_metadata = sanitize_metadata(metadata_input or {})
        source_locator: str
        if input_type == "store_id":
            if not value or len(value) > 256:
                raise DomainError(422, "Validation failed", "A store_id is required and must be short.")
            source_locator = f"store-id://{value}"
        else:
            try:
                source_locator = canonicalize_url(value).canonical
            except SourceSecurityError as error:
                raise DomainError(
                    422,
                    "Unsafe source URL",
                    error.detail,
                    error_type="https://cairnwise.local/problems/source-url",
                ) from error

        connector = self.db.fetch_one("SELECT * FROM connectors WHERE connector_key = ?", (connector_key,))
        if not connector:
            raise DomainError(503, "Connector unavailable", f"Connector {connector_key} is not registered.")
        if idempotency_key:
            existing = self.db.fetch_one(
                "SELECT id FROM source_runs WHERE brand_id = ? AND idempotency_key = ?",
                (brand_id, idempotency_key),
            )
            if existing:
                return self._run_result(existing["id"])

        run_id = new_id("run")
        now = utc_now()
        rights = self._manifest_from_row(connector)
        with self.db.transaction() as connection:
            connection.execute(
                """
                INSERT INTO source_runs (
                    id, workspace_id, brand_id, connector_id, operation, source_mode,
                    idempotency_key, status, availability_state, started_at, source_rights_json,
                    response_meta_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    brand["workspace_id"],
                    brand_id,
                    connector["id"],
                    "intake_metadata",
                    "user_submitted",
                    idempotency_key,
                    "running",
                    "available",
                    now,
                    json_text(rights.get("rights") or {}),
                    json_text({"actor": actor, "fetch_requested": bool(payload.get("fetch_metadata"))}),
                ),
            )

        availability = "available"
        source_status = "user_submitted"
        fetch_meta: dict[str, Any] = {}
        if payload.get("fetch_metadata") is True and input_type != "store_id":
            try:
                response = self.fetcher.fetch(source_locator)
                fetch_meta = {
                    "status_code": response.status_code,
                    "content_type": response.content_type,
                    "redirect_chain": response.redirect_chain,
                    "error_code": response.error_code,
                }
                availability = response.availability
                source_status = response.source_status
                if response.available and response.content_type and response.content_type.endswith("json"):
                    try:
                        parsed = json.loads(response.body.decode("utf-8"))
                    except (UnicodeDecodeError, json.JSONDecodeError):
                        availability = "unavailable"
                        source_status = "failed"
                        fetch_meta["error_code"] = "invalid_json"
                    else:
                        if isinstance(parsed, dict):
                            # Preserve only a bounded metadata envelope.  The
                            # response body itself is never stored or executed.
                            submitted_metadata["fetched"] = sanitize_metadata(parsed)
                elif not response.available:
                    availability = response.availability
            except SourceSecurityError as error:
                if error.code in {"blocked_host", "blocked_ip", "credentials_not_allowed", "unsupported_scheme", "invalid_url"}:
                    raise DomainError(422, "Unsafe source URL", error.detail, error_type="https://cairnwise.local/problems/source-url") from error
                availability = "unavailable"
                source_status = "failed"
                fetch_meta = {"error_code": error.code}

        source_identity = str(
            submitted_metadata.get("stable_id")
            or submitted_metadata.get("stable_external_id")
            or submitted_metadata.get("store_id")
            or submitted_metadata.get("bundle_id")
            or source_locator
        )
        record = {
            "asset_type": asset_type,
            "source_identity": source_identity,
            "source_locator": source_locator,
            "source_status": source_status,
            "availability_state": availability,
            "submitted_metadata": submitted_metadata,
            **submitted_metadata,
        }
        observation = self._store_observation(
            brand,
            record,
            run_id,
            "user_submitted",
            source_rights=rights,
        )
        assessment, assessment_id, evidence_ids = self._store_assessment_and_evidence(
            brand=brand,
            observation=observation,
            raw_record=record,
            actor=actor,
        )
        result = {
            "source_run_id": run_id,
            "candidate_id": observation["candidate_id"],
            "observation_id": observation["id"],
            "assessment_id": assessment_id,
            "source_mode": "user_submitted",
            "evidence_mode": "user_submitted",
            "source_status": source_status,
            "availability": availability,
            "next_action": "review_submitted_metadata" if availability == "available" else "retry_or_use_another_permitted_source",
            "supporting_evidence_ids": evidence_ids,
            "source_rights": rights.get("rights", {}),
            "fetch": fetch_meta,
        }
        run_status = "completed" if availability == "available" else availability
        with self.db.transaction() as connection:
            connection.execute(
                """
                UPDATE source_runs
                   SET status = ?, availability_state = ?, ended_at = ?, record_count = ?,
                       response_meta_json = ?, result_json = ?
                 WHERE id = ?
                """,
                (
                    run_status,
                    availability,
                    utc_now(),
                    1,
                    json_text(fetch_meta),
                    json_text(result),
                    run_id,
                ),
            )
        candidate = self.get_candidate(observation["candidate_id"])
        candidate.update(result)
        candidate["source_run"] = self.get_source_run(run_id)
        return candidate

    def run_connector(
        self,
        brand_id: str,
        payload: dict[str, Any],
        *,
        idempotency_key: str | None = None,
        actor: str = "local.owner",
    ) -> dict[str, Any]:
        """Run an explicitly enabled connector contract, or record its state."""

        brand = self.get_brand(brand_id)
        connector_key = str(payload.get("connector_key") or "").strip()
        operation = str(payload.get("operation") or "").strip()
        if not connector_key or not operation:
            raise DomainError(422, "Validation failed", "connector_key and operation are required.")
        connector = self.db.fetch_one("SELECT * FROM connectors WHERE connector_key = ?", (connector_key,))
        if not connector:
            raise DomainError(404, "Connector not found", f"No connector manifest exists for {connector_key}.")
        if idempotency_key:
            existing = self.db.fetch_one(
                "SELECT id FROM source_runs WHERE brand_id = ? AND idempotency_key = ?",
                (brand_id, idempotency_key),
            )
            if existing:
                return self._run_result(existing["id"])
        run_id = new_id("run")
        started_at = utc_now()
        manifest = self._manifest_from_row(connector)
        with self.db.transaction() as connection:
            connection.execute(
                """
                INSERT INTO source_runs (
                    id, workspace_id, brand_id, connector_id, operation, source_mode,
                    idempotency_key, status, availability_state, started_at, source_rights_json,
                    response_meta_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    brand["workspace_id"],
                    brand_id,
                    connector["id"],
                    operation,
                    "permitted_connector",
                    idempotency_key,
                    "running",
                    "available",
                    started_at,
                    json_text(manifest.get("rights") or {}),
                    json_text({"actor": actor, "connector": connector_key}),
                ),
            )

        try:
            adapter = self.connector_registry.adapter(connector_key)
            connector_result = adapter.run(operation, **payload)
        except ConnectorError as error:
            result = self._connector_failure_result(
                connector_key=connector_key,
                operation=operation,
                availability=error.availability,
                source_status="unsupported" if error.availability == "unsupported" else "unavailable",
                error_code=error.code,
                error_message=error.detail,
            )
            with self.db.transaction() as connection:
                connection.execute(
                    """
                    UPDATE source_runs SET status = ?, availability_state = ?, ended_at = ?,
                        error_code = ?, error_message = ?, response_meta_json = ?, result_json = ? WHERE id = ?
                    """,
                    (
                        result["source_status"],
                        result["availability"],
                        utc_now(),
                        error.code,
                        error.detail,
                        json_text({"actor": actor}),
                        json_text(result),
                        run_id,
                    ),
                )
            return {**result, "source_run_id": run_id, "source_run": self.get_source_run(run_id)}

        records = connector_result.records
        candidate_results: list[dict[str, Any]] = []
        if connector_result.available:
            for record in records:
                record = {**record, "source_status": connector_result.source_status, "availability_state": connector_result.availability}
                observation = self._store_observation(
                    brand,
                    record,
                    run_id,
                    "permitted_connector",
                    source_rights=manifest,
                )
                assessment, assessment_id, evidence_ids = self._store_assessment_and_evidence(
                    brand=brand,
                    observation=observation,
                    raw_record=record,
                    actor=actor,
                )
                candidate_results.append(
                    {
                        "candidate_id": observation["candidate_id"],
                        "observation_id": observation["id"],
                        "assessment_id": assessment_id,
                        "supporting_evidence_ids": evidence_ids,
                    }
                )
        result = {
            "source_run_id": run_id,
            "connector_key": connector_key,
            "operation": operation,
            "source_mode": "permitted_connector",
            "evidence_mode": "permitted_connector",
            "source_status": connector_result.source_status,
            "availability": connector_result.availability,
            "record_count": len(records),
            "items": candidate_results,
            "response_meta": connector_result.response_meta,
            "error_code": connector_result.error_code,
            "error_message": connector_result.error_message,
            "source_rights": manifest.get("rights", {}),
        }
        status = "completed" if connector_result.available else connector_result.source_status
        with self.db.transaction() as connection:
            connection.execute(
                """
                UPDATE source_runs SET status = ?, availability_state = ?, ended_at = ?, record_count = ?,
                    error_code = ?, error_message = ?, response_meta_json = ?, result_json = ? WHERE id = ?
                """,
                (
                    status,
                    connector_result.availability,
                    utc_now(),
                    len(records),
                    connector_result.error_code,
                    connector_result.error_message,
                    json_text(connector_result.response_meta),
                    json_text(result),
                    run_id,
                ),
            )
        result["source_run"] = self.get_source_run(run_id)
        return result

    def _run_result(self, run_id: str) -> dict[str, Any]:
        row = self.db.fetch_one("SELECT * FROM source_runs WHERE id = ?", (run_id,))
        if not row:
            raise DomainError(404, "Source run not found", f"No source run exists for id {run_id}.")
        result = _decode(row["result_json"], {})
        if row["status"] == "completed" and result.get("candidate_id"):
            candidate = self.get_candidate(result["candidate_id"])
            candidate["source_run"] = self._source_run_from_row(row)
            return candidate
        return {**result, "source_run": self._source_run_from_row(row)}

    def get_source_run(self, run_id: str) -> dict[str, Any]:
        row = self.db.fetch_one("SELECT * FROM source_runs WHERE id = ?", (run_id,))
        if not row:
            raise DomainError(404, "Source run not found", f"No source run exists for id {run_id}.")
        return self._source_run_from_row(row)

    def _source_run_from_row(self, row: Any) -> dict[str, Any]:
        result = dict(row)
        result["response_meta"] = _decode(result.pop("response_meta_json", None), {})
        result["source_rights"] = _decode(result.pop("source_rights_json", None), {}) if "source_rights_json" in result else {}
        result["result"] = _decode(result.pop("result_json", None), {})
        return result

    def get_candidate(self, candidate_id: str) -> dict[str, Any]:
        row = self.db.fetch_one("SELECT * FROM candidates WHERE id = ?", (candidate_id,))
        if not row:
            raise DomainError(404, "Candidate not found", f"No candidate exists for id {candidate_id}.")
        candidate = dict(row)
        observation = self.db.fetch_one(
            "SELECT * FROM observations WHERE candidate_id = ? ORDER BY collected_at DESC, rowid DESC LIMIT 1",
            (candidate_id,),
        )
        assessment = self.db.fetch_one(
            "SELECT * FROM assessments WHERE candidate_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1",
            (candidate_id,),
        )
        candidate["latest_observation"] = self._observation_from_row(observation) if observation else None
        candidate["latest_assessment"] = self._assessment_from_row(assessment) if assessment else None
        if assessment:
            evidence_rows = self.db.fetch_all(
                "SELECT * FROM evidence WHERE assessment_id = ? ORDER BY created_at",
                (assessment["id"],),
            )
            candidate["evidence"] = [self._evidence_from_row(item) for item in evidence_rows]
        else:
            candidate["evidence"] = []
        case_row = self.db.fetch_one(
            "SELECT * FROM cases WHERE candidate_id = ? ORDER BY opened_at DESC, rowid DESC LIMIT 1",
            (candidate_id,),
        )
        candidate["case"] = self._case_from_row(case_row) if case_row else None
        return candidate

    def assess_candidate(self, candidate_id: str, *, actor: str = "local.owner") -> dict[str, Any]:
        """Re-run the deterministic detector without rewriting history."""

        candidate = self.get_candidate(candidate_id)
        observation = candidate.get("latest_observation")
        if not observation:
            raise DomainError(409, "Observation required", "A candidate must have an observation before assessment.")
        brand = self.get_brand(candidate["brand_id"])
        assets = self.list_assets(candidate["brand_id"])
        detector_input = {
            **observation,
            "asset_type": candidate["asset_type"],
            "source_mode": observation.get("source_mode"),
            "availability_state": observation.get("availability_state"),
            "raw": observation.get("raw", {}),
        }
        assessment = assess_observation(brand=brand, assets=assets, observation=detector_input)
        assessment_id = new_id("assessment")
        now = utc_now()
        evidence_ids: list[str] = []
        evidence_items = self._evidence_items(observation.get("raw", {}), assessment)
        with self.db.transaction() as connection:
            connection.execute(
                """
                INSERT INTO assessments (
                    id, candidate_id, observation_id, detector_name, detector_version,
                    identity_resemblance, authorization_state, authorization_conflict,
                    potential_harm_level, observed_harm, evidence_quality, exposure_or_recency,
                    queue_priority, decision_state, reasons_json, counterevidence_json, missing_json,
                    assessment_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    assessment_id,
                    candidate_id,
                    observation["id"],
                    assessment["detector_name"],
                    assessment["detector_version"],
                    assessment["identity_resemblance"],
                    assessment["authorization_state"],
                    assessment["authorization_conflict"],
                    assessment["potential_harm_level"],
                    assessment["observed_harm"],
                    assessment["evidence_quality"],
                    assessment["exposure_or_recency"],
                    assessment["queue_priority"],
                    assessment["decision_state"],
                    json_text(assessment["reasons"]),
                    json_text(assessment["counterevidence"]),
                    json_text(assessment["missing"]),
                    json_text(assessment),
                    now,
                ),
            )
            for item in evidence_items:
                evidence_id = new_id("evidence")
                evidence_ids.append(evidence_id)
                connection.execute(
                    """
                    INSERT INTO evidence (
                        id, observation_id, assessment_id, evidence_type, source_locator,
                        excerpt, integrity_hash, retention_class, retention_expires_at, legal_hold, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        evidence_id,
                        observation["id"],
                        assessment_id,
                        item["evidence_type"],
                        observation.get("source_locator"),
                        item["excerpt"],
                        sha256_json({"observation_id": observation["id"], **item}),
                        observation.get("retention_class", DEFAULT_RETENTION_CLASS),
                        observation.get("retention_expires_at"),
                        1 if observation.get("legal_hold") else 0,
                        now,
                    ),
                )
        refreshed = self.get_candidate(candidate_id)
        refreshed["assessment_created_by"] = actor
        refreshed["assessment_id"] = assessment_id
        refreshed["supporting_evidence_ids"] = evidence_ids
        refreshed["assessment_recheck"] = True
        return refreshed

    def _observation_from_row(self, row: Any) -> dict[str, Any]:
        result = dict(row)
        result["raw"] = _decode(result.pop("raw_json", None), {})
        result["normalized"] = _decode(result.pop("normalized_json", None), {})
        result["source_rights"] = _decode(result.pop("source_rights_json", None), {}) if "source_rights_json" in result else {}
        return result

    def _assessment_from_row(self, row: Any) -> dict[str, Any]:
        result = dict(row)
        result["reasons"] = _decode(result.pop("reasons_json", None), [])
        result["counterevidence"] = _decode(result.pop("counterevidence_json", None), [])
        result["missing"] = _decode(result.pop("missing_json", None), [])
        result["detector"] = {"name": result["detector_name"], "version": result["detector_version"]}
        trace = _decode(result.pop("assessment_json", None), {})
        result["trace"] = trace.get("trace", {}) if isinstance(trace, dict) else {}
        result["source_state"] = trace.get("source_state") if isinstance(trace, dict) else None
        result["baseline_state"] = trace.get("baseline_state") if isinstance(trace, dict) else None
        result["abstention_reason"] = trace.get("abstention_reason") if isinstance(trace, dict) else None
        result["visual"] = trace.get("visual") if isinstance(trace, dict) else None
        result["dimensions"] = (
            trace.get("dimensions")
            if isinstance(trace, dict) and isinstance(trace.get("dimensions"), dict)
            else {
                "identity_resemblance": {"value": result["identity_resemblance"], "signals": result["reasons"]},
                "authorization": {"state": result["authorization_state"], "signals": result["reasons"]},
                "potential_harm": {"level": result["potential_harm_level"], "value": result["observed_harm"], "signals": result["reasons"]},
                "evidence_quality": {"value": result["evidence_quality"], "missing": result["missing"]},
            }
        )
        return result

    def _evidence_from_row(self, row: Any) -> dict[str, Any]:
        result = dict(row)
        result["legal_hold"] = bool(result.get("legal_hold"))
        return result

    def _case_from_row(self, row: Any) -> dict[str, Any]:
        result = dict(row)
        events = self.db.fetch_all("SELECT * FROM case_events WHERE case_id = ? ORDER BY created_at, rowid", (row["id"],))
        result["events"] = [self._case_event_from_row(event) for event in events]
        drafts = self.db.fetch_all("SELECT * FROM report_drafts WHERE case_id = ? ORDER BY created_at DESC", (row["id"],))
        result["report_drafts"] = [self._report_draft_from_row(draft) for draft in drafts]
        return result

    def _case_event_from_row(self, row: Any) -> dict[str, Any]:
        result = dict(row)
        result["before"] = _decode(result.pop("before_json", None), None)
        result["after"] = _decode(result.pop("after_json", None), None)
        return result

    def _report_draft_from_row(self, row: Any) -> dict[str, Any]:
        result = dict(row)
        result["content"] = _decode(result.pop("content_json", None), {})
        return result

    def create_case(self, candidate_id: str, payload: dict[str, Any], *, actor: str = "local.owner") -> dict[str, Any]:
        candidate = self.get_candidate(candidate_id)
        assessment = candidate.get("latest_assessment")
        if not assessment:
            raise DomainError(409, "Assessment required", "A candidate must have an assessment before a case can be opened.")
        existing = self.db.fetch_one(
            "SELECT * FROM cases WHERE candidate_id = ? AND closed_at IS NULL ORDER BY opened_at DESC LIMIT 1",
            (candidate_id,),
        )
        if existing:
            return self._case_from_row(existing)
        case_id = new_id("case")
        now = utc_now()
        owner = str(payload.get("owner") or actor)
        priority = float(assessment["queue_priority"])
        with self.db.transaction() as connection:
            connection.execute(
                """
                INSERT INTO cases (id, brand_id, candidate_id, assessment_id, owner, priority, opened_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (case_id, candidate["brand_id"], candidate_id, assessment["id"], owner, priority, now),
            )
            connection.execute(
                """
                INSERT INTO case_events (id, case_id, actor, action, before_json, after_json, reason, created_at, request_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    new_id("event"),
                    case_id,
                    actor,
                    "case_opened",
                    None,
                    json_text({"disposition": "open", "owner": owner, "priority": priority}),
                    "Candidate requires human review.",
                    now,
                    payload.get("request_id"),
                ),
            )
        row = self.db.fetch_one("SELECT * FROM cases WHERE id = ?", (case_id,))
        return self._case_from_row(row)

    def get_case(self, case_id: str) -> dict[str, Any]:
        row = self.db.fetch_one("SELECT * FROM cases WHERE id = ?", (case_id,))
        if not row:
            raise DomainError(404, "Case not found", f"No case exists for id {case_id}.")
        return self._case_from_row(row)

    def record_decision(
        self,
        case_id: str,
        payload: dict[str, Any],
        *,
        actor: str = "local.owner",
    ) -> dict[str, Any]:
        current = self.get_case(case_id)
        disposition = str(payload.get("disposition") or "").strip()
        allowed = {
            "confirmed_legitimate",
            "monitor",
            "investigate",
            "insufficient_evidence",
            "confirmed_impersonation_under_policy",
        }
        if disposition not in allowed:
            raise DomainError(422, "Invalid disposition", f"Choose one of: {', '.join(sorted(allowed))}.")
        if disposition == "confirmed_impersonation_under_policy" and payload.get("reviewer_approved") is not True:
            raise DomainError(
                409,
                "Reviewer approval required",
                "A consequential impersonation disposition requires explicit reviewer_approved=true.",
            )
        reason = str(payload.get("reason") or "").strip()
        if not reason:
            raise DomainError(422, "Validation failed", "A decision reason is required.")
        terminal = disposition in {"confirmed_legitimate", "insufficient_evidence", "confirmed_impersonation_under_policy"}
        now = utc_now()
        before = {"disposition": current["disposition"], "closed_at": current["closed_at"]}
        after = {"disposition": disposition, "closed_at": now if terminal else None}
        with self.db.transaction() as connection:
            connection.execute(
                "UPDATE cases SET disposition = ?, closed_at = ?, closure_basis = ? WHERE id = ?",
                (disposition, after["closed_at"], reason if terminal else None, case_id),
            )
            connection.execute(
                """
                INSERT INTO case_events (id, case_id, actor, action, before_json, after_json, reason, created_at, request_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    new_id("event"),
                    case_id,
                    actor,
                    "decision_recorded",
                    json_text(before),
                    json_text(after),
                    reason,
                    now,
                    payload.get("request_id"),
                ),
            )
        return self.get_case(case_id)

    def create_report_draft(self, case_id: str, *, actor: str = "local.owner") -> dict[str, Any]:
        case = self.get_case(case_id)
        candidate = self.get_candidate(case["candidate_id"])
        assessment = candidate.get("latest_assessment") or {}
        observation = candidate.get("latest_observation") or {}
        evidence = candidate.get("evidence", [])
        content = {
            "report_type": "platform_review_draft",
            "status": "draft",
            "generated_by": actor,
            "candidate": {
                "candidate_id": candidate["id"],
                "asset_type": candidate["asset_type"],
                "source_identity": candidate["source_identity"],
                "canonical_locator": candidate["canonical_locator"],
            },
            "observed_facts": [item["excerpt"] for item in evidence if item["evidence_type"] == "source_observation"],
            "comparison_signals": assessment.get("reasons", []),
            "authorization": assessment.get("authorization_state"),
            "potential_harm": assessment.get("potential_harm_level"),
            "limitations": [
                "Similarity is a signal, not proof of impersonation or intent.",
                f"Source mode is {observation.get('source_mode')}; this record is not live coverage.",
                *assessment.get("counterevidence", []),
            ],
            "evidence_ids": [item["id"] for item in evidence],
            "next_action": "An authorized reviewer must validate the evidence and choose the platform-specific process.",
        }
        draft_id = new_id("draft")
        with self.db.transaction() as connection:
            connection.execute(
                "INSERT INTO report_drafts (id, case_id, content_json, created_at) VALUES (?, ?, ?, ?)",
                (draft_id, case_id, json_text(content), utc_now()),
            )
        row = self.db.fetch_one("SELECT * FROM report_drafts WHERE id = ?", (draft_id,))
        return self._report_draft_from_row(row)

    def _write_audit_event(
        self,
        *,
        workspace_id: str,
        actor: str,
        event_type: str,
        entity_type: str,
        entity_id: str | None,
        details: dict[str, Any],
        request_id: str | None = None,
    ) -> str:
        event_id = new_id("audit")
        with self.db.transaction() as connection:
            connection.execute(
                """
                INSERT INTO audit_events (
                    id, workspace_id, actor, event_type, entity_type, entity_id,
                    details_json, request_id, created_at, retention_class
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    event_id,
                    workspace_id,
                    actor,
                    event_type,
                    entity_type,
                    entity_id,
                    json_text(details),
                    request_id,
                    utc_now(),
                    DEFAULT_AUDIT_RETENTION_CLASS,
                ),
            )
        return event_id

    def _candidate_export_context(self, candidate_id: str) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any]]:
        candidate = self.get_candidate(candidate_id)
        brand = self.get_brand(candidate["brand_id"])
        workspace = self.get_workspace(brand["workspace_id"])
        observation = candidate.get("latest_observation") or {}
        run_row = self.db.fetch_one(
            """
            SELECT c.*
              FROM connectors c
              JOIN source_runs sr ON sr.connector_id = c.id
             WHERE sr.id = ?
             LIMIT 1
            """,
            (observation.get("source_run_id"),),
        )
        manifest = self._manifest_from_row(run_row) if run_row else {}
        return workspace, brand, candidate, manifest

    def export_candidate_evidence(
        self,
        candidate_id: str,
        *,
        export_format: str = "json",
        actor: str = "local.owner",
        request_id: str | None = None,
    ) -> dict[str, Any]:
        """Return a private, tenant-scoped evidence export and audit receipt."""

        export_format = str(export_format or "json").casefold()
        if export_format not in {"json", "csv"}:
            raise DomainError(422, "Unsupported export format", "format must be json or csv.")
        workspace, brand, candidate, manifest = self._candidate_export_context(candidate_id)
        payload = build_export_payload(
            workspace=workspace,
            brand=brand,
            candidate=candidate,
            observation=candidate.get("latest_observation"),
            assessment=candidate.get("latest_assessment"),
            evidence=candidate.get("evidence", []),
            connector_manifest=manifest,
        )
        audit_id = self._write_audit_event(
            workspace_id=workspace["id"],
            actor=actor,
            event_type="evidence_exported",
            entity_type="candidate",
            entity_id=candidate_id,
            details={
                "format": export_format,
                "export_hash": payload["export_hash"],
                "evidence_count": len(payload.get("evidence", [])),
                "source_mode": (payload.get("provenance") or {}).get("source_mode"),
                "public_url": None,
            },
            request_id=request_id,
        )
        if export_format == "csv":
            return {
                "format": "csv",
                "content_type": "text/csv; charset=utf-8",
                "content": export_csv(payload),
                "export_hash": payload["export_hash"],
                "audit_event_id": audit_id,
                "public_url": None,
            }
        payload["audit_event_id"] = audit_id
        return payload

    def retention_preview(self, workspace_id: str, *, as_of: str | None = None) -> dict[str, Any]:
        """Return expired/held counts without revealing deleted source content."""

        self.get_workspace(workspace_id)
        reference = utc_datetime(as_of)
        observation_rows = self.db.fetch_all(
            """
            SELECT o.id, o.collected_at, o.retention_class, o.retention_expires_at, o.legal_hold,
                   o.deleted_at, c.brand_id, b.workspace_id
              FROM observations o
              JOIN candidates c ON c.id = o.candidate_id
              JOIN brands b ON b.id = c.brand_id
             WHERE b.workspace_id = ? AND o.deleted_at IS NULL
            """,
            (workspace_id,),
        )
        evidence_rows = self.db.fetch_all(
            """
            SELECT e.id, e.created_at, e.retention_class, e.retention_expires_at, e.legal_hold,
                   e.deleted_at, b.workspace_id, e.observation_id
              FROM evidence e
              JOIN observations o ON o.id = e.observation_id
              JOIN candidates c ON c.id = o.candidate_id
              JOIN brands b ON b.id = c.brand_id
             WHERE b.workspace_id = ? AND e.deleted_at IS NULL
            """,
            (workspace_id,),
        )
        held_observation_ids = {row["id"] for row in observation_rows if bool(row["legal_hold"])}
        held_evidence_observation_ids = {row["observation_id"] for row in evidence_rows if bool(row["legal_hold"])}
        expired_observations = [
            row
            for row in observation_rows
            if not bool(row["legal_hold"])
            and row["retention_expires_at"]
            and utc_datetime(row["retention_expires_at"]) <= reference
            and row["id"] not in held_evidence_observation_ids
        ]
        expired_evidence = [
            row
            for row in evidence_rows
            if not bool(row["legal_hold"])
            and row["observation_id"] not in held_observation_ids
            and row["observation_id"] not in {row["id"] for row in expired_observations}
            and row["retention_expires_at"]
            and utc_datetime(row["retention_expires_at"]) <= reference
        ]
        held_count = sum(bool(row["legal_hold"]) for row in observation_rows) + sum(bool(row["legal_hold"]) for row in evidence_rows)
        return {
            "workspace_id": workspace_id,
            "as_of": utc_iso(reference),
            "expired_observations": len(expired_observations),
            "expired_evidence": len(expired_evidence),
            "held_objects": held_count,
            "deletion_candidate_ids": {
                "observations": [row["id"] for row in expired_observations],
                "evidence": [row["id"] for row in expired_evidence],
            },
            "legal_hold_observation_ids": sorted(held_observation_ids),
            "action_required": "explicit_admin_confirmation",
        }

    def set_legal_hold(
        self,
        workspace_id: str,
        object_type: str,
        object_id: str,
        *,
        hold: bool,
        actor: str,
        reason: str,
        request_id: str | None = None,
    ) -> dict[str, Any]:
        if object_type not in {"observation", "evidence"}:
            raise DomainError(422, "Validation failed", "object_type must be observation or evidence.")
        if not reason.strip():
            raise DomainError(422, "Validation failed", "A legal hold reason is required.")
        if object_type == "observation":
            row = self.db.fetch_one(
                """
                SELECT o.id, b.workspace_id FROM observations o
                JOIN candidates c ON c.id = o.candidate_id
                JOIN brands b ON b.id = c.brand_id
                WHERE o.id = ? AND b.workspace_id = ?
                """,
                (object_id, workspace_id),
            )
            table = "observations"
        else:
            row = self.db.fetch_one(
                """
                SELECT e.id, b.workspace_id FROM evidence e
                JOIN observations o ON o.id = e.observation_id
                JOIN candidates c ON c.id = o.candidate_id
                JOIN brands b ON b.id = c.brand_id
                WHERE e.id = ? AND b.workspace_id = ?
                """,
                (object_id, workspace_id),
            )
            table = "evidence"
        if not row:
            raise DomainError(404, "Retention object not found", "The requested retention object is not available.")
        if hold:
            values = (1, "legal_hold", None, object_id)
        else:
            expires = utc_iso()
            values = (0, DEFAULT_RETENTION_CLASS, expires, object_id)
        with self.db.transaction() as connection:
            connection.execute(
                f"UPDATE {table} SET legal_hold = ?, retention_class = ?, retention_expires_at = ? WHERE id = ?",
                values,
            )
        audit_id = self._write_audit_event(
            workspace_id=workspace_id,
            actor=actor,
            event_type="legal_hold_updated",
            entity_type=object_type,
            entity_id=object_id,
            details={"hold": hold, "reason": reason},
            request_id=request_id,
        )
        return {"object_type": object_type, "object_id": object_id, "legal_hold": hold, "audit_event_id": audit_id}

    def execute_retention(
        self,
        workspace_id: str,
        *,
        actor: str,
        confirm: bool,
        as_of: str | None = None,
        request_id: str | None = None,
    ) -> dict[str, Any]:
        if confirm is not True:
            raise DomainError(409, "Explicit confirmation required", "Retention deletion requires confirm=true.")
        preview = self.retention_preview(workspace_id, as_of=as_of)
        observation_ids = list(preview["deletion_candidate_ids"]["observations"])
        evidence_ids = list(preview["deletion_candidate_ids"]["evidence"])
        # Include cascaded evidence in the proof hash before deleting its
        # observation parent; the proof itself contains no deleted content.
        cascaded_evidence = []
        if observation_ids:
            placeholders = ",".join("?" for _ in observation_ids)
            cascaded_evidence = [
                row["id"]
                for row in self.db.fetch_all(
                    f"SELECT id FROM evidence WHERE observation_id IN ({placeholders})",
                    tuple(observation_ids),
                )
            ]
        all_ids = observation_ids + evidence_ids + cascaded_evidence
        requested_at = utc_now()
        proof_id = new_id("deletion")
        record_hash = ids_hash(all_ids)
        details = {
            "as_of": preview["as_of"],
            "observation_ids_count": len(observation_ids),
            "evidence_ids_count": len(evidence_ids) + len(cascaded_evidence),
            "held_objects": preview["held_objects"],
        }
        proof_hash = content_hash({"proof_id": proof_id, "record_ids_hash": record_hash, "requested_at": requested_at, **details})
        completed_at = utc_now()
        with self.db.transaction() as connection:
            connection.execute(
                """
                INSERT INTO deletion_proofs (
                    id, workspace_id, actor, object_type, requested_at, completed_at,
                    deleted_count, held_count, record_ids_hash, content_hash, status, details_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    proof_id,
                    workspace_id,
                    actor,
                    "retention_expiry",
                    requested_at,
                    completed_at,
                    len(all_ids),
                    preview["held_objects"],
                    record_hash,
                    proof_hash,
                    "completed",
                    json_text(details),
                ),
            )
            if evidence_ids:
                placeholders = ",".join("?" for _ in evidence_ids)
                connection.execute(
                    f"DELETE FROM evidence WHERE id IN ({placeholders}) AND legal_hold = 0",
                    tuple(evidence_ids),
                )
            if observation_ids:
                placeholders = ",".join("?" for _ in observation_ids)
                connection.execute(
                    f"DELETE FROM observations WHERE id IN ({placeholders}) AND legal_hold = 0",
                    tuple(observation_ids),
                )
        audit_id = self._write_audit_event(
            workspace_id=workspace_id,
            actor=actor,
            event_type="retention_deletion_executed",
            entity_type="deletion_proof",
            entity_id=proof_id,
            details={"proof_hash": proof_hash, "deleted_count": len(all_ids), "held_count": preview["held_objects"]},
            request_id=request_id,
        )
        return {
            "deletion_proof_id": proof_id,
            "proof_hash": proof_hash,
            "record_ids_hash": record_hash,
            "deleted_count": len(all_ids),
            "held_count": preview["held_objects"],
            "completed_at": completed_at,
            "audit_event_id": audit_id,
        }

    def coverage(self, brand_id: str) -> dict[str, Any]:
        brand = self.get_brand(brand_id)
        connectors = self.db.fetch_all("SELECT * FROM connectors ORDER BY connector_key")
        coverage = []
        for connector in connectors:
            latest = self.db.fetch_one(
                """
                SELECT * FROM source_runs WHERE brand_id = ? AND connector_id = ?
                ORDER BY started_at DESC, rowid DESC LIMIT 1
                """,
                (brand_id, connector["id"]),
            )
            manifest = _decode(connector["manifest_json"], {})
            if not bool(connector["enabled"]):
                state = "unavailable"
                last_run = None
            elif not latest:
                state = "not_evaluated"
                last_run = None
            else:
                state = {
                    "completed": "operational",
                    "unavailable": "unavailable",
                    "degraded": "degraded",
                    "running": "degraded",
                }.get(latest["status"], "degraded")
                last_run = self._source_run_from_row(latest)
            coverage.append(
                {
                    "connector_key": connector["connector_key"],
                    "source": connector["source"],
                    "asset_type": connector["asset_type"],
                    "state": state,
                    "operations": manifest.get("operations", []),
                    "fields": manifest.get("fields", []),
                    "source_mode": "synthetic_fixture" if connector["connector_key"].startswith("fixture.") else "permitted_connector",
                    "enabled": bool(connector["enabled"]),
                    "source_rights": manifest.get("rights", {}),
                    "last_run": last_run,
                }
            )
        return {
            "brand_id": brand_id,
            "brand_name": brand["name"],
            "coverage_contract": {
                "states": ["operational", "degraded", "unavailable", "unsupported", "stale", "not_evaluated"],
                "notice": "Fixture states are local verification evidence; permitted connectors require explicit rights and enablement.",
            },
            "connectors": coverage,
        }
