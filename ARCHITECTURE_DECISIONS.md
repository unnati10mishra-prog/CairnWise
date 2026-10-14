# Cairnwise Architecture Decision Records

## ADR-001 — Modular monolith first

**Decision:** Use one deployable application with clear modules for registry, connectors, detector, evidence, cases, reports, and workers.

**Alternatives:** microservices; serverless functions per detector; agent orchestration.

**Reason:** The challenge risk is incomplete workflow and unverifiable behavior, not service-scale throughput. A monolith is easier to debug, deploy, and test end to end. Extract a connector only if its rate limits, runtime, or security boundary requires isolation.

**Revisit when:** source workload, team ownership, or tenant isolation needs demonstrably require a split.

## ADR-002 — Relational database for truth-bearing records

**Decision:** PostgreSQL for tenants, identities, assets, observations, assessments, cases, actions, and events.

**Alternatives:** document-only JSON; graph database; spreadsheet.

**Reason:** foreign keys, unique stable identifiers, audit history, tenant scope, and case joins are central. A graph can be a later read model, not the source of truth.

## ADR-003 — Evidence ledger separates fact from inference

**Decision:** Store raw observation reference, normalized features, detector output, counterevidence, reviewer decision, and external outcome as separate linked records.

**Alternatives:** one mutable candidate JSON object; generated PDF as the record.

**Reason:** mutable blobs destroy provenance and make evaluator verification difficult. A PDF is a presentation artifact, not authoritative state.

## ADR-004 — Deterministic baseline before ML

**Decision:** Start with explicit normalization, string metrics, URL features, stable identifiers, perceptual hashes, and policy rules.

**Alternatives:** fine-tuned classifier; multimodal LLM; ensemble of agents.

**Reason:** no labelled corpus exists; deterministic signals are explainable and sufficient for PS requirements. Add models only after a held-out dataset and measured incremental value.

## ADR-005 — Source capability manifests

**Decision:** Every connector declares fields, operations, authorization basis, limits, freshness, and failure states.

**Reason:** external platforms differ materially. A capability manifest prevents the product from implying universal monitoring and makes graceful degradation a first-class feature.

## ADR-006 — Synthetic and independent evaluation are separate

**Decision:** Synthetic mutations measure robustness; held-out/independent labelled data supports performance claims.

**Reason:** synthetic cases are useful but do not represent real-world prevalence or attacker behavior. Combining them would inflate confidence.

## ADR-007 — Human approval for consequential action

**Decision:** report/takedown drafts may be automated; submission and public status changes require an authorized reviewer.

**Reason:** platform policy, legal status, and legitimate exceptions require context. Outcome is independently rechecked.

## ADR-008 — Metadata-first evidence retention

**Decision:** store source URLs, metadata, hashes, and normalized fields by default; retain screenshots/icons only under configured rights/retention.

**Reason:** public availability does not automatically grant reuse rights. This reduces privacy/copyright exposure while preserving inspectability.
