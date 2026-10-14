from __future__ import annotations

from copy import deepcopy
from hashlib import sha256

import pytest

from cairnwise.detector import assess_observation
from cairnwise.fixtures import FIXTURE_APP_STORE, FIXTURE_SOCIAL_PLATFORM, get_fixture
from cairnwise.normalization import canonical_url, mixed_script, unicode_script_diagnostics


BRAND = {
    "name": "Northstar Pay",
    "website": "https://northstarpay.example",
}


def social_asset(
    *,
    stable_id: str = "did:example:northstar-official",
    url: str = "https://social.example/northstarpay",
    name: str = "Northstar Pay",
    authorization_state: str = "authorized",
    **extra: object,
) -> dict:
    return {
        "asset_type": "social_profile",
        "platform": FIXTURE_SOCIAL_PLATFORM,
        "canonical_url": url,
        "stable_external_id": stable_id,
        "display_name": name,
        "authorization_state": authorization_state,
        **extra,
    }


def app_asset(
    *,
    package_id: str = "com.northstar.pay",
    url: str = "https://apps.example/northstar-pay-mobile",
    name: str = "Northstar Pay Mobile",
    publisher: str = "Northstar Payments Ltd",
    authorization_state: str = "authorized",
    **extra: object,
) -> dict:
    return {
        "asset_type": "mobile_app",
        "store": FIXTURE_APP_STORE,
        "canonical_url": url,
        "stable_external_id": package_id,
        "package_id": package_id,
        "display_name": name,
        "publisher": publisher,
        "authorization_state": authorization_state,
        **extra,
    }


def observation(raw: dict, **overrides: object) -> dict:
    return {
        "asset_type": raw["asset_type"],
        "source_mode": "user_submitted",
        "availability_state": "available",
        "raw": raw,
        **overrides,
    }


def assess(raw: dict, assets: list[dict], **overrides: object) -> dict:
    return assess_observation(brand=BRAND, assets=assets, observation=observation(raw, **overrides))


def test_matching_all_official_assets_does_not_stop_at_first_asset() -> None:
    candidate = get_fixture("social.partner")
    assets = [
        social_asset(),
        social_asset(
            stable_id="did:example:northstar-rewards-eu",
            url="https://social.example/northstar-rewards-eu",
            name="Northstar Rewards EU",
            authorization_state="authorized_with_scope",
            scope="EU rewards partner",
        ),
    ]

    result = assess(candidate, assets)

    assert result["authorization_state"] == "authorized_with_scope"
    assert result["decision_state"] == "authorized"
    assert result["trace"]["official_assets_considered"] == 2
    assert not result["trace"]["official_asset_comparisons"][0]["stable_match"]
    assert result["trace"]["official_asset_comparisons"][1]["stable_match"]


def test_character_swap_added_word_and_spacing_are_separate_name_signals() -> None:
    assets = [social_asset()]

    swapped = get_fixture("social.lookalike")
    swapped.update(
        {
            "display_name": "Nrothstar Pay",
            "source_locator": "https://social.example/nrothstar-pay",
            "stable_id": "did:example/nrothstar",
        }
    )
    swapped_result = assess(swapped, assets)
    assert "character_swap" in swapped_result["reasons"]

    added = deepcopy(swapped)
    added.update(
        {
            "display_name": "Northstar Pay Support",
            "source_locator": "https://social.example/northstarpay-support-2",
            "stable_id": "did:example/support",
        }
    )
    added_result = assess(added, assets)
    assert "added_word:support" in added_result["reasons"]

    spaced = deepcopy(swapped)
    spaced.update(
        {
            "display_name": "NorthstarPay",
            "source_locator": "https://social.example/northstarpay-copy",
            "stable_id": "did:example/spacing",
        }
    )
    spaced_result = assess(spaced, assets)
    assert "spacing_or_separator_change" in spaced_result["reasons"]


def test_unrelated_control_does_not_get_near_name_or_added_word_signal() -> None:
    candidate = get_fixture("social.lookalike")
    candidate.update(
        {
            "display_name": "Northstar Bank",
            "description": "An independent community bank.",
            "source_locator": "https://social.example/northstar-bank",
            "stable_id": "did:example:northstar-bank",
            "source_identity": "did:example:northstar-bank",
        }
    )

    result = assess(candidate, [social_asset()])

    assert result["authorization_state"] == "unknown"
    assert result["decision_state"] == "review_required"
    assert "name_near_match" not in result["reasons"]
    assert not any(reason.startswith("added_word:") for reason in result["reasons"])

    unrelated_support = deepcopy(candidate)
    unrelated_support.update(
        {
            "display_name": "Acme Support",
            "source_locator": "https://social.example/acme-support",
            "stable_id": "did:example:acme-support",
            "source_identity": "did:example:acme-support",
        }
    )
    support_result = assess(unrelated_support, [social_asset()])
    assert "added_word:support" not in support_result["reasons"]


def test_matching_app_package_and_publisher_is_authorized_in_matching_store() -> None:
    candidate = get_fixture("app.official")
    assets = [
        app_asset(
            metadata={"store_id": "10001"},
            description="The official Northstar Pay mobile application.",
        )
    ]

    result = assess(candidate, assets)

    assert result["authorization_state"] == "authorized"
    assert result["decision_state"] == "authorized"
    assert "stable_identifier_match" in result["reasons"]


def test_same_package_with_different_publisher_requires_review() -> None:
    candidate = get_fixture("app.official")
    candidate["publisher"] = "Unrelated Publisher"
    candidate["source_locator"] = "https://apps.example/northstar-pay-copy"

    result = assess(candidate, [app_asset(metadata={"store_id": "10001"})])

    assert result["authorization_state"] != "authorized"
    assert result["decision_state"] == "review_required"
    assert "publisher_mismatch" in result["reasons"]


def test_stable_match_with_conflicting_visible_name_is_identity_drift() -> None:
    candidate = get_fixture("app.official")
    candidate["title"] = "Unrelated Wallet"
    candidate["source_locator"] = "https://apps.example/unrelated-wallet"

    result = assess(candidate, [app_asset(metadata={"store_id": "10001"})])

    assert result["authorization_state"] == "identity_drift"
    assert result["decision_state"] == "manual_review"
    assert "visible_metadata_conflict" in result["reasons"]


def test_self_declared_exact_match_is_not_an_official_exclusion() -> None:
    candidate = get_fixture("social.official")
    result = assess(candidate, [social_asset(authorization_state="self_declared")])

    assert result["authorization_state"] == "unknown"
    assert result["decision_state"] == "review_required"
    assert "self_declared_baseline_match" in result["reasons"]
    assert "self-declared" in " ".join(result["counterevidence"])


def test_expired_authorized_exception_is_not_used_for_exclusion() -> None:
    candidate = get_fixture("social.partner")
    candidate["observed_at"] = "2026-10-14T08:33:00Z"
    assets = [
        social_asset(
            stable_id="did:example:northstar-rewards-eu",
            url="https://social.example/northstar-rewards-eu",
            name="Northstar Rewards EU",
            authorization_state="authorized_with_scope",
            scope="EU rewards partner",
            expires_at="2026-10-13T00:00:00Z",
        )
    ]

    result = assess(candidate, assets)

    assert result["authorization_state"] == "unknown"
    assert result["decision_state"] == "review_required"
    assert "authorization_expired" in result["reasons"]


def test_url_match_cannot_override_conflicting_stable_identifier() -> None:
    candidate = get_fixture("social.spacing")
    candidate["platform"] = FIXTURE_SOCIAL_PLATFORM
    result = assess(candidate, [social_asset()])

    assert result["authorization_state"] == "identity_drift"
    assert result["decision_state"] == "manual_review"
    assert "canonical_url_match" in result["reasons"]
    assert "conflicting_stable_identifier" in result["reasons"]


@pytest.mark.parametrize(
    ("overrides", "reason"),
    [
        ({"availability_state": "unavailable"}, "source_unavailable"),
        ({"freshness_state": "stale"}, "source_stale"),
        ({"source_supported": False}, "source_unsupported"),
    ],
)
def test_source_failure_or_freshness_abstains(overrides: dict, reason: str) -> None:
    result = assess(get_fixture("social.lookalike"), [social_asset()], **overrides)

    assert result["decision_state"] == "insufficient_evidence"
    assert result["abstention_reason"] == reason
    assert result["evidence_quality"] == 0.0
    assert result["queue_priority"] == 0.0


def test_source_failure_cannot_authorize_a_retained_matching_payload() -> None:
    result = assess(get_fixture("social.official"), [social_asset()], availability_state="unavailable")

    assert result["authorization_state"] == "unknown"
    assert result["decision_state"] == "insufficient_evidence"


def test_explicit_observation_age_past_declared_ceiling_is_stale() -> None:
    result = assess(
        get_fixture("social.lookalike"),
        [social_asset()],
        as_of="2026-10-14T09:00:00Z",
        freshness_ceiling_seconds=60,
    )

    assert result["source_state"] == "stale"
    assert result["abstention_reason"] == "source_stale"
    assert result["decision_state"] == "insufficient_evidence"


def test_missing_baseline_abstains_even_when_candidate_metadata_is_complete() -> None:
    result = assess(get_fixture("social.lookalike"), [])

    assert result["baseline_state"] == "missing"
    assert result["decision_state"] == "insufficient_evidence"
    assert result["abstention_reason"] == "baseline_missing"
    assert result["evidence_quality"] == 0.0


def test_supplied_visual_similarity_is_ignored_and_visual_is_unsupported() -> None:
    candidate = get_fixture("social.lookalike")
    candidate["visual_similarity"] = 0.999
    result = assess(candidate, [social_asset(metadata={"avatar_hash": "near-only"})])

    assert result["dimensions"]["visual"]["state"] == "unsupported"
    assert "visual_similarity" not in result["reasons"]
    assert "visual_evidence_unsupported" in result["reasons"]


def test_exact_computed_hash_is_the_only_supported_visual_match() -> None:
    image = b"validated image bytes"
    digest = sha256(image).hexdigest()
    candidate = get_fixture("social.lookalike")
    candidate.pop("avatar_hash", None)
    candidate["avatar_bytes"] = image
    assets = [social_asset(metadata={"avatar_sha256": digest})]

    result = assess(candidate, assets)

    assert result["dimensions"]["visual"]["state"] == "match"
    assert result["dimensions"]["visual"]["method"] == "sha256_exact_only"
    assert "exact_image_hash_match" in result["reasons"]


def test_validated_hash_mismatch_is_reported_as_evaluated_no_match() -> None:
    candidate = get_fixture("social.lookalike")
    candidate.pop("avatar_hash", None)
    candidate["avatar_sha256"] = sha256(b"candidate image").hexdigest()
    result = assess(
        candidate,
        [social_asset(metadata={"avatar_sha256": sha256(b"different image").hexdigest()})],
    )

    assert result["dimensions"]["visual"]["state"] == "no_match"
    assert "validated exact image hashes were compared" in " ".join(result["counterevidence"])


def test_missing_required_scope_or_identity_evidence_abstains() -> None:
    candidate = {"asset_type": "social_profile", "display_name": "Northstar Pay"}
    result = assess(candidate, [social_asset()])

    assert result["decision_state"] == "insufficient_evidence"
    assert result["abstention_reason"] == "missing_required_evidence"
    assert {"platform", "source_locator", "stable_identifier"}.issubset(result["missing"])


def test_mixed_script_diagnostic_is_explicitly_partial() -> None:
    value = "Northѕtar Pay"  # Cyrillic small es in an otherwise Latin name.

    assert mixed_script(value)
    diagnostic = unicode_script_diagnostics(value)
    assert diagnostic["mixed_script"] is True
    assert diagnostic["status"] == "partial"
    assert "UTS" not in diagnostic["method"]


def test_url_normalization_keeps_identity_comparison_conservative() -> None:
    assert canonical_url("HTTPS://SOCIAL.EXAMPLE:443/northstarpay/../northstarpay#fragment") == (
        "https://social.example/northstarpay"
    )
    with pytest.raises(ValueError):
        canonical_url("https://user:password@social.example/profile")
