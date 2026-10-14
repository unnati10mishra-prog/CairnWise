# Cairnwise Requirements Traceability

**Authority:** `PS.md`  
**Status:** active implementation traceability; Phase 1 foundation evidence exists, while unimplemented or live-source requirements remain explicitly open.

| Requirement ID | Official requirement | Interpretation | Capability IDs | Test IDs | Demo evidence |
|---|---|---|---|---|---|
| PS-SCOPE-01 | Digital Risk Protection focused on Social & App Monitoring | Product scope is limited to social profiles/pages and mobile app listings for first release | C-004..C-007 | T-SOC-01..04, T-APP-01..04 | D-01 steps 2–4 |
| PS-BRAND-01 | Define company/brand name | Required brand field and canonical name | C-001 | T-BRAND-01 | D-01 step 1 |
| PS-BRAND-02 | Define official logo | Store logo variants with provenance and hash | C-001, CORE-002 | T-BRAND-01 | D-01 step 1 |
| PS-BRAND-03 | Define official social accounts | Store platform, URL, stable ID, scope, verification | C-002 | T-BRAND-02, T-EXC-01 | D-01 steps 1, 5 |
| PS-BRAND-04 | Define official mobile applications | Store listing, package/bundle ID, developer/publisher, proof | C-003 | T-BRAND-03, T-APP-03 | D-01 steps 1, 4 |
| PS-BRAND-05 | Other brand identifiers | Aliases, historical names, domains, product names, locale | C-001, CORE-002 | T-BRAND-01..02 | D-01 step 1 |
| PS-SOC-01 | Detect brand impersonation accounts | Permitted discovery/intake plus evidence-linked comparison | C-004, C-005 | T-SOC-01..02 | D-01 step 2 |
| PS-SOC-02 | Detect fake company pages | Social profile/page candidate type and review state | C-005, CORE-008 | T-SOC-02 | D-01 step 3 |
| PS-SOC-03 | Detect scam profiles | Harm signals and human review; no unsupported criminal claim | C-005, CORE-007 | T-SOC-02, TRUST-01 | D-01 step 3 |
| PS-SOC-04 | Similar names, logos, branding | Independent text, Unicode, visual, bio, link signals | C-005, C-008 | T-SOC-02, T-NAME-01..04 | D-01 step 3 |
| PS-APP-01 | Detect similar app names | Store title/name comparison and look-alike mutations | C-007, C-008 | T-APP-02, T-NAME-* | D-01 step 4 |
| PS-APP-02 | Detect brand/logo impersonation | Icon/image comparison with provenance and limitations | C-007, CORE-006 | T-APP-02 | D-01 step 4 |
| PS-APP-03 | Detect different developers/publishers | Independent publisher/developer conflict signal | C-007 | T-APP-02 | D-01 step 4 |
| PS-APP-04 | Detect resembling descriptions/branding | Text overlap and copied-asset evidence | C-007 | T-APP-02 | D-01 step 4 |
| PS-EXTRA-01 | Character swaps | Controlled mutation and Unicode diagnostics | C-008, DIFF-004 | T-NAME-01 | D-01 step 7 |
| PS-EXTRA-02 | Added words | Added-word detector with benign examples | C-008 | T-NAME-02, T-NAME-04 | D-01 step 7 |
| PS-EXTRA-03 | Spacing changes | Separator/spacing feature family | C-008 | T-NAME-03 | D-01 step 7 |
| PS-EXTRA-04 | Avoid over-flagging | Official/partner exceptions, unrelated controls, abstention | C-009, CORE-003, CORE-010 | T-EXC-01..04, T-NAME-04 | D-01 step 5 |
| PS-DELIV-01 | Working prototype | End-to-end vertical slice with persistence, not static screens | all Tier 0/Core P0 | all P0 tests | D-01 |
| PS-DELIV-02 | Architecture diagram | Data sources, detection, storage, official exclusion | C-010 | D-01 | `SOLUTION.md` architecture |
| PS-DELIV-03 | Short demo/slides | Reproducible seven-minute scenario and evidence manifest | C-010, CORE-018 | D-01 | demo recording/live run |
| PS-EVAL-01 | Social monitoring 30 points | Evidence and official exclusion are both demonstrated | C-004,C-005,C-009 | T-SOC-*, T-EXC-* | D-01 steps 2–3 |
| PS-EVAL-02 | App monitoring 30 points | Metadata, comparisons, publisher differences, official exclusion | C-006,C-007,C-009 | T-APP-*, T-EXC-* | D-01 step 4 |
| PS-EVAL-03 | Brand profile 15 points | Validated baseline and provenance | C-001..C-003 | T-BRAND-* | D-01 step 1 |
| PS-EVAL-04 | UX 15 points | Setup, readable detections, graceful source failure | CORE-008..CORE-010, READY-015 | T-UX-* | D-01 steps 2, 6 |
| PS-EVAL-05 | Presentation 10 points | Clear claims with actual evidence and limitations | CORE-018 | D-01 | demo + evidence manifest |

## Evidence status vocabulary

- **Not executed:** planned; no test result.
- **Research verified:** external documentation or public endpoint was inspected; this does not verify Cairnwise.
- **Expansion note:** `EXT-*` capabilities in `EXPANSION_CATALOG.md` are beyond-PS product strategy. They do not satisfy an official requirement or count as implementation evidence until their own acceptance evidence exists.
- **Fixture verified:** implementation passed an offline fixture test.
- **Live verified:** implementation passed against an allowed live source under recorded terms/credentials; none is claimed yet for Phase 2 connectors.
- **Pilot measured:** future customer/pilot metric with sample, denominator, and method.

## Current implementation evidence

| Implemented slice | Evidence | Scope boundary |
|---|---|---|
| Authenticated workspace and role boundary | `tests/test_api.py` auth, persistence, cross-tenant, spoofing, role, CORS cases; `tests/test_supabase_auth.py` | Local password sessions are development fallback; Supabase JWT verification is implemented but live project/OAuth setup is pending |
| Brand baseline and official asset registry | `tests/test_api.py::test_dev_seed_requires_auth_and_is_scoped_to_the_authenticated_workspace`; API `/v1/workspaces`, `/v1/brands`, `/v1/brands/{id}/assets` | SQLite local persistence; logo bytes/object storage not implemented |
| Deterministic fixture social/app intake | `tests/test_detector.py`; foundation vertical-slice API test | `synthetic_fixture` only; not live monitoring |
| Evidence-linked assessment and case workflow | `tests/test_api.py::test_foundation_vertical_slice_persists_assessment_trace_case_and_report` | Report is a draft; no external submission |
| Responsive API-driven workspace | `workspace.html`, `/workspace`; desktop/mobile CSS smoke screenshots | Browser visual acceptance is local; native device OAuth acceptance remains open |
| Secure user-submitted intake and source boundaries | `tests/test_sources.py`; `source_security.py`; `connectors.py` | Metadata-only bounded fetch; no binary upload/object storage; live connectors disabled until rights approval |
| Retention, legal hold, deletion proof, export | `tests/test_sources.py`; `evidence.py`; `/v1/workspaces/{id}/retention/*`; `/v1/candidates/{id}/evidence/export` | Local SQLite execution; PostgreSQL/RLS and production object storage remain open |
| Native mobile client contract | `mobile/`, `MOBILE_CLIENT.md`; `npm run typecheck`, Expo config/doctor/export | Real Supabase project, Google provider, redirect allow-list, and device/simulator run remain open |
