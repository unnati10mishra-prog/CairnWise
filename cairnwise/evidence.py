"""Evidence retention, legal hold, and tenant-scoped export helpers."""

from __future__ import annotations

import csv
import hashlib
import io
import json
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable, Mapping


RETENTION_CLASSES: dict[str, dict[str, Any]] = {
    "metadata_180d": {
        "days": 180,
        "description": "Normalized source metadata and provenance references",
        "content_kind": "metadata",
    },
    "raw_content_30d": {
        "days": 30,
        "description": "Short-lived raw source content, when explicitly permitted",
        "content_kind": "raw_content",
    },
    "audit_365d": {
        "days": 365,
        "description": "Audit and deletion proof records",
        "content_kind": "audit",
    },
    "legal_hold": {
        "days": None,
        "description": "Held until an authorized reviewer releases the hold",
        "content_kind": "held",
    },
}

DEFAULT_RETENTION_CLASS = "metadata_180d"
DEFAULT_AUDIT_RETENTION_CLASS = "audit_365d"


def utc_datetime(value: str | datetime | None = None) -> datetime:
    if value is None:
        return datetime.now(timezone.utc)
    if isinstance(value, datetime):
        parsed = value
    else:
        raw = str(value).strip()
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        parsed = datetime.fromisoformat(raw)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def utc_iso(value: datetime | None = None) -> str:
    return utc_datetime(value).isoformat(timespec="seconds").replace("+00:00", "Z")


def retention_metadata(retention_class: str | None = None, *, now: datetime | None = None, legal_hold: bool = False) -> dict[str, Any]:
    selected = retention_class or DEFAULT_RETENTION_CLASS
    if selected not in RETENTION_CLASSES:
        raise ValueError(f"Unsupported retention class: {selected}")
    held = bool(legal_hold or selected == "legal_hold")
    days = RETENTION_CLASSES[selected]["days"]
    expires_at = None if held or days is None else utc_iso(utc_datetime(now) + timedelta(days=int(days)))
    return {
        "class": "legal_hold" if held else selected,
        "expires_at": expires_at,
        "legal_hold": held,
        "description": RETENTION_CLASSES[selected]["description"],
    }


def content_hash(value: Any) -> str:
    if isinstance(value, bytes):
        payload = value
    else:
        payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def ids_hash(values: Iterable[str]) -> str:
    return content_hash(sorted(str(value) for value in values))


def _json_safe(value: Any, *, depth: int = 0, max_depth: int = 8, max_string: int = 16_384, max_items: int = 256) -> Any:
    """Copy untrusted metadata without executing or preserving exotic objects."""

    if depth > max_depth:
        return "[truncated-depth]"
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, str):
        return value[:max_string]
    if isinstance(value, (bytes, bytearray, memoryview)):
        return {"type": "bytes", "sha256": content_hash(bytes(value)), "length": len(value)}
    if isinstance(value, Mapping):
        return {
            str(key)[:256]: _json_safe(item, depth=depth + 1, max_depth=max_depth, max_string=max_string, max_items=max_items)
            for index, (key, item) in enumerate(value.items())
            if index < max_items
        }
    if isinstance(value, (list, tuple, set)):
        return [
            _json_safe(item, depth=depth + 1, max_depth=max_depth, max_string=max_string, max_items=max_items)
            for item in list(value)[:max_items]
        ]
    return str(value)[:max_string]


def sanitize_metadata(value: Any) -> dict[str, Any]:
    safe = _json_safe(value)
    return safe if isinstance(safe, dict) else {"value": safe}


def build_export_payload(
    *,
    workspace: Mapping[str, Any],
    brand: Mapping[str, Any],
    candidate: Mapping[str, Any],
    observation: Mapping[str, Any] | None,
    assessment: Mapping[str, Any] | None,
    evidence: Iterable[Mapping[str, Any]],
    connector_manifest: Mapping[str, Any] | None,
    exported_at: str | None = None,
) -> dict[str, Any]:
    """Build a provenance-first export without creating a public URL."""

    observation = observation or {}
    assessment = assessment or {}
    evidence_items = [dict(item) for item in evidence]
    manifest = dict(connector_manifest or {})
    rights = dict(manifest.get("rights") or {})
    source_mode = observation.get("source_mode") or candidate.get("source_mode") or "unknown"
    provenance = {
        "source_mode": source_mode,
        "source_run_id": observation.get("source_run_id"),
        "source_locator": observation.get("source_locator") or candidate.get("canonical_locator"),
        "observed_at": observation.get("observed_at"),
        "collected_at": observation.get("collected_at"),
        "availability_state": observation.get("availability_state") or candidate.get("availability_state"),
        "connector_key": manifest.get("connector_key"),
        "source": manifest.get("source"),
        "permissions": rights.get("permissions") or manifest.get("permissions"),
        "terms_basis": rights.get("terms_basis") or manifest.get("terms_basis"),
        "owner": rights.get("owner") or manifest.get("owner"),
    }
    retention = {
        "observation": {
            "class": observation.get("retention_class"),
            "expires_at": observation.get("retention_expires_at"),
            "legal_hold": bool(observation.get("legal_hold")),
        },
        "evidence": [
            {
                "id": item.get("id"),
                "class": item.get("retention_class"),
                "expires_at": item.get("retention_expires_at"),
                "legal_hold": bool(item.get("legal_hold")),
                "state": item.get("retention_state"),
            }
            for item in evidence_items
        ],
    }
    evidence_export = [
        {
            "id": item.get("id"),
            "observation_id": item.get("observation_id"),
            "assessment_id": item.get("assessment_id"),
            "evidence_type": item.get("evidence_type"),
            "source_locator": item.get("source_locator"),
            "excerpt": item.get("excerpt"),
            "integrity_hash": item.get("integrity_hash"),
            "retention_class": item.get("retention_class"),
            "retention_state": item.get("retention_state"),
            "legal_hold": bool(item.get("legal_hold")),
        }
        for item in evidence_items
    ]
    payload = {
        "export_version": "cw-evidence-export-1",
        "exported_at": exported_at or utc_iso(),
        "public_url": None,
        "workspace": {"id": workspace.get("id"), "name": workspace.get("name")},
        "brand": {"id": brand.get("id"), "name": brand.get("name")},
        "candidate": {
            "id": candidate.get("id"),
            "asset_type": candidate.get("asset_type"),
            "source_identity": candidate.get("source_identity"),
            "canonical_locator": candidate.get("canonical_locator"),
        },
        "provenance": provenance,
        "source_rights": {
            "connector_key": manifest.get("connector_key"),
            "permissions": rights.get("permissions") or manifest.get("permissions"),
            "terms_basis": rights.get("terms_basis") or manifest.get("terms_basis"),
            "fields": manifest.get("fields", []),
            "retention_class": rights.get("retention_class") or manifest.get("retention_class"),
            "image_rights": rights.get("image_rights") or manifest.get("image_rights"),
            "owner": rights.get("owner") or manifest.get("owner"),
            "enabled": manifest.get("enabled"),
        },
        "retention": retention,
        "observation": {
            "id": observation.get("id"),
            "source_mode": source_mode,
            "availability_state": observation.get("availability_state"),
            "content_hash": observation.get("content_hash"),
            "normalized": sanitize_metadata(observation.get("normalized") or {}),
            "metadata": sanitize_metadata((observation.get("raw") or {}).get("submitted_metadata", {}))
            if isinstance(observation.get("raw"), Mapping)
            else {},
        },
        "assessment": {
            "id": assessment.get("id"),
            "detector": assessment.get("detector"),
            "dimensions": sanitize_metadata(assessment.get("dimensions") or {}),
            "trace": sanitize_metadata(assessment.get("trace") or {}),
            "reasons": list(assessment.get("reasons") or []),
            "counterevidence": list(assessment.get("counterevidence") or []),
            "missing": list(assessment.get("missing") or []),
            "decision_state": assessment.get("decision_state"),
            "abstention_reason": assessment.get("abstention_reason"),
        },
        "evidence": evidence_export,
    }
    # The hash covers the exact JSON payload returned to the caller and is also
    # suitable as an export audit receipt.  It is not a public download token.
    payload["export_hash"] = content_hash(payload)
    return payload


def export_csv(payload: Mapping[str, Any]) -> str:
    """Render one tenant's evidence ledger as a deterministic CSV string."""

    output = io.StringIO(newline="")
    fields = [
        "workspace_id",
        "brand_id",
        "candidate_id",
        "source_mode",
        "connector_key",
        "source_locator",
        "observed_at",
        "collected_at",
        "availability_state",
        "evidence_id",
        "evidence_type",
        "evidence_hash",
        "excerpt",
        "retention_class",
        "retention_expires_at",
        "legal_hold",
        "terms_basis",
        "image_rights",
        "rights_owner",
        "assessment_trace",
    ]
    writer = csv.DictWriter(output, fieldnames=fields, lineterminator="\n")
    writer.writeheader()
    workspace = payload.get("workspace") or {}
    brand = payload.get("brand") or {}
    candidate = payload.get("candidate") or {}
    provenance = payload.get("provenance") or {}
    rights = payload.get("source_rights") or {}
    assessment = payload.get("assessment") or {}
    items = payload.get("evidence") or [{}]
    for item in items:
        writer.writerow(
            {
                "workspace_id": workspace.get("id"),
                "brand_id": brand.get("id"),
                "candidate_id": candidate.get("id"),
                "source_mode": provenance.get("source_mode"),
                "connector_key": provenance.get("connector_key"),
                "source_locator": provenance.get("source_locator"),
                "observed_at": provenance.get("observed_at"),
                "collected_at": provenance.get("collected_at"),
                "availability_state": provenance.get("availability_state"),
                "evidence_id": item.get("id"),
                "evidence_type": item.get("evidence_type"),
                "evidence_hash": item.get("integrity_hash"),
                "excerpt": item.get("excerpt"),
                "retention_class": item.get("retention_class"),
                "retention_expires_at": (payload.get("retention") or {}).get("evidence", [{}])[0].get("expires_at")
                if isinstance((payload.get("retention") or {}).get("evidence"), list)
                else None,
                "legal_hold": item.get("legal_hold"),
                "terms_basis": rights.get("terms_basis"),
                "image_rights": rights.get("image_rights"),
                "rights_owner": rights.get("owner"),
                "assessment_trace": json.dumps(assessment.get("trace") or {}, ensure_ascii=False, sort_keys=True),
            }
        )
    return output.getvalue()


__all__ = [
    "DEFAULT_AUDIT_RETENTION_CLASS",
    "DEFAULT_RETENTION_CLASS",
    "RETENTION_CLASSES",
    "build_export_payload",
    "content_hash",
    "export_csv",
    "ids_hash",
    "retention_metadata",
    "sanitize_metadata",
    "utc_datetime",
    "utc_iso",
]
