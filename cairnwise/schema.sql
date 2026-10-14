PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS brands (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    canonical_name TEXT NOT NULL,
    website TEXT,
    locale TEXT NOT NULL DEFAULT 'en-IN',
    regions_json TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    UNIQUE (workspace_id, canonical_name)
);

CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    asset_type TEXT NOT NULL CHECK (asset_type IN ('logo', 'social_profile', 'mobile_app')),
    platform TEXT,
    store TEXT,
    canonical_url TEXT,
    stable_external_id TEXT,
    display_name TEXT,
    publisher TEXT,
    package_id TEXT,
    description TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    authorization_state TEXT NOT NULL DEFAULT 'self_declared',
    scope TEXT,
    created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS assets_external_identity
    ON assets (platform, store, stable_external_id)
    WHERE stable_external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS asset_versions (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    raw_json TEXT NOT NULL,
    normalized_json TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    verified_by TEXT,
    verification_source TEXT,
    valid_from TEXT NOT NULL,
    valid_to TEXT,
    UNIQUE (asset_id, version_number)
);

CREATE TABLE IF NOT EXISTS auth_relations (
    id TEXT PRIMARY KEY,
    brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    asset_id TEXT REFERENCES assets(id) ON DELETE CASCADE,
    candidate_id TEXT,
    relation_type TEXT NOT NULL,
    scope TEXT,
    expires_at TEXT,
    reviewer TEXT,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL,
    CHECK (asset_id IS NOT NULL OR candidate_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS connectors (
    id TEXT PRIMARY KEY,
    connector_key TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    manifest_json TEXT NOT NULL,
    rights_json TEXT NOT NULL DEFAULT '{}',
    permissions TEXT,
    terms_basis TEXT,
    retention_class TEXT NOT NULL DEFAULT 'metadata_180d',
    image_rights TEXT,
    owner TEXT,
    enabled INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS source_runs (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    connector_id TEXT NOT NULL REFERENCES connectors(id),
    operation TEXT NOT NULL,
    source_mode TEXT NOT NULL,
    idempotency_key TEXT,
    status TEXT NOT NULL,
    availability_state TEXT NOT NULL DEFAULT 'available',
    started_at TEXT NOT NULL,
    ended_at TEXT,
    response_meta_json TEXT NOT NULL DEFAULT '{}',
    record_count INTEGER NOT NULL DEFAULT 0,
    error_code TEXT,
    error_message TEXT,
    source_rights_json TEXT NOT NULL DEFAULT '{}',
    result_json TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS source_runs_idempotency
    ON source_runs (brand_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS candidates (
    id TEXT PRIMARY KEY,
    brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    asset_type TEXT NOT NULL CHECK (asset_type IN ('social_profile', 'mobile_app')),
    source_identity TEXT NOT NULL,
    canonical_locator TEXT NOT NULL,
    dedupe_key TEXT NOT NULL,
    review_state TEXT NOT NULL DEFAULT 'new',
    first_seen TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    UNIQUE (brand_id, dedupe_key)
);

CREATE TABLE IF NOT EXISTS observations (
    id TEXT PRIMARY KEY,
    candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    source_run_id TEXT NOT NULL REFERENCES source_runs(id) ON DELETE CASCADE,
    observed_at TEXT NOT NULL,
    collected_at TEXT NOT NULL,
    source_mode TEXT NOT NULL,
    availability_state TEXT NOT NULL,
    source_locator TEXT,
    raw_json TEXT NOT NULL,
    normalized_json TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    retention_class TEXT NOT NULL DEFAULT 'metadata_180d',
    retention_expires_at TEXT,
    legal_hold INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT,
    deletion_proof_id TEXT
);

CREATE TABLE IF NOT EXISTS assessments (
    id TEXT PRIMARY KEY,
    candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    observation_id TEXT NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
    detector_name TEXT NOT NULL,
    detector_version TEXT NOT NULL,
    identity_resemblance REAL NOT NULL,
    authorization_state TEXT NOT NULL,
    authorization_conflict REAL NOT NULL,
    potential_harm_level TEXT NOT NULL,
    observed_harm REAL NOT NULL,
    evidence_quality REAL NOT NULL,
    exposure_or_recency REAL NOT NULL,
    queue_priority REAL NOT NULL,
    decision_state TEXT NOT NULL,
    reasons_json TEXT NOT NULL DEFAULT '[]',
    counterevidence_json TEXT NOT NULL DEFAULT '[]',
    missing_json TEXT NOT NULL DEFAULT '[]',
    assessment_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence (
    id TEXT PRIMARY KEY,
    observation_id TEXT NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
    assessment_id TEXT REFERENCES assessments(id) ON DELETE CASCADE,
    evidence_type TEXT NOT NULL,
    source_locator TEXT,
    excerpt TEXT NOT NULL,
    retention_state TEXT NOT NULL DEFAULT 'active',
    integrity_hash TEXT NOT NULL,
    retention_class TEXT NOT NULL DEFAULT 'metadata_180d',
    retention_expires_at TEXT,
    legal_hold INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT,
    deletion_proof_id TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cases (
    id TEXT PRIMARY KEY,
    brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    assessment_id TEXT NOT NULL REFERENCES assessments(id),
    owner TEXT,
    priority REAL NOT NULL,
    disposition TEXT NOT NULL DEFAULT 'open',
    opened_at TEXT NOT NULL,
    closed_at TEXT,
    closure_basis TEXT
);

CREATE TABLE IF NOT EXISTS case_events (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    before_json TEXT,
    after_json TEXT,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL,
    request_id TEXT
);

CREATE TABLE IF NOT EXISTS report_drafts (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'draft',
    content_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS observations_candidate_time
    ON observations (candidate_id, collected_at DESC);

CREATE INDEX IF NOT EXISTS assessments_candidate_time
    ON assessments (candidate_id, created_at DESC);

CREATE INDEX IF NOT EXISTS case_events_case_time
    ON case_events (case_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    actor TEXT NOT NULL,
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details_json TEXT NOT NULL DEFAULT '{}',
    request_id TEXT,
    created_at TEXT NOT NULL,
    retention_class TEXT NOT NULL DEFAULT 'audit_365d'
);

CREATE INDEX IF NOT EXISTS audit_events_workspace_time
    ON audit_events (workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS deletion_proofs (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    actor TEXT NOT NULL,
    object_type TEXT NOT NULL,
    requested_at TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    deleted_count INTEGER NOT NULL DEFAULT 0,
    held_count INTEGER NOT NULL DEFAULT 0,
    record_ids_hash TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    status TEXT NOT NULL,
    details_json TEXT NOT NULL DEFAULT '{}',
    retention_class TEXT NOT NULL DEFAULT 'audit_365d'
);

CREATE INDEX IF NOT EXISTS deletion_proofs_workspace_time
    ON deletion_proofs (workspace_id, completed_at DESC);
