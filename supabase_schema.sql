-- ==============================================================================
-- CAIRNWISE SUPABASE / POSTGRESQL CLEAN SCHEMA & MIGRATION (v1.1.0 Production)
-- ==============================================================================
-- Paste this entire file into your Supabase SQL Editor and click RUN.
-- This script safely drops any partial/stale tables and recreates the entire
-- Cairnwise truth-boundary data model with all columns, indexes, and RLS policies.
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Drop existing tables in reverse dependency order (cleans up any stale tables)
DROP TABLE IF EXISTS public.deletion_proofs CASCADE;
DROP TABLE IF EXISTS public.audit_events CASCADE;
DROP TABLE IF EXISTS public.report_drafts CASCADE;
DROP TABLE IF EXISTS public.case_events CASCADE;
DROP TABLE IF EXISTS public.cases CASCADE;
DROP TABLE IF EXISTS public.evidence CASCADE;
DROP TABLE IF EXISTS public.assessments CASCADE;
DROP TABLE IF EXISTS public.observations CASCADE;
DROP TABLE IF EXISTS public.candidates CASCADE;
DROP TABLE IF EXISTS public.source_runs CASCADE;
DROP TABLE IF EXISTS public.connectors CASCADE;
DROP TABLE IF EXISTS public.auth_relations CASCADE;
DROP TABLE IF EXISTS public.asset_versions CASCADE;
DROP TABLE IF EXISTS public.assets CASCADE;
DROP TABLE IF EXISTS public.brands CASCADE;
DROP TABLE IF EXISTS public.workspaces CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 3. User Profiles (Mirrors Supabase Auth Users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'analyst',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Workspaces (Tenant isolation unit)
CREATE TABLE public.workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Brands (Official registered brand identities)
CREATE TABLE public.brands (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    canonical_name TEXT NOT NULL,
    website TEXT,
    locale TEXT NOT NULL DEFAULT 'en-IN',
    regions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (workspace_id, canonical_name)
);

-- 6. Assets (Official registered baselines: logos, handles, bundle IDs)
CREATE TABLE public.assets (
    id TEXT PRIMARY KEY,
    brand_id TEXT NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    asset_type TEXT NOT NULL CHECK (asset_type IN ('logo', 'social_profile', 'mobile_app')),
    platform TEXT,
    store TEXT,
    canonical_url TEXT,
    stable_external_id TEXT,
    display_name TEXT,
    publisher TEXT,
    package_id TEXT,
    description TEXT,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    authorization_state TEXT NOT NULL DEFAULT 'self_declared',
    scope TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS assets_external_identity
    ON public.assets (platform, store, stable_external_id)
    WHERE stable_external_id IS NOT NULL;

-- 7. Asset Versions (Audit trail of official asset changes)
CREATE TABLE public.asset_versions (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    raw_json JSONB NOT NULL,
    normalized_json JSONB NOT NULL,
    content_hash TEXT NOT NULL,
    verified_by TEXT,
    verification_source TEXT,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_to TIMESTAMPTZ,
    UNIQUE (asset_id, version_number)
);

-- 8. Authorization Relations & Scopes
CREATE TABLE public.auth_relations (
    id TEXT PRIMARY KEY,
    brand_id TEXT NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    asset_id TEXT REFERENCES public.assets(id) ON DELETE CASCADE,
    candidate_id TEXT,
    relation_type TEXT NOT NULL,
    scope TEXT,
    expires_at TIMESTAMPTZ,
    reviewer TEXT,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CHECK (asset_id IS NOT NULL OR candidate_id IS NOT NULL)
);

-- 9. Connectors (Coverage contracts)
CREATE TABLE public.connectors (
    id TEXT PRIMARY KEY,
    connector_key TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    manifest_json JSONB NOT NULL,
    rights_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    permissions TEXT,
    terms_basis TEXT,
    retention_class TEXT NOT NULL DEFAULT 'metadata_180d',
    image_rights TEXT,
    owner TEXT,
    enabled INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. Source Runs (Permitted execution logs)
CREATE TABLE public.source_runs (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    brand_id TEXT NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    connector_id TEXT NOT NULL REFERENCES public.connectors(id),
    operation TEXT NOT NULL,
    source_mode TEXT NOT NULL,
    idempotency_key TEXT,
    status TEXT NOT NULL,
    availability_state TEXT NOT NULL DEFAULT 'available',
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    response_meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    record_count INTEGER NOT NULL DEFAULT 0,
    error_code TEXT,
    error_message TEXT,
    source_rights_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    result_json JSONB
);

CREATE UNIQUE INDEX IF NOT EXISTS source_runs_idempotency
    ON public.source_runs (brand_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- 11. Candidates (Observed external profiles or listings)
CREATE TABLE public.candidates (
    id TEXT PRIMARY KEY,
    brand_id TEXT NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    asset_type TEXT NOT NULL CHECK (asset_type IN ('social_profile', 'mobile_app')),
    source_identity TEXT NOT NULL,
    canonical_locator TEXT NOT NULL,
    dedupe_key TEXT NOT NULL,
    review_state TEXT NOT NULL DEFAULT 'new',
    first_seen TIMESTAMPTZ NOT NULL,
    last_seen TIMESTAMPTZ NOT NULL,
    UNIQUE (brand_id, dedupe_key)
);

-- 12. Observations (Permitted intake records with explicit collected_at and retention)
CREATE TABLE public.observations (
    id TEXT PRIMARY KEY,
    candidate_id TEXT NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    source_run_id TEXT NOT NULL REFERENCES public.source_runs(id) ON DELETE CASCADE,
    observed_at TIMESTAMPTZ NOT NULL,
    collected_at TIMESTAMPTZ NOT NULL,
    source_mode TEXT NOT NULL,
    availability_state TEXT NOT NULL,
    source_locator TEXT,
    raw_json JSONB NOT NULL,
    normalized_json JSONB NOT NULL,
    content_hash TEXT NOT NULL,
    retention_class TEXT NOT NULL DEFAULT 'metadata_180d',
    retention_expires_at TIMESTAMPTZ,
    legal_hold INTEGER NOT NULL DEFAULT 0,
    deleted_at TIMESTAMPTZ,
    deletion_proof_id TEXT
);

CREATE INDEX IF NOT EXISTS observations_candidate_time
    ON public.observations (candidate_id, collected_at DESC);

-- 13. Assessments (4D Detector Scores: Resemblance, Auth, Harm, Evidence Quality)
CREATE TABLE public.assessments (
    id TEXT PRIMARY KEY,
    candidate_id TEXT NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    observation_id TEXT NOT NULL REFERENCES public.observations(id) ON DELETE CASCADE,
    detector_name TEXT NOT NULL,
    detector_version TEXT NOT NULL,
    identity_resemblance DOUBLE PRECISION NOT NULL,
    authorization_state TEXT NOT NULL,
    authorization_conflict DOUBLE PRECISION NOT NULL,
    potential_harm_level TEXT NOT NULL,
    observed_harm DOUBLE PRECISION NOT NULL,
    evidence_quality DOUBLE PRECISION NOT NULL,
    exposure_or_recency DOUBLE PRECISION NOT NULL,
    queue_priority DOUBLE PRECISION NOT NULL,
    decision_state TEXT NOT NULL,
    reasons_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    counterevidence_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    missing_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    assessment_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS assessments_candidate_time
    ON public.assessments (candidate_id, created_at DESC);

-- 14. Evidence Ledger (SHA-256 integrity chained proof records)
CREATE TABLE public.evidence (
    id TEXT PRIMARY KEY,
    observation_id TEXT NOT NULL REFERENCES public.observations(id) ON DELETE CASCADE,
    assessment_id TEXT REFERENCES public.assessments(id) ON DELETE CASCADE,
    evidence_type TEXT NOT NULL,
    source_locator TEXT,
    excerpt TEXT NOT NULL,
    retention_state TEXT NOT NULL DEFAULT 'active',
    integrity_hash TEXT NOT NULL,
    retention_class TEXT NOT NULL DEFAULT 'metadata_180d',
    retention_expires_at TIMESTAMPTZ,
    legal_hold INTEGER NOT NULL DEFAULT 0,
    deleted_at TIMESTAMPTZ,
    deletion_proof_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 15. Cases (Analyst review dossiers)
CREATE TABLE public.cases (
    id TEXT PRIMARY KEY,
    brand_id TEXT NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    candidate_id TEXT NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    assessment_id TEXT NOT NULL REFERENCES public.assessments(id),
    owner TEXT,
    priority DOUBLE PRECISION NOT NULL,
    disposition TEXT NOT NULL DEFAULT 'open',
    opened_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ,
    closure_basis TEXT
);

-- 16. Case Events (Audit trail of analyst review actions)
CREATE TABLE public.case_events (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    before_json JSONB,
    after_json JSONB,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    request_id TEXT
);

CREATE INDEX IF NOT EXISTS case_events_case_time
    ON public.case_events (case_id, created_at DESC);

-- 17. Report Drafts (Evidence-linked platform submission packages)
CREATE TABLE public.report_drafts (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'draft',
    content_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 18. Audit Events (Append-only governance log)
CREATE TABLE public.audit_events (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    actor TEXT NOT NULL,
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    request_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    retention_class TEXT NOT NULL DEFAULT 'audit_365d'
);

CREATE INDEX IF NOT EXISTS audit_events_workspace_time
    ON public.audit_events (workspace_id, created_at DESC);

-- 19. Deletion Proofs (Cryptographic proof of data disposal)
CREATE TABLE public.deletion_proofs (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    actor TEXT NOT NULL,
    object_type TEXT NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL,
    deleted_count INTEGER NOT NULL DEFAULT 0,
    held_count INTEGER NOT NULL DEFAULT 0,
    record_ids_hash TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    status TEXT NOT NULL,
    details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    retention_class TEXT NOT NULL DEFAULT 'audit_365d'
);

CREATE INDEX IF NOT EXISTS deletion_proofs_workspace_time
    ON public.deletion_proofs (workspace_id, completed_at DESC);

-- ==============================================================================
-- 20. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
CREATE POLICY "Users can manage own profile" ON public.profiles
    FOR ALL USING (auth.uid() = id);

DROP POLICY IF EXISTS "Authenticated users view workspaces" ON public.workspaces;
CREATE POLICY "Authenticated users view workspaces" ON public.workspaces
    FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users view brands" ON public.brands;
CREATE POLICY "Authenticated users view brands" ON public.brands
    FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users view assets" ON public.assets;
CREATE POLICY "Authenticated users view assets" ON public.assets
    FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users view candidates" ON public.candidates;
CREATE POLICY "Authenticated users view candidates" ON public.candidates
    FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users view observations" ON public.observations;
CREATE POLICY "Authenticated users view observations" ON public.observations
    FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users view assessments" ON public.assessments;
CREATE POLICY "Authenticated users view assessments" ON public.assessments
    FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users view cases" ON public.cases;
CREATE POLICY "Authenticated users view cases" ON public.cases
    FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users view evidence" ON public.evidence;
CREATE POLICY "Authenticated users view evidence" ON public.evidence
    FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users view audit events" ON public.audit_events;
CREATE POLICY "Authenticated users view audit events" ON public.audit_events
    FOR ALL TO authenticated USING (true);

-- ==============================================================================
-- 21. AUTOMATIC PROFILE TRIGGER ON SIGNUP
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        'analyst'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==============================================================================
-- 22. SEED DEFAULT WORKSPACE & NORTHSTAR PAY BRAND
-- ==============================================================================
INSERT INTO public.workspaces (id, name, status)
VALUES ('ws-default', 'Default Security Operations', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.brands (id, workspace_id, name, canonical_name, website, locale, regions_json, status)
VALUES (
    'brand-northstar',
    'ws-default',
    'Northstar Pay',
    'northstar pay',
    'https://northstarpay.com',
    'en-IN',
    '["IN", "APAC", "GLOBAL"]'::jsonb,
    'active'
)
ON CONFLICT (workspace_id, canonical_name) DO NOTHING;

INSERT INTO public.assets (
    id, brand_id, asset_type, platform, store, canonical_url, stable_external_id, display_name, publisher, package_id, description, authorization_state, scope
)
VALUES
(
    'asset-social-001',
    'brand-northstar',
    'social_profile',
    'x',
    NULL,
    'https://x.com/northstarpay',
    'x_uid_44910291',
    'Northstar Pay Official',
    NULL,
    NULL,
    'Official global verified customer handle for Northstar Pay',
    'authorized',
    'global'
),
(
    'asset-app-001',
    'brand-northstar',
    'mobile_app',
    NULL,
    'google_play',
    'https://play.google.com/store/apps/details?id=com.northstar.pay',
    'com.northstar.pay',
    'Northstar Pay: Secure Payments',
    'Northstar Payments Ltd',
    'com.northstar.pay',
    'Official retail payments and bill transfer application',
    'authorized',
    'APAC'
)
ON CONFLICT DO NOTHING;
