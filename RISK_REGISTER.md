# Cairnwise Risk Register

| ID | Risk | Likelihood | Impact | Mitigation | Trigger / owner | Residual risk |
|---|---|---:|---:|---|---|---|
| RSK-01 | First social source cannot be used or lacks required fields | High | High | Lock adapter terms and capability manifest before implementation; keep fixture/manual path | access checkpoint / Product+Legal | Medium |
| RSK-02 | App listing source changes schema or blocks collection | Medium | High | Apple metadata probe plus user-submitted/fixture fallback; parser contract tests | parser failure / Connector owner | Medium |
| RSK-03 | Official account or app is falsely flagged | Medium | Critical | stable-ID precedence, exceptions, counterevidence, abstention, held-out benign cases | false-positive queue / Detection owner | Medium |
| RSK-04 | Similarity is mistaken for malicious intent | Medium | Critical | controlled vocabulary, separate dimensions, analyst approval, no public verdict | review of report templates / Trust owner | Low |
| RSK-05 | Demo relies on synthetic data while implying live monitoring | Medium | High | visible source-mode labels, fixture manifest, one real/permitted probe only if available | demo rehearsal / Demo owner | Low |
| RSK-06 | Tenant data leaks through object IDs or storage URLs | Medium | Critical | RLS + service authorization + expiring links + cross-tenant tests | security gate / Backend owner | Medium |
| RSK-07 | Candidate URL causes SSRF or parser denial of service | Medium | Critical | allowlisted schemes, private-IP block, redirect/DNS controls, size/time limits | security test / Backend owner | Medium |
| RSK-08 | Uploaded logo/screenshot is malicious | Medium | High | allowlist, signature validation, decode/re-encode, private storage, parser limits | upload test / Backend owner | Low/Medium |
| RSK-09 | LLM prompt injection or uncited hallucination | Medium | High | no external write tools, evidence-only context, schema validation, red-team fixtures | AI feature review / AI owner | Low |
| RSK-10 | No representative labelled data | High | High | synthetic tests clearly separated; collect permitted/adjudicated pilot labels; no accuracy claim | corpus checkpoint / Detection owner | High |
| RSK-11 | Graph relationship overreach creates reputational harm | Medium | High | edge evidence IDs, hypothesis labels, analyst override, no operator attribution | graph review / Trust owner | Low |
| RSK-12 | Scope expansion prevents a stable demo | High | High | freeze Tier 0/1, defer dark web, takedown automation, extra channels | weekly scope review / Product owner | Medium |
| RSK-13 | Pricing/value hypothesis is wrong | High | Medium | interviews, baseline hours, scoped pilot, conversion gate | pilot review / Founder | High |
| RSK-14 | Data licensing or retention rights are unclear | Medium | High | connector source register, metadata-only default, counsel review before retaining assets | source approval / Legal owner | Medium |
| RSK-15 | Security claims exceed performed verification | Medium | High | label controls planned/verified; ASVS-oriented evidence; no certification claims | release gate / Security owner | Low |
| RSK-16 | Unicode update changes skeleton/normalization outputs | Low/Medium | Medium | store Unicode version; version detector; re-run migrations/evaluations | dependency update / Detection owner | Low |
| RSK-17 | Expansion portfolio becomes unbounded feature bloat | High | High | keep `EXT-*` catalog separate from PS score; require source, value, safety, test, and unit-economics gate for every addition | roadmap review / Product owner | Medium |
| RSK-18 | Continuous monitoring creates cost or alert fatigue | Medium | High | scheduled change detection, per-tenant quotas, queue aging, false-positive labels, and pilot-level cost reporting | pilot review / Product+Operations | Medium |
| RSK-19 | External evidence room or integrations widen data exposure | Medium | Critical | expiring scoped links, minimal message payloads, signed events, access logs, revocation, and cross-tenant tests | integration release / Security owner | Medium |
| RSK-20 | Startup name is confused with legal or market clearance | Medium | Medium | use Cairnwise only as provisional; maintain shortlist and obtain professional trademark/company/domain/handle checks before launch | naming gate / Founder | Medium |

## Risk acceptance rule

No Critical risk may be marked accepted for the challenge demo unless the demo shows the limitation and a safe degraded behavior. Residual risk is not proof of safety; it is the remaining uncertainty after the stated mitigation.
