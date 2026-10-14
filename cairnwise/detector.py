"""Explainable deterministic assessment logic for social/app observations.

The detector is deliberately a policy layer over supplied metadata.  It does
not turn a name resemblance into an ownership or legal conclusion, and it
never trusts a candidate-provided numeric similarity score.  Official asset
exclusion is evaluated against every relevant registry asset, with platform or
store scope and active verified authorization checked before exclusion.
"""

from __future__ import annotations

from datetime import datetime, timezone
from difflib import SequenceMatcher
from hashlib import sha256
import re
from typing import Any
from urllib.parse import urlsplit

from .normalization import (
    NORMALIZATION_VERSION,
    canonical_url,
    compact_name,
    is_character_swap,
    normalize_text,
    risk_words,
    tokens,
    unicode_script_diagnostics,
)


DETECTOR_NAME = "cairnwise-baseline"
DETECTOR_VERSION = "0.2.0"

_AUTHORIZED_STATES = {"authorized", "authorized_with_scope"}
_SUPPORTED_ASSET_TYPES = {"social_profile", "mobile_app"}
_SOURCE_FAILURE_STATES = {
    "degraded",
    "error",
    "failed",
    "failure",
    "not_evaluated",
    "rate_limited",
    "stale",
    "timeout",
    "unavailable",
    "unsupported",
}
_SHA256_RE = re.compile(r"^[0-9a-fA-F]{64}$")


def _ratio(left: str, right: str) -> float:
    if not left or not right:
        return 0.0
    return round(SequenceMatcher(None, left, right).ratio(), 4)


def _description_overlap(official: str, candidate: str) -> float:
    official_tokens = set(tokens(official))
    candidate_tokens = set(tokens(candidate))
    if not official_tokens or not candidate_tokens:
        return 0.0
    return round(len(official_tokens & candidate_tokens) / len(official_tokens | candidate_tokens), 4)


def _host(value: str | None) -> str:
    if not isinstance(value, str) or not value:
        return ""
    try:
        return urlsplit(canonical_url(value)).hostname or ""
    except ValueError:
        return ""


def _mapping(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _field(record: Any, key: str) -> Any:
    """Read a direct field, then the common metadata envelope."""

    record_map = _mapping(record)
    value = record_map.get(key)
    if value is not None and value != "":
        return value
    metadata = _mapping(record_map.get("metadata"))
    value = metadata.get(key)
    return value if value is not None and value != "" else None


def _text(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _asset_name(asset: dict[str, Any]) -> str:
    return _text(_field(asset, "display_name") or _field(asset, "name") or _field(asset, "title"))


def _candidate_name(candidate: dict[str, Any]) -> str:
    return _text(_field(candidate, "display_name") or _field(candidate, "title") or _field(candidate, "name"))


def _publisher_value(record: dict[str, Any]) -> str:
    return _text(_field(record, "publisher") or _field(record, "developer"))


def _scope_value(record: dict[str, Any], asset_type: str) -> str:
    key = "platform" if asset_type == "social_profile" else "store"
    return _text(_field(record, key))


def _scope_key(value: str) -> str:
    return normalize_text(value)


def _identifiers(record: dict[str, Any], asset_type: str) -> list[dict[str, str]]:
    """Return comparable identifiers without treating handles as stable IDs."""

    if asset_type == "social_profile":
        fields = (
            ("stable_id", "stable_id", "primary"),
            ("stable_external_id", "stable_external_id", "primary"),
            ("source_identity", "source_identity", "primary"),
        )
    else:
        fields = (
            ("package_id", "package_id", "primary"),
            ("bundle_id", "bundle_id", "primary"),
            ("stable_id", "stable_id", "primary"),
            ("stable_external_id", "stable_external_id", "primary"),
            ("store_id", "store_id", "secondary"),
            ("listing_id", "listing_id", "secondary"),
        )

    result: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for label, key, kind in fields:
        value = _field(record, key)
        if isinstance(value, bool) or value is None:
            continue
        if not isinstance(value, str):
            value = str(value)
        if not value.strip():
            continue
        # Package/bundle/store IDs are conventionally case-insensitive.  A
        # social stable identifier remains exact after surrounding whitespace.
        comparable = normalize_text(value) if asset_type == "mobile_app" else value.strip()
        identity = (kind, comparable)
        if identity in seen:
            continue
        seen.add(identity)
        result.append({"label": label, "value": comparable, "kind": kind})
    return result


def _identifier_intersection(
    candidate_ids: list[dict[str, str]], official_ids: list[dict[str, str]]
) -> tuple[bool, str | None]:
    for candidate_id in candidate_ids:
        for official_id in official_ids:
            if candidate_id["value"] == official_id["value"]:
                return True, official_id["label"]
    return False, None


def _identifier_conflict(
    candidate_ids: list[dict[str, str]], official_ids: list[dict[str, str]]
) -> bool:
    """Detect contradictions only where both sides expose the same ID class."""

    for kind in ("primary", "secondary"):
        candidate_values = {item["value"] for item in candidate_ids if item["kind"] == kind}
        official_values = {item["value"] for item in official_ids if item["kind"] == kind}
        if candidate_values and official_values and candidate_values.isdisjoint(official_values):
            return True
    return False


def _internal_identifier_conflict(identifier_values: list[dict[str, str]]) -> bool:
    """Return whether one observed record exposes contradictory IDs."""

    for kind in ("primary", "secondary"):
        values = {item["value"] for item in identifier_values if item["kind"] == kind}
        if len(values) > 1:
            return True
    return False


def _locator(record: dict[str, Any]) -> str:
    # A source/listing locator is the identity URL.  External/support URLs are
    # destinations and must never be used as an official identity match.
    return _text(
        _field(record, "source_locator")
        or _field(record, "canonical_url")
        or _field(record, "listing_url")
    )


def _canonical_equal(left: str, right: str) -> tuple[bool, bool]:
    if not left or not right:
        return False, False
    try:
        return canonical_url(left) == canonical_url(right), False
    except ValueError:
        return False, True


def _scope_match(asset: dict[str, Any], candidate: dict[str, Any], asset_type: str) -> tuple[bool, str]:
    official_scope = _scope_value(asset, asset_type)
    candidate_scope = _scope_value(candidate, asset_type)
    if not official_scope or not candidate_scope:
        return False, "identity_scope_missing"
    if _scope_key(official_scope) != _scope_key(candidate_scope):
        return False, "identity_scope_mismatch"
    return True, "scope_match"


def _parse_timestamp(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str) and value.strip():
        raw = value.strip()
        if raw.endswith("Z"):
            raw = f"{raw[:-1]}+00:00"
        try:
            parsed = datetime.fromisoformat(raw)
        except ValueError:
            return None
    else:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _observation_time(observation: dict[str, Any], candidate: dict[str, Any]) -> datetime:
    for key in ("as_of", "collected_at", "observed_at"):
        parsed = _parse_timestamp(_field(observation, key) or _field(candidate, key))
        if parsed:
            return parsed
    return datetime.now(timezone.utc)


def _authorization_status(asset: dict[str, Any], observation: dict[str, Any], candidate: dict[str, Any]) -> tuple[str, str | None]:
    state = _text(_field(asset, "authorization_state"))
    explicit_verified = _field(asset, "verified")
    if explicit_verified is False:
        return "unverified", "authorization_not_verified"
    for key in ("verification_status", "authorization_verification", "proof_status"):
        verification_status = normalize_text(_text(_field(asset, key)))
        if verification_status in {"self_declared", "unverified", "pending", "not_verified"}:
            return "unverified", "authorization_not_verified"
    if state not in _AUTHORIZED_STATES:
        return "unverified", "authorization_not_verified"

    expiry = None
    for key in (
        "expires_at",
        "expires_on",
        "expiry",
        "valid_to",
        "exception_expires_at",
        "authorization_expires_at",
    ):
        value = _field(asset, key)
        if value is not None:
            expiry = _parse_timestamp(value)
            if expiry is None:
                return "expired", "authorization_expiry_invalid"
            break
    if expiry and expiry <= _observation_time(observation, candidate):
        return "expired", "authorization_expired"
    return state, None


def _relationship_scope_matches(asset: dict[str, Any], candidate: dict[str, Any], state: str) -> bool:
    if state != "authorized_with_scope":
        return True
    declared_scope = normalize_text(_text(_field(asset, "scope")))
    if not declared_scope:
        return False
    candidate_scope_values = [
        _text(_field(candidate, "scope")),
        _text(_field(candidate, "region")),
        _text(_field(candidate, "relationship_scope")),
    ]
    candidate_scope_values = [normalize_text(value) for value in candidate_scope_values if value]
    return bool(candidate_scope_values) and any(
        declared_scope == value or declared_scope in value or value in declared_scope
        for value in candidate_scope_values
    )


def _name_comparison(official_name: str, candidate_name: str) -> dict[str, Any]:
    official_normalized = normalize_text(official_name)
    candidate_normalized = normalize_text(candidate_name)
    official_compact = compact_name(official_name)
    candidate_compact = compact_name(candidate_name)
    official_tokens = set(tokens(official_name))
    candidate_tokens = set(tokens(candidate_name))
    union = official_tokens | candidate_tokens
    token_jaccard = round(len(official_tokens & candidate_tokens) / len(union), 4) if union else 0.0
    full_token_containment = bool(official_tokens) and official_tokens.issubset(candidate_tokens)
    swap = is_character_swap(official_name, candidate_name)
    spacing_change = bool(official_compact and official_compact == candidate_compact and official_normalized != candidate_normalized)
    character_ratio = _ratio(official_compact, candidate_compact)

    # A generic near-name signal requires a meaningful relationship.  Plain
    # SequenceMatcher output is not enough: "Northstar Bank" must not become a
    # near match for "Northstar Pay" merely because one token is shared.
    if official_compact and official_compact == candidate_compact:
        score = 1.0
    elif swap or full_token_containment or (len(official_tokens) == len(candidate_tokens) == 1 and character_ratio >= 0.8):
        score = character_ratio
    else:
        score = token_jaccard

    added_words = (
        sorted(word for word in risk_words(candidate_name) if word not in official_tokens)
        if full_token_containment
        else []
    )
    return {
        "official_name": official_name,
        "candidate_name": candidate_name,
        "official_normalized": official_normalized,
        "candidate_normalized": candidate_normalized,
        "official_compact": official_compact,
        "candidate_compact": candidate_compact,
        "character_ratio": character_ratio,
        "token_jaccard": token_jaccard,
        "full_token_containment": full_token_containment,
        "character_swap": swap,
        "spacing_change": spacing_change,
        "added_risk_words": added_words,
        "score": round(score, 4),
    }


def _valid_sha256(value: Any) -> str | None:
    if isinstance(value, str) and _SHA256_RE.fullmatch(value.strip()):
        return value.strip().casefold()
    return None


def _image_hash(record: dict[str, Any], asset_type: str) -> tuple[str | None, str | None, bool]:
    """Return only a computed or explicitly validated SHA-256 image digest."""

    kind = "avatar" if asset_type == "social_profile" else "icon"
    data_keys = (f"{kind}_bytes", f"{kind}_data", "image_bytes", "image_data")
    for key in data_keys:
        value = _field(record, key)
        if isinstance(value, (bytes, bytearray, memoryview)):
            digest = sha256(bytes(value)).hexdigest()
            return digest, f"computed_sha256:{key}", False

    digest_keys = (
        f"{kind}_sha256",
        f"{kind}_digest",
        "image_sha256",
        "image_digest",
    )
    for key in digest_keys:
        digest = _valid_sha256(_field(record, key))
        if digest:
            return digest, f"validated_sha256:{key}", False

    # Some connectors call a cryptographic digest simply ``avatar_hash`` or
    # ``icon_hash``.  Accept it only when its shape validates as SHA-256; the
    # short fixture labels (for example ``logo-v1``) remain unsupported.
    digest = _valid_sha256(_field(record, f"{kind}_hash"))
    if digest:
        return digest, f"validated_sha256:{kind}_hash", False

    marker_keys = {
        f"{kind}_hash",
        f"{kind}_phash",
        "phash",
        "perceptual_hash",
        "visual_similarity",
        "image_embedding",
    }
    has_unvalidated_marker = any(_field(record, key) is not None for key in marker_keys)
    return None, None, has_unvalidated_marker


def _visual_assessment(
    candidate: dict[str, Any],
    official_assets: list[dict[str, Any]],
    asset_type: str,
) -> dict[str, Any]:
    candidate_hash, candidate_source, candidate_unvalidated = _image_hash(candidate, asset_type)
    evaluated_assets: list[str] = []
    unsupported_assets: list[str] = []
    exact_match = False
    for index, asset in enumerate(official_assets):
        asset_hash, _, asset_unvalidated = _image_hash(asset, asset_type)
        if asset_hash:
            evaluated_assets.append(str(asset.get("id") or index))
            if candidate_hash and candidate_hash == asset_hash:
                exact_match = True
        elif asset_unvalidated:
            unsupported_assets.append(str(asset.get("id") or index))

    if exact_match:
        state = "match"
    elif candidate_unvalidated or unsupported_assets:
        state = "unsupported"
    elif candidate_hash and evaluated_assets:
        state = "no_match"
    else:
        state = "not_evaluated"

    return {
        "state": state,
        "method": "sha256_exact_only",
        "candidate_hash_source": candidate_source,
        "evaluated_assets": evaluated_assets,
        "unsupported_assets": unsupported_assets,
        "near_or_partial_comparison": "not_implemented",
        "exact_match": exact_match,
    }


def _source_state(observation: dict[str, Any], candidate: dict[str, Any]) -> tuple[str, str | None, dict[str, Any]]:
    def select_state(values: list[str]) -> str:
        normalized = [value.casefold() for value in values if value]
        for value in normalized:
            if value in _SOURCE_FAILURE_STATES:
                return value
        return normalized[0] if normalized else ""

    def failure_reason(value: str) -> str:
        if value == "stale":
            return "source_stale"
        if value == "unsupported":
            return "source_unsupported"
        if value == "not_evaluated":
            return "source_not_evaluated"
        return "source_unavailable"

    availability = select_state(
        [
            _text(_field(observation, "availability_state")),
            _text(_field(candidate, "availability_state")),
        ]
    )
    source_status = select_state(
        [
            _text(_field(observation, "source_status")),
            _text(_field(candidate, "source_status")),
            _text(_field(_mapping(observation.get("source_run")), "status")),
        ]
    )
    source_mode = _text(_field(observation, "source_mode") or _field(candidate, "source_mode")).casefold()

    if _field(observation, "source_supported") is False or _field(candidate, "source_supported") is False:
        return "unsupported", "source_unsupported", {"availability": availability or "unknown", "status": source_status}
    if _field(observation, "operation_supported") is False or _field(candidate, "operation_supported") is False:
        return "unsupported", "source_unsupported", {"availability": availability or "unknown", "status": source_status}

    freshness_values = [
        _field(observation, "freshness_state"),
        _field(candidate, "freshness_state"),
        _field(observation, "freshness"),
        _field(candidate, "freshness"),
    ]
    normalized_freshness_values: list[str] = []
    for freshness_value in freshness_values:
        if isinstance(freshness_value, dict):
            freshness_value = freshness_value.get("state")
        freshness_text = _text(freshness_value).casefold()
        if freshness_text:
            normalized_freshness_values.append(freshness_text)
    freshness = select_state(normalized_freshness_values)
    if _field(observation, "is_fresh") is False or _field(candidate, "is_fresh") is False:
        freshness = "stale"
    if _field(observation, "stale") is True or _field(candidate, "stale") is True:
        freshness = "stale"

    if availability in _SOURCE_FAILURE_STATES:
        return availability, failure_reason(availability), {"availability": availability, "status": source_status, "freshness": freshness}
    if source_status in _SOURCE_FAILURE_STATES:
        return source_status, failure_reason(source_status), {"availability": availability or "unknown", "status": source_status, "freshness": freshness}
    if freshness in _SOURCE_FAILURE_STATES:
        return freshness, failure_reason(freshness), {"availability": availability or "available", "status": source_status, "freshness": freshness}
    if freshness and freshness not in {"available", "completed", "current", "fresh", "operational"}:
        return "not_evaluated", "source_not_evaluated", {
            "availability": availability or "available",
            "status": source_status,
            "freshness": freshness,
        }
    as_of = _parse_timestamp(_field(observation, "as_of") or _field(candidate, "as_of"))
    observed_at = _parse_timestamp(
        _field(observation, "observed_at") or _field(candidate, "observed_at")
    )
    ceiling = _field(observation, "freshness_ceiling_seconds") or _field(candidate, "freshness_ceiling_seconds")
    if as_of and observed_at and isinstance(ceiling, (int, float)) and ceiling > 0:
        age_seconds = max(0.0, (as_of - observed_at).total_seconds())
        if age_seconds > float(ceiling):
            return "stale", "source_stale", {
                "availability": availability or "available",
                "status": source_status,
                "freshness": "stale",
                "age_seconds": round(age_seconds, 3),
                "ceiling_seconds": ceiling,
            }
    if source_mode in _SOURCE_FAILURE_STATES:
        return source_mode, "source_unavailable", {"availability": availability or "unknown", "status": source_status, "freshness": freshness}

    return "available", None, {
        "availability": availability or "available",
        "status": source_status or "completed",
        "freshness": freshness or "not_declared",
    }


def _exposure_or_recency(observation: dict[str, Any], candidate: dict[str, Any]) -> float:
    """Use only supplied count/timestamp evidence; otherwise report zero."""

    for key in ("exposure_count", "report_count", "impression_count"):
        value = _field(candidate, key)
        if isinstance(value, (int, float)) and not isinstance(value, bool) and value >= 0:
            # This is a bounded ordering aid, not a probability or truth
            # score.  Counts are only interpreted when explicitly supplied.
            return round(value / (value + 10.0), 4)

    as_of = _parse_timestamp(_field(observation, "as_of") or _field(candidate, "as_of"))
    observed = _parse_timestamp(
        _field(observation, "observed_at")
        or _field(candidate, "observed_at")
    )
    if as_of and observed:
        ceiling = _field(observation, "freshness_ceiling_seconds") or _field(candidate, "freshness_ceiling_seconds")
        if isinstance(ceiling, (int, float)) and ceiling > 0:
            age = max(0.0, (as_of - observed).total_seconds())
            return round(max(0.0, min(1.0, 1.0 - age / float(ceiling))), 4)
    return 0.0


def _official_assets(assets: list[dict[str, Any]], asset_type: str) -> list[dict[str, Any]]:
    return [asset for asset in assets if isinstance(asset, dict) and asset.get("asset_type") == asset_type]


def assess_observation(
    *,
    brand: dict[str, Any],
    assets: list[dict[str, Any]],
    observation: dict[str, Any],
) -> dict[str, Any]:
    """Return a stored assessment shape without making a legal conclusion.

    The keyword-only interface and legacy top-level fields are retained for
    service/database compatibility.  Additional trace fields make the
    comparison and abstention basis inspectable without changing persistence
    columns.
    """

    brand = _mapping(brand)
    observation = _mapping(observation)
    raw_candidate = _mapping(observation.get("raw"))
    # Raw source fields are authoritative for the observed record; wrapper
    # fields provide source state and connector metadata in service callers.
    candidate = {**observation, **raw_candidate}
    asset_type = _text(candidate.get("asset_type") or observation.get("asset_type"))
    official_type = asset_type if asset_type in _SUPPORTED_ASSET_TYPES else ""
    official_assets = _official_assets(assets if isinstance(assets, list) else [], official_type)
    candidate_name = _candidate_name(candidate)
    candidate_locator = _locator(candidate)
    candidate_ids = _identifiers(candidate, asset_type) if official_type else []
    candidate_identifier_conflict = _internal_identifier_conflict(candidate_ids)

    reasons: list[str] = []
    counterevidence: list[str] = []
    missing: list[str] = []
    resemblance_signals: list[str] = []
    authorization_signals: list[str] = []

    source_state, source_abstention, source_trace = _source_state(observation, candidate)
    baseline_state = "available" if official_assets else "missing"
    if not official_type:
        reasons.append("unsupported_asset_type")
        missing.append("supported_asset_type")
    if not official_assets:
        missing.append("official_baseline")
        counterevidence.append("no official asset baseline was supplied for this asset type")
    if candidate_identifier_conflict:
        reasons.append("conflicting_stable_identifier")

    if not candidate_name:
        missing.append("display_name")
    if not candidate_locator:
        missing.append("source_locator")
    elif _canonical_equal(candidate_locator, candidate_locator)[1]:
        # Keep malformed locators visible without letting them become a match.
        missing.append("valid_source_locator")
    if official_type:
        if not _scope_value(candidate, official_type):
            missing.append("platform" if official_type == "social_profile" else "store")
    if not candidate_ids:
        missing.append("stable_identifier")
    if official_type == "mobile_app":
        if not _publisher_value(candidate):
            missing.append("publisher")
        if not _text(_field(candidate, "description")):
            missing.append("description")
    elif official_type == "social_profile" and not _text(_field(candidate, "description")):
        missing.append("description")

    name_comparisons: list[dict[str, Any]] = []
    reference_names: list[tuple[str, str]] = []
    if official_assets:
        for index, asset in enumerate(official_assets):
            name = _asset_name(asset)
            if name:
                reference_names.append((str(asset.get("id") or index), name))
        brand_name = _text(brand.get("name"))
        if brand_name and all(compact_name(brand_name) != compact_name(name) for _, name in reference_names):
            reference_names.append(("brand", brand_name))

    best_name_score = 0.0
    best_name_reference: str | None = None
    for reference_id, official_name in reference_names:
        comparison = _name_comparison(official_name, candidate_name)
        comparison["reference_id"] = reference_id
        name_comparisons.append(comparison)
        if comparison["score"] > best_name_score:
            best_name_score = comparison["score"]
            best_name_reference = reference_id
        if comparison["spacing_change"]:
            reasons.append("spacing_or_separator_change")
            resemblance_signals.append("spacing_or_separator_change")
        if comparison["character_swap"]:
            reasons.append("character_swap")
            resemblance_signals.append("character_swap")
        if comparison["score"] >= 0.72 and comparison["official_compact"] != comparison["candidate_compact"]:
            reasons.append("name_near_match")
            resemblance_signals.append("name_near_match")
        for word in comparison["added_risk_words"]:
            reasons.append(f"added_word:{word}")
            resemblance_signals.append(f"added_word:{word}")

    name_comparisons_by_reference = {
        comparison["reference_id"]: comparison for comparison in name_comparisons
    }

    script_diagnostics = unicode_script_diagnostics(candidate_name)
    if script_diagnostics["mixed_script"]:
        reasons.append("mixed_script_diagnostic")
        resemblance_signals.append("mixed_script_diagnostic")
        counterevidence.append("mixed-script detection is a partial Unicode diagnostic, not a UTS #39 verdict")

    best_description_overlap = 0.0
    description_comparisons: list[dict[str, Any]] = []
    candidate_description = _text(_field(candidate, "description"))
    for index, asset in enumerate(official_assets):
        official_description = _text(_field(asset, "description"))
        overlap = _description_overlap(official_description, candidate_description)
        if overlap > best_description_overlap:
            best_description_overlap = overlap
        if overlap:
            description_comparisons.append(
                {
                    "reference_id": str(asset.get("id") or index),
                    "jaccard": overlap,
                }
            )
    brand_description = _text(brand.get("description"))
    if brand_description:
        best_description_overlap = max(best_description_overlap, _description_overlap(brand_description, candidate_description))
    if best_description_overlap >= 0.25:
        reasons.append("description_overlap")
        resemblance_signals.append("description_overlap")

    visual = _visual_assessment(candidate, official_assets, official_type) if official_type else {
        "state": "not_evaluated",
        "method": "sha256_exact_only",
        "candidate_hash_source": None,
        "evaluated_assets": [],
        "unsupported_assets": [],
        "near_or_partial_comparison": "not_implemented",
        "exact_match": False,
    }
    if visual["exact_match"]:
        reasons.append("exact_image_hash_match")
        resemblance_signals.append("exact_image_hash_match")
    elif visual["state"] == "unsupported":
        reasons.append("visual_evidence_unsupported")
        counterevidence.append("visual comparison was not evaluated; only an exact computed or validated SHA-256 is supported")
    elif visual["state"] == "no_match":
        counterevidence.append("validated exact image hashes were compared and did not match")
    else:
        counterevidence.append("visual comparison not evaluated; partial or near-image comparison is not implemented")

    name_score_for_identity = best_name_score
    visual_score = 1.0 if visual["exact_match"] else 0.0
    identity_resemblance = round(max(name_score_for_identity, best_description_overlap * 0.8, visual_score), 2)

    comparison_rows: list[dict[str, Any]] = []
    verified_authorization_matches: list[dict[str, Any]] = []
    stable_matches: list[dict[str, Any]] = []
    url_matches: list[dict[str, Any]] = []
    identity_conflicts: list[dict[str, Any]] = []
    unverified_matches: list[dict[str, Any]] = []
    expired_matches: list[dict[str, Any]] = []

    for index, asset in enumerate(official_assets):
        official_ids = _identifiers(asset, official_type)
        scope_ok, scope_reason = _scope_match(asset, candidate, official_type)
        official_locator = _locator(asset)
        url_match, invalid_candidate_url = _canonical_equal(candidate_locator, official_locator)
        stable_match, matched_id_label = _identifier_intersection(candidate_ids, official_ids)
        stable_conflict = _identifier_conflict(candidate_ids, official_ids)
        asset_name_comparison = name_comparisons_by_reference.get(str(asset.get("id") or index))
        visible_name_conflict = bool(
            stable_match
            and candidate_name
            and asset_name_comparison
            and asset_name_comparison["official_compact"]
            and asset_name_comparison["candidate_compact"]
            and asset_name_comparison["score"] < 0.5
        )
        auth_state, auth_reason = _authorization_status(asset, observation, candidate)
        publisher = ""
        publisher_match = True
        publisher_mismatch = False
        publisher_missing = False
        if official_type == "mobile_app":
            official_publisher = normalize_text(_publisher_value(asset))
            candidate_publisher = normalize_text(_publisher_value(candidate))
            publisher = candidate_publisher
            if official_publisher and not candidate_publisher:
                publisher_match = False
                publisher_missing = True
            elif official_publisher and candidate_publisher and official_publisher != candidate_publisher:
                publisher_match = False
                publisher_mismatch = True

        row = {
            "reference_id": str(asset.get("id") or index),
            "scope_match": scope_ok,
            "scope_reason": scope_reason,
            "stable_match": stable_match,
            "stable_match_label": matched_id_label,
            "stable_conflict": stable_conflict,
            "visible_name_conflict": visible_name_conflict,
            "url_match": url_match,
            "invalid_candidate_url": invalid_candidate_url,
            "authorization_state": auth_state,
            "authorization_reason": auth_reason,
            "publisher": publisher,
            "publisher_match": publisher_match,
            "publisher_mismatch": publisher_mismatch,
            "publisher_missing": publisher_missing,
        }
        comparison_rows.append(row)

        if scope_reason == "identity_scope_mismatch":
            reasons.append(scope_reason)
        elif scope_reason == "identity_scope_missing":
            reasons.append(scope_reason)
        if stable_match:
            # A stable value is only an exclusion candidate in the declared
            # platform/store scope.  The same value on another platform is a
            # scope conflict, not an authorization proof.
            if scope_ok:
                stable_matches.append(row)
            reasons.append("stable_identifier_match")
            authorization_signals.append("stable_identifier_match")
        if url_match:
            url_matches.append(row)
            reasons.append("canonical_url_match")
            authorization_signals.append("canonical_url_match")
        if invalid_candidate_url:
            missing.append("valid_source_locator")
        if publisher_mismatch:
            reasons.append("publisher_mismatch")
        if publisher_missing:
            missing.append("publisher")
        if visible_name_conflict:
            reasons.append("visible_metadata_conflict")
        if auth_reason in {"authorization_expired", "authorization_expiry_invalid"}:
            expired_matches.append(row)
            reasons.append(auth_reason)
        if auth_state == "unverified" and (stable_match or url_match):
            unverified_matches.append(row)
            reasons.append("self_declared_baseline_match")

        if auth_state in _AUTHORIZED_STATES and scope_ok and stable_match and publisher_match:
            verified_authorization_matches.append({**row, "asset": asset, "proof": "stable_identifier"})
        elif auth_state in _AUTHORIZED_STATES and scope_ok and url_match and not stable_conflict and not publisher_mismatch:
            if _relationship_scope_matches(asset, candidate, auth_state):
                verified_authorization_matches.append({**row, "asset": asset, "proof": "canonical_url"})

    # A candidate stable identity must not be hidden by a URL that matches a
    # different official asset.  This is checked across the full baseline,
    # rather than against the first asset in registry order.  A candidate ID
    # that simply is not present in the registry remains authorization_unknown;
    # the registry is not a deny-list.
    if candidate_identifier_conflict:
        identity_conflicts.append({"reference_id": "candidate", "stable_conflict": True})
    identity_conflicts.extend(
        row for row in comparison_rows if row["stable_match"] and row["visible_name_conflict"]
    )
    identity_conflicts.extend(row for row in url_matches if row["stable_conflict"])
    if identity_conflicts:
        reasons.append("conflicting_stable_identifier")
    if stable_matches and url_matches and not any(
        stable_row["reference_id"] == url_row["reference_id"]
        for stable_row in stable_matches
        for url_row in url_matches
    ):
        reasons.append("cross_asset_identity_conflict")
        identity_conflicts.extend(url_matches)

    identity_drift = bool(identity_conflicts)
    if not official_type or not official_assets:
        # Without a comparable registry baseline there is no basis for
        # calling an observed identifier contradictory.
        identity_drift = False
        authorization_state = "unknown"
        authorization_signals.append("baseline_not_available_for_authorization")
    elif identity_drift:
        authorization_state = "identity_drift"
        authorization_signals.append("identity_drift")
        counterevidence.append("stable identity evidence conflicts with the observed URL, scope, or another stable identifier")
    elif verified_authorization_matches:
        selected_state = verified_authorization_matches[0]["authorization_state"]
        authorization_state = selected_state
        authorization_signals.append("verified_authorization_match")
    else:
        authorization_state = "unknown"
        reasons.append("authorization_unknown")
        authorization_signals.append("authorization_unknown")
        counterevidence.append("no active verified stable identifier or canonical locator match was found")
        if unverified_matches:
            counterevidence.append("self-declared or otherwise unverified registry evidence cannot exclude a candidate")
        if expired_matches:
            counterevidence.append("an otherwise matching authorization exception has expired")

    # A failed, stale, or unsupported source cannot establish an exclusion,
    # even if a retained raw payload happens to resemble an official record.
    if source_state != "available":
        authorization_state = "unknown"
        authorization_signals.append("source_not_usable_for_authorization")
        counterevidence.append("source failure or freshness state prevents authorization evaluation")

    external_url = _text(_field(candidate, "external_url") or _field(candidate, "support_url"))
    official_destination = _text(brand.get("website"))
    external_destination_mismatch = bool(
        external_url and official_destination and _host(external_url) and _host(official_destination)
        and _host(external_url) != _host(official_destination)
    )
    if external_destination_mismatch:
        reasons.append("external_destination_mismatch")

    harm_signals: list[str] = []
    description_risk_words = [word for word in risk_words(candidate_description) if word in {"login", "verify", "secure"}]
    for description_risk_word in description_risk_words:
        reasons.append(f"sensitive_call_to_action:{description_risk_word}")
        harm_signals.append(f"sensitive_call_to_action:{description_risk_word}")
    if external_destination_mismatch:
        harm_signals.append("external_destination_mismatch")
    observed_harm = round(min(1.0, len(set(harm_signals)) / 3.0), 2)
    potential_harm_level = "high" if observed_harm >= 0.6 else "moderate" if observed_harm >= 0.25 else "low"

    # Evidence quality is a completeness indicator over fields that the
    # connector actually supplies, never a candidate-provided confidence.
    quality_checks = [
        bool(candidate_name),
        bool(candidate_locator),
        bool(_scope_value(candidate, official_type)) if official_type else False,
        bool(candidate_ids),
    ]
    if official_type == "mobile_app":
        quality_checks.extend(
            [
                bool(_publisher_value(candidate)),
                bool(candidate_description),
            ]
        )
    elif official_type == "social_profile":
        quality_checks.append(bool(candidate_description))
    evidence_quality = round(sum(quality_checks) / len(quality_checks), 2) if quality_checks else 0.0
    if observation.get("source_mode") == "synthetic_fixture" or candidate.get("source_mode") == "synthetic_fixture":
        evidence_quality = round(evidence_quality * 0.95, 2)
    if source_state != "available" or not official_assets:
        evidence_quality = 0.0

    exposure_or_recency = _exposure_or_recency(observation, candidate)
    if exposure_or_recency == 0.0:
        missing.append("exposure_or_recency")

    if identity_drift:
        authorization_conflict = 1.0
    elif any(row.get("publisher_mismatch") for row in comparison_rows):
        authorization_conflict = 0.8
    elif unverified_matches or expired_matches:
        authorization_conflict = 0.6
    elif candidate_ids:
        authorization_conflict = 0.4
    else:
        authorization_conflict = 0.2

    queue_priority = round(
        (
            0.35 * identity_resemblance
            + 0.25 * observed_harm
            + 0.20 * authorization_conflict
            + 0.20 * exposure_or_recency
        )
        * evidence_quality,
        2,
    )

    core_evidence_missing = (
        not official_type
        or not official_assets
        or not _scope_value(candidate, official_type)
        or not (candidate_name or candidate_locator or candidate_ids)
    )
    if source_state != "available":
        decision_state = "insufficient_evidence"
        counterevidence.append("source did not provide a fresh, supported, usable observation")
        abstention_reason = source_abstention or "source_unavailable"
    elif not official_assets:
        decision_state = "insufficient_evidence"
        abstention_reason = "baseline_missing"
    elif not official_type:
        decision_state = "insufficient_evidence"
        abstention_reason = "unsupported_asset_type"
    elif core_evidence_missing or evidence_quality < 0.35:
        decision_state = "insufficient_evidence"
        abstention_reason = "missing_required_evidence"
        counterevidence.append("required source identity, scope, locator, or baseline evidence is missing")
    elif identity_drift:
        decision_state = "manual_review"
        abstention_reason = None
    elif authorization_state in _AUTHORIZED_STATES:
        # Preserve the service's existing terminal status while keeping the
        # scoped authorization state in the authorization dimension.
        decision_state = "authorized"
        abstention_reason = None
    elif evidence_quality < 0.5:
        decision_state = "insufficient_evidence"
        abstention_reason = "missing_required_evidence"
    else:
        decision_state = "review_required"
        abstention_reason = None

    reasons = sorted(set(reasons))
    counterevidence = sorted(set(counterevidence))
    missing = sorted(set(missing))
    resemblance_signals = sorted(set(resemblance_signals))
    authorization_signals = sorted(set(authorization_signals))

    return {
        "detector_name": DETECTOR_NAME,
        "detector_version": DETECTOR_VERSION,
        "normalization_version": NORMALIZATION_VERSION,
        "dimensions": {
            "identity_resemblance": {"value": identity_resemblance, "signals": resemblance_signals},
            "authorization": {"state": authorization_state, "signals": authorization_signals},
            "potential_harm": {"level": potential_harm_level, "value": observed_harm, "signals": sorted(set(harm_signals))},
            "evidence_quality": {"value": evidence_quality, "missing": missing},
            "visual": visual,
        },
        # Legacy storage-compatible top-level fields.
        "identity_resemblance": identity_resemblance,
        "authorization_state": authorization_state,
        "authorization_conflict": authorization_conflict,
        "potential_harm_level": potential_harm_level,
        "observed_harm": observed_harm,
        "evidence_quality": evidence_quality,
        "exposure_or_recency": exposure_or_recency,
        "queue_priority": queue_priority,
        "decision_state": decision_state,
        "reasons": reasons,
        "counterevidence": counterevidence,
        "missing": missing,
        "abstention_reason": abstention_reason,
        "source_state": source_state,
        "baseline_state": baseline_state,
        "visual": visual,
        "trace": {
            "source": source_trace,
            "asset_type": asset_type,
            "candidate": {
                "name": candidate_name,
                "locator": candidate_locator,
                "scope": _scope_value(candidate, official_type) if official_type else "",
                "identifier_labels": [item["label"] for item in candidate_ids],
                "identifier_conflict": candidate_identifier_conflict,
            },
            "name_comparisons": name_comparisons,
            "best_name_reference": best_name_reference,
            "description_comparisons": description_comparisons,
            "official_asset_comparisons": comparison_rows,
            "visual": visual,
            "unicode": script_diagnostics,
            "official_assets_considered": len(official_assets),
        },
    }
