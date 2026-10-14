# Cairnwise Implementation Phases

This document converts `SOLUTION.md` from a specification into a sequence of
working, inspectable product slices. A phase is not complete because files
exist; it is complete only when its API behavior, persistence behavior, tests,
and visual smoke path all agree.

## Phase 0 — Runtime and ownership boundary

**Status:** complete

- Preserve `index.html` as the counterpart session's landing/concept surface.
- Add a sibling `/workspace` application surface instead of silently converting
  the hardcoded landing preview into a live product.
- Establish one API contract for desktop web, mobile web, and the future native
  mobile client.
- Use local SQLite for reproducible development because PostgreSQL is not
  available in this workspace. Keep the relational repository boundary so the
  deployment store can move to PostgreSQL/RLS later.

## Phase 1 — Real local vertical slice

**Status:** foundation implemented; API and auth-shell visual smoke verified; full authenticated browser acceptance remains the next verification step

**User outcome:** an authenticated user can create or seed a workspace, review a
fictional Northstar Pay baseline, submit a clearly labelled offline fixture,
see a deterministic assessment with independent dimensions and evidence, open a
case, record a human decision, generate a report draft, and inspect connector
coverage.

### Acceptance criteria

1. Registration/login issues an opaque bearer session; passwords and tokens are
   not persisted in plaintext.
2. Workspace membership, role checks, and cross-tenant object access fail
   closed.
3. Official assets are persisted separately from observations and candidates.
4. Fixture intake is idempotent and stores source run, raw observation,
   normalized values, content hash, assessment, and evidence records.
5. `synthetic_fixture` is visible in API responses and the UI; it is never
   described as live monitoring.
6. Deterministic detection handles official exclusion, unknown authorization,
   look-alike names, publisher/package signals, missing evidence, source
   failures, and abstention without making legal or criminal claims.
7. Case events and report drafts are persisted; outbound submission is not
   automated.
8. Desktop and narrow mobile web views can complete the same flow against the
   same API.

### Current evidence

- `tests/test_api.py`: auth, persistence, cross-tenant isolation, role checks,
  scoped seed, request limits, and CORS.
- `tests/test_detector.py`: 21 deterministic detector cases including official
  assets, look-alike names, stale/unavailable sources, image limitations, and
  Unicode diagnostics.
- `cairnwise/schema.sql`: relational workspace/brand/asset/source-run/
  candidate/observation/assessment/evidence/case/event/report tables.

## Phase 2 — Source adapter and evidence hardening

**Status:** implemented locally; live source enablement remains configuration- and rights-gated

- Add one permitted social adapter behind its manifest, beginning with the
  documented Bluesky candidate path only after final terms review.
- Add Apple metadata lookup adapter or user-submitted listing references under a
  source-specific rights record.
- Add secure user-submitted observation intake and metadata-only retention.
- Add assessment re-run endpoint with immutable detector versions and full
  trace storage.
- Add SSRF-safe URL handling, upload quarantine, retention/deletion jobs, and
  export hashes.

**Implemented evidence:** `source_security.py`, `connectors.py`, `evidence.py`,
`tests/test_sources.py`, user-submitted metadata intake, source-rights manifests,
Bluesky/Apple adapter contracts, disabled connector states, retention previews,
legal holds, deletion proofs, and tenant-scoped JSON/CSV exports.

**Exit boundary:** user-submitted intake and mocked connector contracts are
verified. Live Bluesky/Apple calls remain disabled until the source-rights record
is completed and the connector is explicitly enabled.

## Phase 3 — Analyst workflow completeness

**Status:** native client shell implemented; device/OAuth acceptance pending

- Queue filters, ownership, aging, missing-evidence tasks, exception workflow,
  case timeline, evidence comparison, and platform-specific report drafts.
- Add recheck/outcome states without inferring removal from submission.
- Add coverage scorecard and source-change alerts.

**Exit evidence:** the complete J-01 through J-06 journeys in `SOLUTION.md` can
  be completed with stored state and no hardcoded result.

## Phase 4 — Mobile clients and shared product shell

**Status:** not started

- Stabilize the versioned API and token lifecycle first.
- Build mobile web against the same responsive workspace routes.
- Then build a native mobile client only after the API contract and visual
  acceptance are stable; it must not duplicate detector or authorization logic.
- Native app scope begins with sign-in, workspace selection, queue, evidence
  view, case decision, and coverage/outage visibility. It will not claim native
  background monitoring until mobile notification, permission, and worker
  behavior are implemented and tested.

**Implemented:** `mobile/` Expo SDK 51 TypeScript client using the same API,
Supabase Google OAuth deep link, queue/evidence/case/report/coverage flows, and
explicit setup/unavailable states. See `mobile/README.md` and
`MOBILE_CLIENT.md`.

## Phase 5 — Production hardening and pilot

**Status:** not started

- PostgreSQL migration/RLS, secret lifecycle, rate limits, observability,
  backups, accessibility, SBOM, and release checks.
- Design-partner corpus, replay evaluation, analyst time measurement, and unit
  economics.

## Truth boundary

Until a phase's exit evidence exists, it remains a planned capability. The
current implementation is a real local application path over synthetic and
user-submitted metadata, with source adapters and a native client contract in
place. It is not yet continuous live monitoring, a production Supabase
deployment, or a device-verified native release.
