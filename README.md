# Cairnwise local foundation

Cairnwise is an evidence-first digital identity risk operations product. The
current implementation is intentionally a **real local Phase 2 foundation**,
not a collection of hardcoded dashboard screens.

## What works now

- FastAPI modular-monolith API under `cairnwise/`.
- Local password registration/login with hashed passwords and opaque bearer
  sessions.
- Workspace membership and stored roles with cross-tenant fail-closed checks.
- Relational SQLite persistence for workspaces, brands, official assets,
  source runs, candidates, observations, assessments, evidence, cases, case
  events, and report drafts.
- Deterministic synthetic social/app fixtures labelled
  `source_mode=synthetic_fixture`.
- Conservative official-asset matching, look-alike name signals, publisher and
  package signals, source outage states, abstention, and evidence traces.
- Responsive API-driven workspace at `http://127.0.0.1:8765/workspace`.
- Supabase Google JWT boundary with local development fallback when Supabase is
  not configured.
- Secure user-submitted URL/listing intake with SSRF-safe validation and
  bounded metadata fetches.
- Disabled-by-default Bluesky and Apple metadata connector contracts with source
  rights/retention metadata.
- Tenant-scoped evidence exports (JSON/CSV), retention preview, legal holds,
  deletion proofs, and audit events.
- Native Expo client under `mobile/` using the same API and Supabase public
  configuration.
- The existing `index.html` remains a landing/concept surface owned by the
  counterpart frontend session; it is not silently presented as live data.

## Run locally

Python 3.14 and the required packages are already available in the current
workspace. For a fresh environment:

```powershell
python -m pip install -r requirements.txt
python run_server.py
```

Open:

- `http://127.0.0.1:8765/workspace` — real local workspace
- `http://127.0.0.1:8765/` — existing landing/concept page
- `http://127.0.0.1:8765/docs` — FastAPI contract documentation
- `http://127.0.0.1:8765/health` — local readiness/status
- `mobile/README.md` — native mobile setup and Google redirect configuration

The default database path is `data/cairnwise.db`. Override it for an isolated
run with `CAIRNWISE_DB_PATH`. Do not commit the database file or credentials.

## Phase 1 walkthrough

1. Create a local account at `/workspace`.
2. Choose **Load fixture baseline** to persist fictional Northstar Pay and its
   official social/app assets, or create a workspace/brand manually.
3. Open **Review queue** and run **Social look-alike** or **App look-alike**.
4. Inspect independent identity, authorization, potential-harm, and evidence
   dimensions plus stored evidence hashes.
5. Open a case, record `monitor`, `investigate`, or
   `insufficient_evidence`; the policy disposition requires a stored reviewer
   role.
6. Generate an evidence-linked report draft. Nothing is submitted externally.
7. Run **Source outage** and inspect Coverage Contract; it remains unavailable
   rather than becoming an all-clear.

All fixture inputs are synthetic and are not evidence of live coverage.

## Checks

Run from the repository root:

```powershell
python -m pytest -q
```

Current result: 48 backend tests passed, with two installed-environment
deprecation warnings from Starlette/httpx. Additional checks:

```powershell
python -m compileall -q cairnwise tests
```

The full verification matrix and remaining gaps are documented in
`IMPLEMENTATION_PHASES.md`, `VALIDATION_PLAN.md`, and
`REQUIREMENTS_TRACEABILITY.md`.

Mobile checks from `mobile/`:

```powershell
npm install
npm run typecheck
npx expo config --type public
npx expo-doctor
npx expo export --platform web
```

These currently pass. A physical-device/simulator OAuth run still requires a
real Supabase project and Google provider configuration.

## Deliberate gaps

- No live social/app connector is enabled yet.
- Bluesky and Apple adapters are implemented as source-specific contracts but
  remain disabled until `source-rights.example.json` is completed and the
  connector is explicitly enabled.
- No unrestricted crawler, autonomous takedown, public accusation, or external
  report submission exists.
- SQLite is a local foundation; PostgreSQL/RLS is a hardening/deployment gate.
- Binary upload/object storage and native background monitoring are not
  implemented. Current intake is metadata-only and bounded.
- Supabase Google authentication is not live until the project URL, public key,
  server-side JWT verifier, Google provider, and redirect allow-list are set.
