"""Explicit, deterministic fixture sources for offline verification.

Fixtures are product test inputs, not claims of live source coverage.  The API
returns ``source_mode=synthetic_fixture`` on every fixture observation.
"""

from __future__ import annotations

from copy import deepcopy


FIXTURE_SOCIAL_PLATFORM = "fixture_social"
FIXTURE_APP_STORE = "fixture_app_store"


CONNECTOR_MANIFESTS = {
    "fixture.social.v1": {
        "connector_key": "fixture.social.v1",
        "source": "Cairnwise deterministic social fixture",
        "asset_type": "social_profile",
        "platform": FIXTURE_SOCIAL_PLATFORM,
        "operations": ["get_profile", "search_profiles"],
        "fields": ["platform", "stable_id", "handle", "display_name", "avatar_hash", "description", "external_url"],
        "auth": "offline_fixture_only",
        "terms_basis": "synthetic fixture authored for local verification",
        "freshness_ceiling": "fixture-controlled",
        "failure_states": ["unavailable", "degraded", "schema_changed"],
    },
    "fixture.app.v1": {
        "connector_key": "fixture.app.v1",
        "source": "Cairnwise deterministic app-store fixture",
        "asset_type": "mobile_app",
        "store": FIXTURE_APP_STORE,
        "operations": ["get_listing", "search_listings"],
        "fields": ["store", "store_id", "title", "icon_hash", "package_id", "publisher", "description", "support_url"],
        "auth": "offline_fixture_only",
        "terms_basis": "synthetic fixture authored for local verification",
        "freshness_ceiling": "fixture-controlled",
        "failure_states": ["unavailable", "degraded", "schema_changed"],
    },
}


FIXTURES = {
    "social.official": {
        "fixture_id": "social.official",
        "asset_type": "social_profile",
        "platform": FIXTURE_SOCIAL_PLATFORM,
        "source_identity": "did:example:northstar-official",
        "source_locator": "https://social.example/northstarpay",
        "stable_id": "did:example:northstar-official",
        "handle": "northstarpay",
        "display_name": "Northstar Pay",
        "avatar_hash": "northstar-logo-v1",
        "description": "Official Northstar Pay account. Customer support is listed on northstarpay.example.",
        "external_url": "https://northstarpay.example",
        "observed_at": "2026-10-14T08:30:00Z",
    },
    "social.lookalike": {
        "fixture_id": "social.lookalike",
        "asset_type": "social_profile",
        "platform": FIXTURE_SOCIAL_PLATFORM,
        "source_identity": "did:example:northstar-support",
        "source_locator": "https://social.example/northstarpay-support",
        "stable_id": "did:example:northstar-support",
        "handle": "northstarpay_support",
        "display_name": "Northstar Pay Support",
        "avatar_hash": "northstar-logo-near-duplicate",
        "description": "Official Northstar Pay support. Verify your account at our secure login page.",
        "external_url": "https://northstar-support.example/login",
        "observed_at": "2026-10-14T08:31:00Z",
    },
    "social.spacing": {
        "fixture_id": "social.spacing",
        "asset_type": "social_profile",
        "platform": FIXTURE_SOCIAL_PLATFORM,
        "source_identity": "did:example:northstar-spacing",
        "source_locator": "https://social.example/northstarpay",
        "stable_id": "did:example:northstar-spacing",
        "handle": "northstarpay",
        "display_name": "NorthstarPay",
        "avatar_hash": "unrelated-logo",
        "description": "Independent payments community.",
        "external_url": "https://community.example",
        "observed_at": "2026-10-14T08:32:00Z",
    },
    "social.partner": {
        "fixture_id": "social.partner",
        "asset_type": "social_profile",
        "platform": FIXTURE_SOCIAL_PLATFORM,
        "source_identity": "did:example:northstar-rewards-eu",
        "source_locator": "https://social.example/northstar-rewards-eu",
        "stable_id": "did:example:northstar-rewards-eu",
        "handle": "northstarrewardseu",
        "display_name": "Northstar Rewards EU",
        "avatar_hash": "northstar-rewards-logo",
        "description": "Northstar Pay regional rewards partner.",
        "external_url": "https://rewards.example",
        "observed_at": "2026-10-14T08:33:00Z",
    },
    "app.official": {
        "fixture_id": "app.official",
        "asset_type": "mobile_app",
        "store": FIXTURE_APP_STORE,
        "source_identity": "apple:10001",
        "source_locator": "https://apps.example/northstar-pay-mobile",
        "store_id": "10001",
        "title": "Northstar Pay Mobile",
        "icon_hash": "northstar-app-icon-v1",
        "package_id": "com.northstar.pay",
        "publisher": "Northstar Payments Ltd",
        "description": "The official Northstar Pay mobile application.",
        "support_url": "https://northstarpay.example/support",
        "observed_at": "2026-10-14T08:34:00Z",
    },
    "app.lookalike": {
        "fixture_id": "app.lookalike",
        "asset_type": "mobile_app",
        "store": FIXTURE_APP_STORE,
        "source_identity": "apple:10002",
        "source_locator": "https://apps.example/northstar-pay-secure",
        "store_id": "10002",
        "title": "Northstar Pay Secure",
        "icon_hash": "northstar-app-icon-near-duplicate",
        "package_id": "com.northstar.secure",
        "publisher": "Northstar Secure Apps",
        "description": "Secure Northstar Pay login and account verification. Sign in to protect your wallet.",
        "support_url": "https://northstar-secure.example/login",
        "observed_at": "2026-10-14T08:35:00Z",
    },
    "app.missing": {
        "fixture_id": "app.missing",
        "asset_type": "mobile_app",
        "store": FIXTURE_APP_STORE,
        "source_identity": "apple:10003",
        "source_locator": "https://apps.example/northstar-pay-help",
        "store_id": "10003",
        "title": "Northstar Pay Help",
        "description": "Northstar Pay help resources.",
        "observed_at": "2026-10-14T08:36:00Z",
    },
    "source.outage": {
        "fixture_id": "source.outage",
        "asset_type": "social_profile",
        "platform": FIXTURE_SOCIAL_PLATFORM,
        "source_identity": "fixture:outage",
        "source_locator": "fixture://source.outage",
        "availability_state": "unavailable",
        "failure_code": "FIXTURE_SOURCE_UNAVAILABLE",
        "failure_message": "The deterministic source is deliberately unavailable for degraded-mode verification.",
        "observed_at": "2026-10-14T08:37:00Z",
    },
}


def connector_for_fixture(fixture_id: str) -> str:
    fixture = FIXTURES.get(fixture_id)
    if fixture is None:
        raise KeyError(fixture_id)
    return "fixture.app.v1" if fixture["asset_type"] == "mobile_app" else "fixture.social.v1"


def get_fixture(fixture_id: str) -> dict:
    if fixture_id not in FIXTURES:
        raise KeyError(fixture_id)
    return deepcopy(FIXTURES[fixture_id])
