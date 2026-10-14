# Cairnwise Implementation Roadmap

This is a dependency-aware plan. Phase 1 and the local Phase 2 hardening slice
are implemented in the workspace; live-source enablement, production identity,
and device acceptance remain gated by setup and evidence.

| Milestone | Deliverables | Depends on | Exit evidence |
|---|---|---|---|
| M0 — Freeze source and data contract | choose first social/app adapters; terms record; fixture schema; label policy | owner decision | `source-manifest.json`, corpus manifest, open-question decisions |
| M0.5 — Local foundation | FastAPI modular monolith, SQLite relational repository boundary, auth/session boundary, deterministic fixture connectors | runtime available; frontend ownership boundary | authenticated API health, schema initialization, focused tests |
| M1 — Persistence foundation | workspace, brand, assets, versions, exceptions, migrations, auth/RBAC | M0 | migrations, CRUD tests, tenant tests |
| M2 — Observation intake | candidate dedupe, user URL/listing/fixture intake, source runs, capability states | M1 | API contract tests, persisted observation, degraded path |
| M2.5 — Source safety and governance | SSRF-safe bounded fetch, user-submitted metadata, source-rights manifests, disabled-by-default Bluesky/Apple contracts | M2 | `tests/test_sources.py`, rights manifest, explicit unavailable states |
| M3 — Deterministic detector | normalization, name families, URL/text signals, icon hash, independent dimensions, abstention | M2 | unit fixtures, evidence trace, detector version |
| M4 — Required UI workflow | onboarding, social/app review, evidence comparison, queue, case creation | M1–M3 | browser end-to-end run |
| M5 — Response and coverage | report draft, approval, recheck, outcome ledger, coverage report | M4 | evidence-linked export and outage demo |
| M6 — Replay and evaluator proof | mutation corpus, regression runner, requirement matrix, demo manifest | M3–M5 | synthetic report; held-out report only if valid |
| M7 — Security/accessibility hardening | SSRF/upload, RLS, secrets, retention, audit, WCAG, observability, SBOM | M1–M6 | security/accessibility/reproducibility checklist |
| M7.5 — Supabase and mobile client | Supabase Google JWT boundary, public-key browser config, Expo client against `/v1` API | M4, M7 | auth tests, mobile typecheck/export/doctor, device OAuth acceptance |
| M8 — Pilot validation | design-partner interviews, scoped run, baseline comparison, pricing test | M7 | measured pilot report and go/no-go decision |
| M9 — Paid-pilot operating loop | `EXT-001`, `EXT-002`, `EXT-006`, `EXT-007`, `EXT-011`, `EXT-013`, `EXT-014` | M8 | scheduled run, deduplicated queue, owned triage, evidence room, retention/deletion evidence |
| M10 — Reliability and unit economics | `EXT-016`, `EXT-017`, `EXT-018`, `EXT-026`, `EXT-028` | M9 | retry/pause/backfill evidence, schema-drift quarantine, usage ledger, outcome report |
| M11 — Adoption integrations | `EXT-021`, then selected `EXT-022`/`EXT-023` | M10 | one idempotent ticketing flow; notification/event delivery report if justified by pilot demand |
| M12 — Expansion review gate | evaluate `EXT-003`–`EXT-030` against pilot evidence | M10 | decision record for each candidate: build, defer, reject, or research; no roadmap item enters without source, value, safety, and test evidence |

## Current implementation evidence

- `cairnwise/` contains the local API, relational schema, auth boundary,
  deterministic fixtures, normalization, detector, and service layer.
- `tests/test_api.py` and `tests/test_detector.py` are executable checks; their
  passing status is reported in the implementation handoff, not inferred from
  this plan.
- `workspace.html` is the API-driven visual acceptance surface when present;
  `index.html` remains the concept/landing surface owned by the counterpart
  frontend session.
- `cairnwise/source_security.py`, `connectors.py`, and `evidence.py` implement
  bounded intake, source contracts, retention/legal hold, deletion proofs, and
  tenant-scoped exports.
- `mobile/` implements the native Expo client shell; it still needs a real
  Supabase project and device/simulator OAuth verification.

## Critical path

`M0 → M1 → M2 → M3 → M4 → M5 → M6 → M7`.

Do not begin broad connector work, public Verify, graph expansion, or model training until M4 is stable. If time is constrained, cut M6 graph/advanced AI and all M9+ expansion before cutting official exclusion, source failure handling, persistence, or the app/social vertical slice. The `EXT-*` catalog is a product strategy, not evidence that implementation has started.
