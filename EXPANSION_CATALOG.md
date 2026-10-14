# Cairnwise Beyond-PS Expansion Catalog

**Status:** product expansion specification; no capability in this catalog is implemented or performance-verified.

**Purpose:** extend the PS-compliant vertical slice into a credible startup product without turning the roadmap into an unbounded feature list. `C-*`, `CORE-*`, `DIFF-*`, and `READY-*` remain the challenge baseline. The `EXT-*` capabilities below are optional product expansion and do not increase the official PS score until implemented and evidenced.

## Prioritization rules

- **MVP:** justified for the first paid design-partner pilot after the challenge vertical slice.
- **Near-term:** add only when pilot evidence shows repeated demand or measurable analyst friction.
- **Later:** defer until source contracts, tenancy, evidence governance, and unit economics are proven.
- Effort is indicative: **S** 1–2 engineer-weeks, **M** 3–6, **L** 6–10, **XL** 10+.
- Every connector, automation, and model feature must retain an explicit unavailable, stale, or insufficient-evidence state.

## 1. Detection and prioritization

| ID | Capability | Stage | Dependencies | Effort | Acceptance criterion |
|---|---|---|---|---:|---|
| EXT-001 | Scheduled incremental monitoring with change detection | MVP | connectors, source-run ledger, worker | M | A configured run suppresses unchanged observations and creates evidence-linked events for changed names, logos, publishers, URLs, or descriptions. |
| EXT-002 | Cross-source candidate identity resolution | MVP | candidate model, canonical URLs/IDs | M | The same candidate from two sources resolves to one candidate while preserving both provenance records; ambiguous matches remain separate. |
| EXT-003 | Locale-aware normalization and transliteration | Near-term | detector, configured locales | M | Raw text is preserved while locale, script, transliteration method, and normalization version are recorded for each comparison. |
| EXT-004 | Permitted web/domain and landing-page exposure monitoring | Later | source permissions, SSRF controls, retention policy | L | Only declared, permitted metadata and bounded page evidence are collected; blocked or unsupported sources remain visibly unavailable. |
| EXT-005 | Calibrated queue ranking from analyst outcomes | Near-term | dispositions, labelled feedback, Replay Lab | M | A ranking version is evaluated for precision, false positives, abstentions, and sample limitations before activation. |

## 2. Analyst workflow and team productivity

| ID | Capability | Stage | Dependencies | Effort | Acceptance criterion |
|---|---|---|---|---:|---|
| EXT-006 | Saved queues, ownership, SLAs, and aging | MVP | cases, roles | M | Analysts can save filters, assign cases, set due dates, and see overdue work by source, severity, and age. |
| EXT-007 | Case-specific triage playbooks | MVP | case types, evidence ledger, permissions | M | Social, app, and domain cases show required review steps; closure requires rationale and a next action. |
| EXT-008 | Collaboration, mentions, watchers, and handoff | Near-term | cases, notifications, audit events | S | Comments, mentions, ownership transfers, and watchers appear in an immutable case timeline. |
| EXT-009 | Guarded bulk review actions | Near-term | queue, idempotency, audit log | M | Bulk assignment/tagging/recheck supports preview and per-record audit; bulk external submission is unavailable. |
| EXT-010 | Structured feedback and disagreement review | Near-term | decisions, evaluation runs | M | Analysts label false positive, miss, insufficient evidence, or source error; labels do not silently change thresholds. |

## 3. Customer trust, evidence, and governance

| ID | Capability | Stage | Dependencies | Effort | Acceptance criterion |
|---|---|---|---|---:|---|
| EXT-011 | Customer coverage scorecard and recurring report | MVP | manifests, source health, scheduled runs | M | The report separates successful, failed, stale, unsupported, and not-evaluated coverage and recommends next checks. |
| EXT-012 | Verification workflow for official identity assertions | Near-term | registry, owner/reviewer roles | M | Email, DNS, provider-record, or manual proof can verify an asset; verification expires, revokes, and audits cleanly. |
| EXT-013 | Secure external evidence room | MVP | private storage, RBAC, exports | M | Authorized reviewers receive a time-limited, revocable, tenant-scoped evidence link with provenance and access logging. |
| EXT-014 | Retention policies, deletion proof, and legal hold | MVP | evidence classes, object storage, worker | M | Retention rules delete eligible content, preserve legal holds, and produce an auditable deletion result without retaining deleted content. |
| EXT-015 | Tamper-evident evidence export | Near-term | hashes, export service, key management | M | An export manifest verifies file and metadata integrity and identifies modification or missing evidence. |

## 4. Operational reliability and cost control

| ID | Capability | Stage | Dependencies | Effort | Acceptance criterion |
|---|---|---|---|---:|---|
| EXT-016 | Connector scheduler, bounded retry, pause, and backfill | MVP | manifests, worker, idempotency | M | Operators can pause, bounded-retry, and backfill a defined window without duplicate candidates or cases. |
| EXT-017 | Connector schema-drift and data-quality gates | MVP | contract tests, source runs | M | Missing or type-changed fields quarantine affected observations, identify parser version, and alert an owner. |
| EXT-018 | Per-tenant usage, quota, and cost controls | MVP | usage events, tenant model | M | Usage is counted by tenant, source, operation, and evidence volume; warnings occur before provider overage. |
| EXT-019 | Operational incident console and runbooks | Near-term | telemetry, source health, ownership | M | A connector outage creates an owned incident with severity, first/last failure, runbook, and resolution timestamps. |
| EXT-020 | Versioned configuration promotion | Later | environment separation, approvals, rollback | M | Connector, policy, and detector versions promote from test to pilot with approval and rollback evidence. |

## 5. Integrations and ecosystem fit

| ID | Capability | Stage | Dependencies | Effort | Acceptance criterion |
|---|---|---|---|---:|---|
| EXT-021 | Ticketing integration, starting with one system | MVP | cases, scoped credentials, evidence links | M | One Jira or ServiceNow case is created idempotently with a safe evidence link; status and ownership sync without duplicates. |
| EXT-022 | Slack or Microsoft Teams notifications | Near-term | queues, roles, notification policy | S | Users receive configurable alerts for high-priority findings, outages, and overdue cases without sensitive evidence in message text. |
| EXT-023 | Signed webhooks and SIEM event stream | Near-term | event schema, signing keys, retry queue | M | Case, source-health, and outcome events use documented schemas, signatures, replay protection, and delivery status. |
| EXT-024 | Scoped customer API and lightweight SDK | Later | stable contracts, API keys, rate limits | L | Scoped clients can list candidates, read evidence metadata, create cases, and request rechecks with idempotent mutations. |
| EXT-025 | SSO and SCIM provisioning | Later | RBAC, tenant isolation, audit | L | A supported identity provider can authenticate, provision, and immediately deprovision workspace members with logged role changes. |

## 6. Commercialization and service delivery

| ID | Capability | Stage | Dependencies | Effort | Acceptance criterion |
|---|---|---|---|---:|---|
| EXT-026 | Plan limits and usage metering | MVP | tenant model, usage ledger, billing rules | M | Configurable limits cover brands, observations, evidence, users, and connectors; usage is reproducible from events. |
| EXT-027 | Guided onboarding and self-serve trial | Near-term | registry, connector setup, coverage report | M | A new customer reaches a complete baseline and first review queue while missing permissions are explicit blockers. |
| EXT-028 | Outcome and ROI reporting | MVP | outcomes, time fields, exports | M | Reports show review volume, duplicate reduction, time-to-disposition, report outcomes, coverage, and unresolved uncertainty without fabricated savings. |
| EXT-029 | Managed analyst workspace | Later | external roles, evidence room, playbooks, billing | L | A managed review team sees only assigned queues; customer approval remains required for consequential decisions and outbound actions. |
| EXT-030 | Partner/reseller delegated workspaces | Later | tenancy, SSO/SCIM, metering, audit | XL | Partners administer only assigned workspaces and cannot cross tenant or customer boundaries; usage attribution is correct. |

## Recommended cut line

### First paid design-partner pilot

Build the following after the PS vertical slice is stable:

- **Detection:** `EXT-001`, `EXT-002`
- **Workflow:** `EXT-006`, `EXT-007`
- **Trust:** `EXT-011`, `EXT-013`, `EXT-014`
- **Operations:** `EXT-016`, `EXT-017`, `EXT-018`
- **Integration:** `EXT-021`
- **Commercial:** `EXT-026`, `EXT-028`

This creates a credible operating loop:

`scheduled observation → deduplicated candidate → assigned triage → evidence sharing → coverage transparency → ticket handoff → measured outcome`

The pilot should support one or two permitted sources well, not claim broad platform coverage.

### Near-term after pilot evidence

Prioritize `EXT-003`, `EXT-005`, `EXT-008`, `EXT-009`, `EXT-010`, `EXT-012`, `EXT-015`, `EXT-019`, `EXT-022`, `EXT-023`, and `EXT-027` only when customer interviews, queue analytics, false-positive labels, or source incidents justify them.

### Later

Defer `EXT-004`, `EXT-020`, `EXT-024`, `EXT-025`, `EXT-029`, and `EXT-030` until source contracts, evidence governance, stable case workflow, and paying demand are proven.

## Expansion risks and non-goals

1. Source terms, quotas, ranking semantics, and retention rights can change; every adapter needs a capability manifest and an unavailable state.
2. Similarity, copied branding, and publisher mismatch remain evidence for review, not proof of criminality, intent, ownership, or legal infringement.
3. More channels can overwhelm a lean team; new ranking and automation must be measured against analyst time and false positives.
4. Screenshots, profile data, and app imagery require purpose limitation, retention controls, access logging, and source-specific rights review.
5. Early outcome data will be sparse and biased; do not publish accuracy, savings, or removal-rate claims without a frozen method and denominator.
6. Ticketing, SIEM, SSO, and partner workflows can consume more effort than detection; start with one integration per category.
7. Managed review may help close early customers but can create a labor-heavy services business; measure software leverage and gross margin.

This catalog does **not** authorize unrestricted crawling, access-control bypass, autonomous takedowns, mass reporting, public accusations, malware execution, APK reverse engineering, deepfake attribution, deanonymization, dark-web ingestion, universal coverage claims, custom ML training without labelled data, a graph database, or multi-agent orchestration.
