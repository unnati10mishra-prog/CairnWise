# Cairnwise Validation Plan

## 1. Pre-implementation experiments

| Experiment | Question | Procedure | Pass criterion | Status |
|---|---|---|---|---|
| V-01 | Does the first social source return usable profile fields? | Call declared public/permitted actor-search endpoint; record schema, terms, rate behavior | stable ID/name/avatar/description or explicit decision to use another source | Bluesky probe completed; implementation still pending |
| V-02 | Can Apple metadata support app comparison? | Lookup known app ID; inspect title, seller, bundle ID, description, icon reference, timestamps | fields map to app observation contract | Completed as a public probe; rights review pending |
| V-03 | Can Google Play fields be collected within allowed terms? | Review official API scope; test permitted listing-reference route | source adapter and terms record approved | Public page probe completed; adapter decision pending |
| V-04 | Are name mutations separable from benign names? | Build frozen mutation/benign corpus with reviewer labels | per-pattern examples and disagreement recorded | Not executed; corpus required |
| V-05 | Does image hashing survive expected edits? | Use permitted logo fixtures with crop/resize/compression/color changes | threshold chosen from labelled benign/adversarial examples | Not executed |
| V-06 | Does the schema prevent tenant leakage? | Run direct-object and RLS tests as multiple roles | zero unauthorized reads/writes | Not executed |
| V-07 | Are URL and upload paths safe? | SSRF/private IP/redirect and malicious file fixtures | all dangerous inputs rejected or quarantined | Not executed |

## 1A. Implementation checks completed

| Check | Command / evidence | Result |
|---|---|---|
| Deterministic detector suite | `python -m pytest -q tests/test_detector.py` | 21 passed |
| Auth/API/security foundation suite | `python -m pytest -q tests/test_api.py` | 7 passed |
| Combined application suite | `python -m pytest -q` | 28 passed; 2 dependency deprecation warnings |
| Inline workspace client syntax | `node -e "...new Function(...)..."` | syntax ok |
| Local service health | `GET http://127.0.0.1:8765/health` | foundation / 2 fixture connectors registered |
| Visual layout smoke | Chrome headless screenshots at 1440×1000 and 390×844 | auth surface rendered; mobile emulation remains a manual follow-up |

These checks prove the local Phase 1 path only. They do not prove live connector permission, production deployment, PostgreSQL/RLS, native mobile, or customer-level performance.

## 1B. Phase 2 implementation checks

| Check | Command / evidence | Result |
|---|---|---|
| Source security, connector, intake, retention, export suite | `python -m pytest -q tests/test_sources.py` | 16 passed |
| Full backend suite after Phase 2 | `python -m pytest -q` | 48 passed; 2 dependency deprecation warnings |
| Supabase auth boundary | `tests/test_supabase_auth.py` | 4 passed; live OAuth not run without project configuration |
| Native client TypeScript | `npm run typecheck` from `mobile/` | passed |
| Expo configuration | `npx expo config --type public` from `mobile/` | SDK 51 / iOS, Android, Web resolved |
| Native project health | `npx expo-doctor` from `mobile/` | 17/17 checks passed |
| Native web bundle | `npx expo export --platform web` from `mobile/` | exported successfully |

The remaining Phase 2 checks are real Supabase Google OAuth on a configured
project, permitted live Bluesky/Apple calls after rights enablement, and a
physical-device or simulator acceptance run.

## 2. Evaluation corpus policy

Every example has: origin, permission basis, platform/store, collection date, locale, label policy, adjudicator(s), disagreement, data license/retention, and whether it is synthetic. The corpus must contain official assets, legitimate partners, fan/parody/unrelated look-alikes, suspicious candidates, missing-data cases, and source failures. Freeze a version before threshold tuning.

## 3. Metrics

- precision@review queue and recall by pattern, with denominators and sample sizes;
- official/approved exclusion accuracy;
- abstention rate and evidence completeness;
- false-positive rate among legitimate exceptions;
- source success, freshness compliance, parser/schema failures;
- analyst time-to-triage and duplicate-work rate;
- verified outcome rate, separating unknown from failure;
- regression breakage after detector/connector changes.

No target is a result until measured. Provisional MVP targets: precision@review ≥0.80 on a frozen held-out slice, per-pattern recall goal ≥0.80 only where sample size supports interpretation, and zero seeded official-asset exclusion failures in the demo corpus. Report confidence limits and limitations.

## 4. Demonstration acceptance

The demo passes only if it shows: brand profile persistence; official exclusion; one social candidate; one app candidate; look-alike reasons; one benign exception; source outage/degraded state; case/report persistence; and a replay result. A screenshot-only or hardcoded response fails the demonstration.

## 5. Beyond-PS expansion gates

The following checks apply to the first paid-pilot expansion set in `EXPANSION_CATALOG.md`:

| Expansion group | Acceptance evidence | Do not claim until |
|---|---|---|
| `EXT-001`, `EXT-002` | Two scheduled runs, one unchanged candidate, one changed candidate, cross-source dedupe with preserved provenance | the run ledger and candidate history are persisted and replayable |
| `EXT-006`, `EXT-007` | Assigned queue, overdue case, playbook completion block, immutable handoff history | an analyst can complete the workflow without hidden/manual state |
| `EXT-011`, `EXT-013`, `EXT-014` | Coverage report, expiring evidence-room link, revocation, retention deletion, legal-hold exception | access and deletion tests pass for two tenants |
| `EXT-016`, `EXT-017`, `EXT-018` | Bounded retry/pause/backfill, schema-drift quarantine, per-tenant usage/cost report | failure injection and usage reconciliation are repeatable |
| `EXT-021`, `EXT-026`, `EXT-028` | Idempotent ticket handoff, plan-limit behavior, outcome/ROI report with denominator and uncertainty | the integration and report are backed by event-ledger evidence |

No expansion metric becomes a result merely because a dashboard displays it. Each report must identify sample, period, denominator, source mode, and limitations.
