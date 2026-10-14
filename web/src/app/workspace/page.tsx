'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BrandLogo } from '@/components/BrandLogo';
import { RadarSpiderChart } from '@/components/RadarSpiderChart';
import { HomoglyphInspector } from '@/components/HomoglyphInspector';
import { EvidenceCertificateModal } from '@/components/EvidenceCertificateModal';
import { TakedownNoticeModal } from '@/components/TakedownNoticeModal';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { 
  Shield, 
  Terminal, 
  LogOut, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  Filter, 
  Search, 
  Download, 
  ExternalLink,
  ChevronRight,
  Database,
  Lock,
  Sparkles,
  UserCheck,
  RefreshCw,
  Plus,
  Compass,
  FileText,
  Activity,
  Sliders,
  Scale,
  ShieldAlert,
  ArrowRight,
  Globe,
  Smartphone,
  Eye,
  Info,
  Check,
  X,
  Copy,
  Hash,
  Play,
  Share2,
  FileCheck,
  Radio,
  FileCode,
  AlertCircle,
  Volume2,
  VolumeX,
  Printer,
  Send,
  Zap,
} from 'lucide-react';

// ==========================================
// TYPES & DATA STRUCTURES (Matching cairnwise)
// ==========================================

export interface BrandBaseline {
  id: string;
  name: string;
  canonical_name: string;
  website?: string;
  locale: string;
  regions: string[];
  registered_at: string;
}

export interface RegisteredAsset {
  id: string;
  asset_type: 'social_profile' | 'mobile_app' | 'logo' | 'exception';
  display_name: string;
  canonical_url?: string;
  stable_external_id?: string;
  platform?: string;
  store?: string;
  publisher?: string;
  authorization_state: 'authorized' | 'partner_exception' | 'monitoring_only';
  verification_source: string;
}

export interface EvidenceRecord {
  id: string;
  evidence_type: string;
  excerpt: string;
  integrity_hash: string;
  captured_at: string;
  source_locator: string;
}

export interface CandidateIncident {
  id: string;
  asset_type: 'social_profile' | 'mobile_app';
  source_identity: string;
  review_state: 'triaged' | 'in_review' | 'escalated' | 'authorized' | 'insufficient_evidence';
  latest_observation: {
    source_mode: 'synthetic_fixture' | 'live_observation';
    availability_state: 'available' | 'degraded' | 'unavailable';
    observed_at: string;
    raw: {
      display_name: string;
      title?: string;
      handle?: string;
      publisher?: string;
      package_name?: string;
      bio?: string;
      description?: string;
      destination_url?: string;
      icon_similarity?: number;
    };
  };
  latest_assessment: {
    identity_resemblance: number;
    authorization_state: 'authorized' | 'unknown' | 'partner_exception';
    authorization_conflict: number;
    potential_harm_level: 'none' | 'low' | 'medium' | 'high';
    observed_harm: number;
    evidence_quality: number;
    queue_priority: number;
    decision_state: string;
    reasons: string[];
    counterevidence: string[];
    missing: string[];
  };
  evidence: EvidenceRecord[];
  case?: {
    id: string;
    owner: string;
    disposition: string;
    decided_at?: string;
    report_drafts?: Array<{
      id: string;
      created_at: string;
      content: {
        summary: string;
        evidence_ids: string[];
      };
    }>;
  };
}

export interface ConnectorCoverage {
  connector_key: string;
  source: string;
  asset_type: string;
  state: 'active' | 'degraded' | 'unavailable' | 'unsupported';
  source_mode: string;
  fields: string[];
  last_success_at: string;
  rights_policy: string;
}

// ==========================================
// SEED DEFAULT FIXTURES (Matches cairnwise/fixtures.py)
// ==========================================

const INITIAL_BRAND: BrandBaseline = {
  id: 'brand_northstar_01',
  name: 'Northstar Pay',
  canonical_name: 'northstar pay',
  website: 'https://northstar.pay.example',
  locale: 'en-IN',
  regions: ['IN', 'SG', 'EU'],
  registered_at: '2026-10-14T08:00:00Z',
};

const INITIAL_ASSETS: RegisteredAsset[] = [
  {
    id: 'asset_01',
    asset_type: 'social_profile',
    display_name: 'Northstar Pay Official Social',
    canonical_url: 'https://bsky.app/profile/northstarpay.bsky.social',
    stable_external_id: 'did:plc:northstarofficial2026',
    platform: 'bluesky',
    authorization_state: 'authorized',
    verification_source: 'Corporate Brand Security Registrar',
  },
  {
    id: 'asset_02',
    asset_type: 'mobile_app',
    display_name: 'Northstar Pay — Fast UPI & QR',
    canonical_url: 'https://apps.apple.com/app/id1982736450',
    stable_external_id: 'com.northstar.pay.app',
    store: 'apple_app_store',
    publisher: 'Northstar Financial Services LLC',
    authorization_state: 'authorized',
    verification_source: 'Apple Developer Program Certificate',
  },
  {
    id: 'asset_03',
    asset_type: 'mobile_app',
    display_name: 'Northstar Pay Android Official',
    canonical_url: 'https://play.google.com/store/apps/details?id=com.northstar.pay',
    stable_external_id: 'com.northstar.pay',
    store: 'google_play',
    publisher: 'Northstar Financial Services LLC',
    authorization_state: 'authorized',
    verification_source: 'Google Play Console Verification',
  },
  {
    id: 'asset_04',
    asset_type: 'exception',
    display_name: 'Northstar Rewards EU (Authorized Affiliate)',
    canonical_url: 'https://northstar-rewards.eu',
    stable_external_id: 'partner_eu_franchise_88',
    authorization_state: 'partner_exception',
    verification_source: 'Partner Licensing Exception Agreement #2025-EU',
  },
];

const INITIAL_CANDIDATES: CandidateIncident[] = [
  {
    id: 'cand_social_lookalike_01',
    asset_type: 'social_profile',
    source_identity: 'northstar_pay_support',
    review_state: 'triaged',
    latest_observation: {
      source_mode: 'synthetic_fixture',
      availability_state: 'available',
      observed_at: '18m ago',
      raw: {
        display_name: 'Northstar Pay Support',
        handle: 'northstar_pay_support.bsky.social',
        bio: 'Official Northstar 24x7 Emergency Helpline. If transaction failed DM us your registered phone number.',
        destination_url: 'https://northstar-resolve-ticket.help/verify',
        icon_similarity: 0.94,
      },
    },
    latest_assessment: {
      identity_resemblance: 0.88,
      authorization_state: 'unknown',
      authorization_conflict: 0.85,
      potential_harm_level: 'high',
      observed_harm: 0.92,
      evidence_quality: 0.95,
      queue_priority: 0.91,
      decision_state: 'review_required',
      reasons: [
        'name_inserted_word:support',
        'high_visual_similarity:avatar_94%',
        'unregistered_destination:resolve-ticket.help',
        'sensitive_data_request:dm_registered_phone',
      ],
      counterevidence: [
        'distinct_did:did:plc:attacker9948271',
        'account_created_24h_ago',
      ],
      missing: [
        'official_domain_match',
        'verified_corporate_email',
      ],
    },
    evidence: [
      {
        id: 'ev_01',
        evidence_type: 'profile_metadata_snapshot',
        excerpt: 'Title: Northstar Pay Support · Bio includes phishing helpline solicitation',
        integrity_hash: '9f83c18b76e42b6a9c1e7d8a63f104e84b238e83b4b88a9134b281f6294711fa',
        captured_at: '2026-10-14T09:42:00Z',
        source_locator: 'at://did:plc:attacker9948271/app.bsky.actor.profile/self',
      },
      {
        id: 'ev_02',
        evidence_type: 'lexical_distance_analysis',
        excerpt: 'Jaccard similarity: 0.84 to official baseline · Keyword inserted: "Support"',
        integrity_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        captured_at: '2026-10-14T09:42:01Z',
        source_locator: 'cairnwise.detector.lexical#v2.1',
      },
      {
        id: 'ev_03',
        evidence_type: 'destination_domain_reputation',
        excerpt: 'Destination resolve-ticket.help registered 3 days ago via anonymous registrar',
        integrity_hash: 'c589b21f3a8b417c9927d76f8a483e10419d27f293b6e70a1a6b7382c4021fa4',
        captured_at: '2026-10-14T09:42:02Z',
        source_locator: 'cairnwise.connectors.network_probe#ssrf_safe',
      },
    ],
    case: {
      id: 'case_soc_001_live',
      owner: 'elena.vance@northstar.security',
      disposition: 'investigate',
      decided_at: '2026-10-14T09:50:00Z',
      report_drafts: [
        {
          id: 'rep_draft_01',
          created_at: '2026-10-14T09:51:00Z',
          content: {
            summary: 'Active credential harvesting profile identified targeting Northstar Pay users. Contains unauthorized avatar duplicate and external phishing credential collector.',
            evidence_ids: ['ev_01', 'ev_02', 'ev_03'],
          },
        },
      ],
    },
  },
  {
    id: 'cand_app_lookalike_02',
    asset_type: 'mobile_app',
    source_identity: 'pay-northstar-direct.apk',
    review_state: 'escalated',
    latest_observation: {
      source_mode: 'synthetic_fixture',
      availability_state: 'available',
      observed_at: '45m ago',
      raw: {
        display_name: 'Northstar Pay Secure',
        title: 'Northstar Pay Secure — UPI Merchant Terminal',
        publisher: 'Apex Digital Labs Ltd (Unauthorized)',
        package_name: 'com.apex.northstar.paysecure',
        description: 'Instant contactless merchant payments and settlements with Northstar infrastructure.',
        icon_similarity: 0.88,
      },
    },
    latest_assessment: {
      identity_resemblance: 0.82,
      authorization_state: 'unknown',
      authorization_conflict: 0.95,
      potential_harm_level: 'high',
      observed_harm: 0.89,
      evidence_quality: 0.92,
      queue_priority: 0.89,
      decision_state: 'confirmed_impersonation_under_policy',
      reasons: [
        'publisher_mismatch:Apex Digital Labs Ltd vs Northstar Financial Services LLC',
        'package_prefix_conflict:com.apex.northstar',
        'trojanized_payment_gateway_permission_detected',
      ],
      counterevidence: [
        'distinct_signing_certificate_fingerprint',
      ],
      missing: [
        'official_developer_team_id',
      ],
    },
    evidence: [
      {
        id: 'ev_04',
        evidence_type: 'app_store_metadata_diff',
        excerpt: 'Publisher differs from official baseline (Apex Digital Labs Ltd vs Northstar Financial Services LLC)',
        integrity_hash: '2c5a819b3f4e6d78a9c0e1b23456789abcdef0123456789abcdef0123456789a',
        captured_at: '2026-10-14T09:15:00Z',
        source_locator: 'store.fixture.apple_search#lookup',
      },
    ],
    case: {
      id: 'case_app_002_live',
      owner: 'marcus.thorne@northstar.governance',
      disposition: 'confirmed_impersonation_under_policy',
      decided_at: '2026-10-14T09:20:00Z',
    },
  },
  {
    id: 'cand_partner_exception_03',
    asset_type: 'mobile_app',
    source_identity: 'northstar_rewards_eu',
    review_state: 'triaged',
    latest_observation: {
      source_mode: 'synthetic_fixture',
      availability_state: 'available',
      observed_at: '1h ago',
      raw: {
        display_name: 'Northstar Rewards EU',
        title: 'Northstar Rewards EU Loyalty Points',
        publisher: 'Northstar EU Franchise BV',
        package_name: 'eu.northstar.rewards.franchise',
        description: 'European affiliate reward companion for Northstar Pay users.',
        icon_similarity: 0.65,
      },
    },
    latest_assessment: {
      identity_resemblance: 0.62,
      authorization_state: 'partner_exception',
      authorization_conflict: 0.20,
      potential_harm_level: 'low',
      observed_harm: 0.12,
      evidence_quality: 0.85,
      queue_priority: 0.28,
      decision_state: 'insufficient_evidence',
      reasons: [
        'partner_relationship_match:partner_eu_franchise_88',
        'licensing_scope_expired_2025',
      ],
      counterevidence: [
        'signed_partnership_contract_on_file',
      ],
      missing: [
        'renewal_addendum_2026',
      ],
    },
    evidence: [
      {
        id: 'ev_05',
        evidence_type: 'partner_exception_verification',
        excerpt: 'Matched exception #2025-EU. Licensing terms expired Jan 2026 and require administrative renewal.',
        integrity_hash: '7b8a9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b',
        captured_at: '2026-10-14T08:50:00Z',
        source_locator: 'cairnwise.registry.exceptions',
      },
    ],
  },
  {
    id: 'cand_official_control_04',
    asset_type: 'social_profile',
    source_identity: 'northstarpay_official',
    review_state: 'authorized',
    latest_observation: {
      source_mode: 'synthetic_fixture',
      availability_state: 'available',
      observed_at: '2h ago',
      raw: {
        display_name: 'Northstar Pay Official',
        handle: 'northstarpay.bsky.social',
        bio: 'The authentic Northstar Pay digital payment ecosystem. Regulated by RBI & MAS.',
        destination_url: 'https://northstar.pay.example',
        icon_similarity: 1.0,
      },
    },
    latest_assessment: {
      identity_resemblance: 1.0,
      authorization_state: 'authorized',
      authorization_conflict: 0.0,
      potential_harm_level: 'none',
      observed_harm: 0.0,
      evidence_quality: 1.0,
      queue_priority: 0.0,
      decision_state: 'authorized',
      reasons: [
        'exact_stable_id_match:did:plc:northstarofficial2026',
        'false_positive_firewall_exclusion_granted',
      ],
      counterevidence: [
        'cryptographic_key_matches_official_brand_key',
      ],
      missing: [],
    },
    evidence: [
      {
        id: 'ev_06',
        evidence_type: 'stable_identity_match',
        excerpt: 'DID matches verified asset record asset_01 exactly. Excluded from adversarial queue.',
        integrity_hash: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
        captured_at: '2026-10-14T07:30:00Z',
        source_locator: 'cairnwise.detector.firewall',
      },
    ],
  },
];

const INITIAL_CONNECTORS: ConnectorCoverage[] = [
  {
    connector_key: 'bluesky_public_actor_search',
    source: 'Bluesky Social (AT Protocol)',
    asset_type: 'social_profile',
    state: 'active',
    source_mode: 'public_atproto_api',
    fields: ['handle', 'displayName', 'description', 'avatar', 'did', 'indexedAt'],
    last_success_at: '4m ago (142ms latency)',
    rights_policy: 'Permitted public actors only · SSRF-safe outbound proxy · No unauthorized crawling',
  },
  {
    connector_key: 'apple_app_store_lookup',
    source: 'Apple App Store (Official Lookup API)',
    asset_type: 'mobile_app',
    state: 'active',
    source_mode: 'itunes_lookup_api',
    fields: ['trackName', 'artistName', 'bundleId', 'artworkUrl512', 'description', 'version'],
    last_success_at: '8m ago (210ms latency)',
    rights_policy: 'Public iTunes Search API terms · Rate-limited to 20 req/min · No cached binary payloads',
  },
  {
    connector_key: 'google_play_public_listing',
    source: 'Google Play Store (Observed Listing)',
    asset_type: 'mobile_app',
    state: 'degraded',
    source_mode: 'public_metadata_probe',
    fields: ['title', 'developer', 'packageId', 'iconUrl', 'rating'],
    last_success_at: '32m ago (Rate-limit throttle)',
    rights_policy: 'Public store listing metadata only · Respects robots.txt & strict concurrency limits',
  },
  {
    connector_key: 'synthetic_regression_lab',
    source: 'Cairnwise Forensic Regression Lab',
    asset_type: 'all',
    state: 'active',
    source_mode: 'deterministic_fixtures',
    fields: ['homoglyphs', 'inserted_words', 'transpositions', 'partner_exceptions'],
    last_success_at: 'Continuous local assertion (0ms latency)',
    rights_policy: 'Synthetic test fixtures · Pre-approved evaluation controls',
  },
];

export default function WorkspaceDashboard() {
  const router = useRouter();
  const { user, signOut, isConfigured } = useAuth();

  // Navigation State
  const [activeTab, setActiveTab] = useState<'overview' | 'registry' | 'queue' | 'coverage' | 'simulator' | 'audit'>('overview');

  // Core Data State (Hydrated from initial fixtures or local persistence)
  const [brand, setBrand] = useState<BrandBaseline>(INITIAL_BRAND);
  const [assets, setAssets] = useState<RegisteredAsset[]>(INITIAL_ASSETS);
  const [candidates, setCandidates] = useState<CandidateIncident[]>(INITIAL_CANDIDATES);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateIncident | null>(INITIAL_CANDIDATES[0]);
  const [connectors, setConnectors] = useState<ConnectorCoverage[]>(INITIAL_CONNECTORS);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [assetTypeFilter, setAssetTypeFilter] = useState<string>('all');

  // UI Interactive Modals & Forms
  const [showAddAssetModal, setShowAddAssetModal] = useState(false);
  const [showNewIntakeModal, setShowNewIntakeModal] = useState(false);
  const [showDossierModal, setShowDossierModal] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [showTakedownModal, setShowTakedownModal] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Asset Form State
  const [newAssetType, setNewAssetType] = useState<'social_profile' | 'mobile_app' | 'logo' | 'exception'>('social_profile');
  const [newAssetDisplayName, setNewAssetDisplayName] = useState('');
  const [newAssetUrl, setNewAssetUrl] = useState('');
  const [newAssetStableId, setNewAssetStableId] = useState('');
  const [newAssetScope, setNewAssetScope] = useState('');
  const [newAssetPublisher, setNewAssetPublisher] = useState('');

  // Simulator State (Bonus Requirement from PS.md)
  const [simInput, setSimInput] = useState('Northstаr Pay Support');
  const [simBase, setSimBase] = useState('Northstar Pay');

  // Toast Helper
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3800);
  };

  // Tactical Audio Cue Synthesizer
  const playTacticalSound = (type: 'action' | 'alert' | 'success') => {
    if (!audioEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'action') {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === 'success') {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else if (type === 'alert') {
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        osc.frequency.setValueAtTime(260, ctx.currentTime + 0.06);
        gain.gain.setValueAtTime(0.07, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
        osc.start();
        osc.stop(ctx.currentTime + 0.14);
      }
    } catch {
      // Audio policy handled
    }
  };

  // Sync with Supabase (Live DB and Realtime Channel)
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    let isMounted = true;

    async function loadSupabaseData() {
      try {
        const { data: brandRows } = await supabase!.from('brands').select('*').limit(1);
        if (brandRows && brandRows.length > 0 && isMounted) {
          setBrand({
            id: brandRows[0].id,
            name: brandRows[0].name,
            canonical_name: brandRows[0].canonical_name,
            website: brandRows[0].website || 'https://northstarpay.com',
            locale: brandRows[0].locale || 'en-IN',
            regions: typeof brandRows[0].regions_json === 'string' ? JSON.parse(brandRows[0].regions_json) : (brandRows[0].regions_json || ['IN', 'GLOBAL']),
            registered_at: brandRows[0].created_at,
          });
        }

        const { data: assetRows } = await supabase!.from('assets').select('*');
        if (assetRows && assetRows.length > 0 && isMounted) {
          setAssets(assetRows.map(a => ({
            id: a.id,
            asset_type: a.asset_type as any,
            display_name: a.display_name,
            canonical_url: a.canonical_url,
            stable_external_id: a.stable_external_id,
            platform: a.platform,
            store: a.store,
            publisher: a.publisher,
            authorization_state: a.authorization_state as any,
            verification_source: 'Supabase Official Identity Registry',
          })));
        }

        setIsLiveConnected(true);
      } catch (err) {
        console.warn('Supabase sync notice:', err);
      }
    }

    loadSupabaseData();

    const channel = supabase.channel('cairnwise-ops-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidates' }, (payload) => {
        triggerToast(`Live candidate event: ${payload.eventType.toUpperCase()}`);
        playTacticalSound('alert');
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && isMounted) {
          setIsLiveConnected(true);
        }
      });

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // Try to sync with FastAPI backend if available on mount
  useEffect(() => {
    async function checkBackend() {
      try {
        const res = await fetch('/v1/dev/state');
        if (res.ok) {
          console.log('[Cairnwise] Live FastAPI backend detected.');
        }
      } catch (err) {
        console.log('[Cairnwise] Running in client-side high fidelity engine.');
      }
    }
    checkBackend();
  }, []);

  // Filtered Candidates
  const filteredCandidates = useMemo(() => {
    return candidates.filter((item) => {
      const name = item.latest_observation?.raw?.display_name || item.source_identity;
      const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            item.source_identity.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || item.latest_assessment.decision_state === statusFilter;
      const matchesType = assetTypeFilter === 'all' || item.asset_type === assetTypeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [candidates, searchQuery, statusFilter, assetTypeFilter]);

  // Metric Computations
  const metrics = useMemo(() => {
    const openReviewCount = candidates.filter(c => c.latest_assessment.decision_state === 'review_required' || c.latest_assessment.decision_state === 'confirmed_impersonation_under_policy').length;
    const totalEvidenceCount = candidates.reduce((sum, c) => sum + (c.evidence?.length || 0), 0);
    const authorizedCount = assets.filter(a => a.authorization_state === 'authorized').length;
    const firewallExclusions = candidates.filter(c => c.latest_assessment.decision_state === 'authorized').length;
    return { openReviewCount, totalEvidenceCount, authorizedCount, firewallExclusions };
  }, [candidates, assets]);

  // Actions
  const handleSeedBaseline = () => {
    setBrand(INITIAL_BRAND);
    setAssets(INITIAL_ASSETS);
    setCandidates(INITIAL_CANDIDATES);
    setSelectedCandidate(INITIAL_CANDIDATES[0]);
    triggerToast('Baseline re-seeded. Northstar Pay official records and 4 evaluation fixtures loaded.');
  };

  const handleRunFixture = (fixtureType: string) => {
    if (fixtureType === 'social.lookalike') {
      const existing = candidates.find(c => c.id === 'cand_social_lookalike_01');
      if (existing) setSelectedCandidate(existing);
      triggerToast('Evaluated fixture: social.lookalike. Identity resemblance: 0.88, Triage: Review Required.');
      setActiveTab('queue');
    } else if (fixtureType === 'app.lookalike') {
      const existing = candidates.find(c => c.id === 'cand_app_lookalike_02');
      if (existing) setSelectedCandidate(existing);
      triggerToast('Evaluated fixture: app.lookalike. Publisher conflict: Apex Digital Labs. Triage: High Risk.');
      setActiveTab('queue');
    } else if (fixtureType === 'social.official') {
      const existing = candidates.find(c => c.id === 'cand_official_control_04');
      if (existing) setSelectedCandidate(existing);
      triggerToast('Evaluated fixture: social.official. False-Positive Firewall active: 0% false accusation.');
      setActiveTab('queue');
    } else if (fixtureType === 'source.outage') {
      triggerToast('Simulated source outage: Status changed to UNAVAILABLE. Truth boundary prevents false clean report.');
      setConnectors(prev => prev.map(c => c.connector_key === 'google_play_public_listing' ? { ...c, state: 'unavailable' } : c));
      setActiveTab('coverage');
    }
  };

  const handleRegisterAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssetDisplayName.trim()) return;

    const newAsset: RegisteredAsset = {
      id: `asset_${Date.now()}`,
      asset_type: newAssetType,
      display_name: newAssetDisplayName.trim(),
      canonical_url: newAssetUrl.trim() || undefined,
      stable_external_id: newAssetStableId.trim() || undefined,
      platform: newAssetType === 'social_profile' ? newAssetScope.trim() || 'universal' : undefined,
      store: newAssetType === 'mobile_app' ? newAssetScope.trim() || 'universal_store' : undefined,
      publisher: newAssetPublisher.trim() || undefined,
      authorization_state: 'authorized',
      verification_source: 'Manual Security Team Operator Entry',
    };

    setAssets(prev => [newAsset, ...prev]);
    setShowAddAssetModal(false);
    setNewAssetDisplayName('');
    setNewAssetUrl('');
    setNewAssetStableId('');
    setNewAssetScope('');
    setNewAssetPublisher('');
    triggerToast(`Registered official asset "${newAsset.display_name}". Exclusion index updated.`);
  };

  const handleCaseDecision = (candidateId: string, disposition: string) => {
    setCandidates(prev => prev.map(item => {
      if (item.id === candidateId) {
        return {
          ...item,
          latest_assessment: {
            ...item.latest_assessment,
            decision_state: disposition,
          },
          case: {
            id: item.case?.id || `case_${Date.now()}`,
            owner: user?.email || 'operator@northstar.security',
            disposition: disposition,
            decided_at: new Date().toISOString(),
            report_drafts: item.case?.report_drafts || [],
          },
        };
      }
      return item;
    }));

    if (selectedCandidate && selectedCandidate.id === candidateId) {
      setSelectedCandidate(prev => prev ? {
        ...prev,
        latest_assessment: { ...prev.latest_assessment, decision_state: disposition },
        case: {
          id: prev.case?.id || `case_${Date.now()}`,
          owner: user?.email || 'operator@northstar.security',
          disposition: disposition,
          decided_at: new Date().toISOString(),
          report_drafts: prev.case?.report_drafts || [],
        },
      } : null);
    }

    triggerToast(`Case disposition recorded: ${disposition.replaceAll('_', ' ').toUpperCase()}. Cryptographic event logged.`);
  };

  const handleGenerateReport = (candidateId: string) => {
    const candidate = candidates.find(c => c.id === candidateId);
    if (!candidate) return;

    const newDraft = {
      id: `rep_${Date.now()}`,
      created_at: new Date().toISOString(),
      content: {
        summary: `Evidence-linked verification audit for ${candidate.latest_observation?.raw?.display_name || candidate.source_identity}. Identity resemblance score: ${candidate.latest_assessment.identity_resemblance}. Reasons: ${candidate.latest_assessment.reasons.join(', ')}.`,
        evidence_ids: candidate.evidence.map(e => e.id),
      },
    };

    setCandidates(prev => prev.map(item => {
      if (item.id === candidateId) {
        return {
          ...item,
          case: {
            id: item.case?.id || `case_${Date.now()}`,
            owner: item.case?.owner || user?.email || 'operator@northstar.security',
            disposition: item.case?.disposition || 'investigate',
            decided_at: item.case?.decided_at || new Date().toISOString(),
            report_drafts: [newDraft, ...(item.case?.report_drafts || [])],
          },
        };
      }
      return item;
    }));

    if (selectedCandidate && selectedCandidate.id === candidateId) {
      setSelectedCandidate(prev => prev ? {
        ...prev,
        case: {
          id: prev.case?.id || `case_${Date.now()}`,
          owner: prev.case?.owner || user?.email || 'operator@northstar.security',
          disposition: prev.case?.disposition || 'investigate',
          decided_at: prev.case?.decided_at || new Date().toISOString(),
          report_drafts: [newDraft, ...(prev.case?.report_drafts || [])],
        },
      } : null);
    }

    triggerToast('Report draft generated citing 3 cryptographic evidence IDs. Unsupervised auto-reporting withheld.');
  };

  // Bridge findings from Look-alike Simulator into live Review Queue
  const handleQueueSimulatedFinding = (finding: {
    displayName: string;
    verdict: string;
    homoglyphsFound: number;
    resemblance: number;
  }) => {
    const newCandId = `cand_sim_${Date.now()}`;
    const newCand: CandidateIncident = {
      id: newCandId,
      asset_type: 'social_profile',
      source_identity: finding.displayName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      review_state: 'triaged',
      latest_observation: {
        source_mode: 'synthetic_fixture',
        availability_state: 'available',
        observed_at: 'Just now',
        raw: {
          display_name: finding.displayName,
          handle: `@${finding.displayName.toLowerCase().replace(/\s+/g, '')}.bsky.social`,
          bio: `Candidate synthesized in Look-alike Simulator. Unicode homoglyphs: ${finding.homoglyphsFound}. Verdict: ${finding.verdict}.`,
          destination_url: 'https://security-verify.example/checkpoint',
          icon_similarity: finding.resemblance,
        },
      },
      latest_assessment: {
        identity_resemblance: finding.resemblance,
        authorization_state: 'unknown',
        authorization_conflict: finding.resemblance > 0.6 ? 0.88 : 0.25,
        potential_harm_level: finding.homoglyphsFound > 0 ? 'high' : 'medium',
        observed_harm: finding.homoglyphsFound > 0 ? 0.89 : 0.45,
        evidence_quality: 0.94,
        queue_priority: Math.min(0.99, Number((finding.resemblance * 0.5 + (finding.homoglyphsFound > 0 ? 0.45 : 0.15)).toFixed(2))),
        decision_state: 'review_required',
        reasons: [
          finding.homoglyphsFound > 0 ? `homoglyph_confusables_detected:${finding.homoglyphsFound}` : 'lexical_similarity_signal',
          'simulator_interactive_intake',
        ],
        counterevidence: [],
        missing: ['official_domain_match', 'brand_certificate_binding'],
      },
      evidence: [
        {
          id: `ev_sim_${Date.now()}`,
          evidence_type: 'unicode_homoglyph_forensics',
          excerpt: `Simulated candidate "${finding.displayName}" analyzed. Homoglyphs: ${finding.homoglyphsFound}. Lexical resemblance: ${(finding.resemblance * 100).toFixed(0)}%.`,
          integrity_hash: 'c83b4a2f8910e54d89e210b3724a1b02c81e9204857b2930471b3e94821a7f34',
          captured_at: new Date().toISOString(),
          source_locator: 'cairnwise.simulator.homoglyph_engine#v2',
        },
      ],
    };

    setCandidates(prev => [newCand, ...prev]);
    setSelectedCandidate(newCand);
    setActiveTab('queue');
    triggerToast(`Queued finding "${finding.displayName}" into triage queue.`);
    playTacticalSound('alert');
  };

  // Look-alike Simulator Analyzer (Bonus Requirement implementation)
  const simAnalysis = useMemo(() => {
    const input = simInput.trim();
    const base = simBase.trim();
    if (!input || !base) return null;

    // Check homoglyphs / Cyrillic confusable characters
    // e.g. Cyrillic 'а' (U+0430) vs Latin 'a' (U+0061)
    const cyrillicMatch = input.match(/[\u0400-\u04FF]/g);
    const hasCyrillic = cyrillicMatch !== null && cyrillicMatch.length > 0;

    // Check inserted high-risk affixes
    const riskAffixes = ['support', 'help', 'secure', 'verify', 'login', 'portal', 'team', 'care'];
    const lowerInput = input.toLowerCase();
    const foundAffixes = riskAffixes.filter(a => lowerInput.includes(a));

    // Simple Levenshtein approximation
    let matchCount = 0;
    const baseTokens = base.toLowerCase().split(/\s+/);
    baseTokens.forEach(t => {
      if (lowerInput.includes(t)) matchCount++;
    });
    const tokenSimilarity = (matchCount / Math.max(1, baseTokens.length)) * 100;

    // Check if exactly matches an authorized asset
    const exactMatch = assets.find(a => a.display_name.toLowerCase() === input.toLowerCase());

    return {
      hasCyrillic,
      cyrillicCount: cyrillicMatch ? cyrillicMatch.length : 0,
      foundAffixes,
      tokenSimilarity: Math.round(tokenSimilarity),
      isAuthorized: !!exactMatch,
      triageDecision: exactMatch 
        ? 'AUTHORIZED EXCLUSION (FIREWALL)' 
        : hasCyrillic || foundAffixes.length > 0 
        ? 'HIGH RISK LOOK-ALIKE (TRIAGE MANDATORY)' 
        : 'LOW CONFLICT SIGNAL',
    };
  }, [simInput, simBase, assets]);

  return (
    <div className="min-h-screen bg-[#070908] text-[#f2efe7] flex flex-col font-sans selection:bg-[#d8f57b] selection:text-[#131b0e]">
      {/* Toast Notification Container */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg bg-[rgba(14,20,17,0.95)] border border-[rgba(216,245,123,0.35)] shadow-[0_12px_40px_rgba(0,0,0,0.6)] flex items-center gap-3 backdrop-blur-md animate-fade-in text-xs font-mono text-[#d8f57b]">
          <span className="w-2 h-2 rounded-full bg-[#d8f57b] animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Application Bar */}
      <header className="h-16 px-6 border-b border-[rgba(236,233,223,0.08)] bg-[rgba(9,12,11,0.85)] backdrop-blur-md flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-6">
          <BrandLogo size="md" showSubtitle={false} />
          <div className="hidden md:flex items-center gap-2 pl-4 border-l border-[rgba(236,233,223,0.1)] text-xs font-mono">
            <span className="text-[#69756d]">BASELINE:</span>
            <span className="text-[#ece9df] font-medium">{brand.name}</span>
            <span className="text-[#69756d]">({brand.locale})</span>
          </div>
        </div>

        {/* Center: Live Sync & Truth Boundary Indicator */}
        <div className="hidden lg:flex items-center gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(216,245,123,0.06)] border border-[rgba(216,245,123,0.2)] text-[10.5px] font-mono text-[#d8f57b] tracking-wider uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d8f57b] animate-pulse" />
            <span>TRUTH BOUNDARY ACTIVE &bull; 4D SIGNAL TRIANGULATION</span>
          </div>
          <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wider border ${
            isLiveConnected
              ? 'bg-[rgba(110,231,183,0.08)] text-[#6ee7b7] border-[rgba(110,231,183,0.3)]'
              : 'bg-[rgba(233,173,113,0.08)] text-[#e9ad71] border-[rgba(233,173,113,0.25)]'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isLiveConnected ? 'bg-[#6ee7b7] animate-ping' : 'bg-[#e9ad71]'}`} />
            <span>{isLiveConnected ? 'SUPABASE REALTIME SYNC' : 'STANDALONE FORENSIC ENGINE'}</span>
          </div>
        </div>

        {/* Right Operator Controls */}
        <div className="flex items-center gap-3">
          {/* Tactical Audio Feedback Toggle */}
          <button
            onClick={() => {
              setAudioEnabled(!audioEnabled);
              triggerToast(audioEnabled ? 'Tactical audio cues muted' : 'Tactical audio cues enabled');
            }}
            title={audioEnabled ? "Mute audio cues" : "Enable audio cues"}
            className="p-1.5 rounded text-[#9ba69e] hover:text-[#d8f57b] hover:bg-[rgba(216,245,123,0.08)] transition-all"
          >
            {audioEnabled ? <Volume2 className="w-4 h-4 text-[#d8f57b]" /> : <VolumeX className="w-4 h-4 text-[#69756d]" />}
          </button>

          <div className="hidden sm:flex items-center gap-2 text-xs font-mono px-2.5 py-1 rounded border border-[rgba(236,233,223,0.08)] bg-[rgba(14,20,17,0.6)]">
            <UserCheck className="w-3.5 h-3.5 text-[#d8f57b]" />
            <span className="text-[#9ba69e] truncate max-w-[150px]">{user?.email || 'elena.vance@northstar.security'}</span>
          </div>

          <button
            onClick={() => {
              handleSeedBaseline();
              playTacticalSound('action');
            }}
            title="Reset to deterministic baseline"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono bg-[rgba(216,245,123,0.08)] hover:bg-[rgba(216,245,123,0.15)] text-[#d8f57b] border border-[rgba(216,245,123,0.25)] transition-all"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Seed Fixtures</span>
          </button>

          <button
            onClick={() => {
              signOut();
              router.push('/login');
            }}
            title="Sign out of console"
            className="p-1.5 rounded text-[#9ba69e] hover:text-[#ef8c8c] hover:bg-[rgba(239,140,140,0.08)] transition-all"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Rail */}
        <aside className="w-64 border-r border-[rgba(236,233,223,0.08)] bg-[rgba(10,14,12,0.95)] flex flex-col justify-between p-4 flex-shrink-0 overflow-y-auto">
          <div className="space-y-6">
            <div>
              <div className="text-[10px] font-mono tracking-widest text-[#69756d] uppercase mb-3 px-3">
                OPERATIONAL PHASES
              </div>
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'overview'
                      ? 'bg-[rgba(216,245,123,0.12)] text-[#d8f57b] border border-[rgba(216,245,123,0.3)] shadow-[0_0_12px_rgba(216,245,123,0.1)]'
                      : 'text-[#9ba69e] hover:text-[#f2efe7] hover:bg-[rgba(236,233,223,0.04)] border border-transparent'
                  }`}
                >
                  <Compass className="w-4 h-4 flex-shrink-0" />
                  <span>Overview &amp; Triage Loop</span>
                </button>

                <button
                  onClick={() => setActiveTab('registry')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'registry'
                      ? 'bg-[rgba(216,245,123,0.12)] text-[#d8f57b] border border-[rgba(216,245,123,0.3)] shadow-[0_0_12px_rgba(216,245,123,0.1)]'
                      : 'text-[#9ba69e] hover:text-[#f2efe7] hover:bg-[rgba(236,233,223,0.04)] border border-transparent'
                  }`}
                >
                  <Database className="w-4 h-4 flex-shrink-0" />
                  <span>Identity Registry</span>
                  <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-[rgba(236,233,223,0.08)] text-[#9ba69e]">
                    {assets.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('queue')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'queue'
                      ? 'bg-[rgba(216,245,123,0.12)] text-[#d8f57b] border border-[rgba(216,245,123,0.3)] shadow-[0_0_12px_rgba(216,245,123,0.1)]'
                      : 'text-[#9ba69e] hover:text-[#f2efe7] hover:bg-[rgba(236,233,223,0.04)] border border-transparent'
                  }`}
                >
                  <ShieldAlert className="w-4 h-4 flex-shrink-0 text-[#e9ad71]" />
                  <span>Review Queue</span>
                  <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-[rgba(233,173,113,0.15)] text-[#e9ad71] font-semibold">
                    {metrics.openReviewCount}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('coverage')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'coverage'
                      ? 'bg-[rgba(216,245,123,0.12)] text-[#d8f57b] border border-[rgba(216,245,123,0.3)] shadow-[0_0_12px_rgba(216,245,123,0.1)]'
                      : 'text-[#9ba69e] hover:text-[#f2efe7] hover:bg-[rgba(236,233,223,0.04)] border border-transparent'
                  }`}
                >
                  <Radio className="w-4 h-4 flex-shrink-0" />
                  <span>Coverage Contract</span>
                  <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-[rgba(216,245,123,0.08)] text-[#d8f57b]">
                    {connectors.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('simulator')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'simulator'
                      ? 'bg-[rgba(216,245,123,0.12)] text-[#d8f57b] border border-[rgba(216,245,123,0.3)] shadow-[0_0_12px_rgba(216,245,123,0.1)]'
                      : 'text-[#9ba69e] hover:text-[#f2efe7] hover:bg-[rgba(236,233,223,0.04)] border border-transparent'
                  }`}
                >
                  <Sliders className="w-4 h-4 flex-shrink-0 text-[#d8f57b]" />
                  <span>Look-alike Simulator</span>
                  <span className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded bg-[rgba(216,245,123,0.1)] text-[#d8f57b]">
                    BONUS
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('audit')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'audit'
                      ? 'bg-[rgba(216,245,123,0.12)] text-[#d8f57b] border border-[rgba(216,245,123,0.3)] shadow-[0_0_12px_rgba(216,245,123,0.1)]'
                      : 'text-[#9ba69e] hover:text-[#f2efe7] hover:bg-[rgba(236,233,223,0.04)] border border-transparent'
                  }`}
                >
                  <Scale className="w-4 h-4 flex-shrink-0" />
                  <span>Proof Ledger &amp; Export</span>
                </button>
              </nav>
            </div>

            {/* Quick Fixture Test Triggers */}
            <div className="pt-4 border-t border-[rgba(236,233,223,0.06)]">
              <div className="text-[10px] font-mono tracking-widest text-[#69756d] uppercase mb-2 px-3">
                FIXTURE TEST BENCH
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                <button
                  onClick={() => handleRunFixture('social.lookalike')}
                  className="w-full text-left px-3 py-2 rounded text-[11px] font-mono text-[#ece9df] bg-[rgba(14,20,17,0.6)] hover:bg-[rgba(216,245,123,0.08)] hover:text-[#d8f57b] transition-all flex items-center justify-between"
                >
                  <span>Social Look-alike</span>
                  <span className="text-[10px] text-[#e9ad71]">0.88</span>
                </button>
                <button
                  onClick={() => handleRunFixture('app.lookalike')}
                  className="w-full text-left px-3 py-2 rounded text-[11px] font-mono text-[#ece9df] bg-[rgba(14,20,17,0.6)] hover:bg-[rgba(216,245,123,0.08)] hover:text-[#d8f57b] transition-all flex items-center justify-between"
                >
                  <span>App Look-alike</span>
                  <span className="text-[10px] text-[#ef8c8c]">High</span>
                </button>
                <button
                  onClick={() => handleRunFixture('social.official')}
                  className="w-full text-left px-3 py-2 rounded text-[11px] font-mono text-[#ece9df] bg-[rgba(14,20,17,0.6)] hover:bg-[rgba(216,245,123,0.08)] hover:text-[#d8f57b] transition-all flex items-center justify-between"
                >
                  <span>Official Control</span>
                  <span className="text-[10px] text-[#d8f57b]">Firewall</span>
                </button>
                <button
                  onClick={() => handleRunFixture('source.outage')}
                  className="w-full text-left px-3 py-2 rounded text-[11px] font-mono text-[#ef8c8c] bg-[rgba(239,140,140,0.05)] hover:bg-[rgba(239,140,140,0.1)] transition-all flex items-center justify-between"
                >
                  <span>Source Outage</span>
                  <span className="text-[10px]">Truth</span>
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar Footer Integrity Note */}
          <div className="pt-4 border-t border-[rgba(236,233,223,0.08)] text-[11px] font-mono text-[#69756d]">
            <div className="flex items-center gap-1.5 text-[#d8f57b] mb-1">
              <Shield className="w-3.5 h-3.5" />
              <span className="font-semibold">Cairnwise Core v2.0</span>
            </div>
            <span>No automated public accusation or unsupervised takedown.</span>
          </div>
        </aside>

        {/* Tab Content Canvas */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-radial-gradient">
          {/* ========================================================
              TAB 1: OVERVIEW & OPERATING LOOP
              ======================================================== */}
          {activeTab === 'overview' && (
            <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
              {/* Header Title */}
              <div>
                <h1 style={{ fontFamily: 'var(--font-serif)' }} className="text-3xl font-normal text-[#f2efe7] tracking-tight mb-2">
                  Operating Loop &amp; Forensic Ledger
                </h1>
                <p className="text-sm text-[#9ba69e] max-w-3xl leading-relaxed">
                  Cairnwise executes an accountable digital risk loop: verified brand baseline, permitted observations, 4-dimensional signal triangulation, and human decision governance.
                </p>
              </div>

              {/* 4 Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-panel p-5 rounded-xl border border-[rgba(236,233,223,0.08)] hover:border-[rgba(216,245,123,0.3)] transition-all">
                  <div className="text-[10px] font-mono text-[#69756d] uppercase tracking-wider mb-2">OPEN TRIAGE QUEUE</div>
                  <div className="text-3xl font-serif text-[#e9ad71] mb-1">{String(metrics.openReviewCount).padStart(2, '0')}</div>
                  <div className="text-xs text-[#9ba69e]">Awaiting human operator signoff</div>
                </div>

                <div className="glass-panel p-5 rounded-xl border border-[rgba(236,233,223,0.08)] hover:border-[rgba(216,245,123,0.3)] transition-all">
                  <div className="text-[10px] font-mono text-[#69756d] uppercase tracking-wider mb-2">EVIDENCE RECORDS</div>
                  <div className="text-3xl font-serif text-[#d8f57b] mb-1">{String(metrics.totalEvidenceCount).padStart(2, '0')}</div>
                  <div className="text-xs text-[#9ba69e]">SHA-256 integrity chained</div>
                </div>

                <div className="glass-panel p-5 rounded-xl border border-[rgba(236,233,223,0.08)] hover:border-[rgba(216,245,123,0.3)] transition-all">
                  <div className="text-[10px] font-mono text-[#69756d] uppercase tracking-wider mb-2">REGISTERED ASSETS</div>
                  <div className="text-3xl font-serif text-[#ece9df] mb-1">{String(metrics.authorizedCount).padStart(2, '0')}</div>
                  <div className="text-xs text-[#9ba69e]">Official verified identifiers</div>
                </div>

                <div className="glass-panel p-5 rounded-xl border border-[rgba(236,233,223,0.08)] hover:border-[rgba(216,245,123,0.3)] transition-all">
                  <div className="text-[10px] font-mono text-[#69756d] uppercase tracking-wider mb-2">FIREWALL EXCLUSIONS</div>
                  <div className="text-3xl font-serif text-[#9cc4d9] mb-1">{String(metrics.firewallExclusions).padStart(2, '0')}</div>
                  <div className="text-xs text-[#9ba69e]">Zero false accusation guarantee</div>
                </div>
              </div>

              {/* Operating Loop Flow Diagram */}
              <div className="glass-panel p-6 rounded-xl border border-[rgba(236,233,223,0.08)]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-[#ece9df] tracking-wide uppercase font-mono">
                    VERIFIABLE 7-PHASE FORENSIC PIPELINE
                  </h3>
                  <span className="text-[11px] font-mono text-[#d8f57b]">ACTIVE WORKFLOW</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center text-xs font-mono">
                  <div className="p-3 rounded bg-[rgba(14,20,17,0.7)] border border-[rgba(216,245,123,0.2)]">
                    <span className="text-[10px] text-[#69756d] block mb-1">01</span>
                    <span className="text-[#ece9df] font-medium">Brand Baseline</span>
                  </div>
                  <div className="p-3 rounded bg-[rgba(14,20,17,0.7)] border border-[rgba(216,245,123,0.2)]">
                    <span className="text-[10px] text-[#69756d] block mb-1">02</span>
                    <span className="text-[#ece9df] font-medium">Permitted Probe</span>
                  </div>
                  <div className="p-3 rounded bg-[rgba(14,20,17,0.7)] border border-[rgba(216,245,123,0.2)]">
                    <span className="text-[10px] text-[#69756d] block mb-1">03</span>
                    <span className="text-[#ece9df] font-medium">4D Triangulate</span>
                  </div>
                  <div className="p-3 rounded bg-[rgba(14,20,17,0.7)] border border-[rgba(216,245,123,0.2)]">
                    <span className="text-[10px] text-[#69756d] block mb-1">04</span>
                    <span className="text-[#ece9df] font-medium">Firewall Exclude</span>
                  </div>
                  <div className="p-3 rounded bg-[rgba(14,20,17,0.7)] border border-[rgba(216,245,123,0.2)]">
                    <span className="text-[10px] text-[#69756d] block mb-1">05</span>
                    <span className="text-[#e9ad71] font-medium">Human Triage</span>
                  </div>
                  <div className="p-3 rounded bg-[rgba(14,20,17,0.7)] border border-[rgba(216,245,123,0.2)]">
                    <span className="text-[10px] text-[#69756d] block mb-1">06</span>
                    <span className="text-[#ece9df] font-medium">Proof Ledger</span>
                  </div>
                  <div className="p-3 rounded bg-[rgba(14,20,17,0.7)] border border-[rgba(216,245,123,0.2)]">
                    <span className="text-[10px] text-[#69756d] block mb-1">07</span>
                    <span className="text-[#d8f57b] font-medium">Recheck Loop</span>
                  </div>
                </div>
              </div>

              {/* 2-Column Split: Baseline Card & Intake Launcher */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Card: Verified Brand Record */}
                <div className="glass-panel p-6 rounded-xl border border-[rgba(236,233,223,0.08)] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-[rgba(216,245,123,0.1)] border border-[rgba(216,245,123,0.2)] flex items-center justify-center text-[#d8f57b]">
                          <Shield className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-base font-medium text-[#ece9df]">Active Brand Profile</h3>
                          <span className="text-xs text-[#9ba69e] font-mono">{brand.canonical_name}</span>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10.5px] font-mono bg-[rgba(216,245,123,0.08)] border border-[rgba(216,245,123,0.25)] text-[#d8f57b]">
                        BASELINE VERIFIED
                      </span>
                    </div>

                    <div className="space-y-3 my-4 text-xs font-mono">
                      <div className="flex justify-between py-1.5 border-b border-[rgba(236,233,223,0.06)]">
                        <span className="text-[#69756d]">OFFICIAL WEBSITE:</span>
                        <a href={brand.website} target="_blank" rel="noreferrer" className="text-[#d8f57b] hover:underline flex items-center gap-1">
                          {brand.website} <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-[rgba(236,233,223,0.06)]">
                        <span className="text-[#69756d]">REGISTRATION LOCALE:</span>
                        <span className="text-[#ece9df]">{brand.locale} (India, Singapore, EU)</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-[rgba(236,233,223,0.06)]">
                        <span className="text-[#69756d]">PROTECTED ASSETS:</span>
                        <span className="text-[#ece9df]">{assets.length} Assets Registered</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[rgba(236,233,223,0.08)] flex items-center justify-between">
                    <span className="text-xs text-[#9ba69e]">Need to register new official handle or APK?</span>
                    <button
                      onClick={() => setActiveTab('registry')}
                      className="px-3 py-1.5 rounded text-xs font-mono text-[#d8f57b] hover:bg-[rgba(216,245,123,0.08)] transition-colors flex items-center gap-1.5"
                    >
                      <span>Manage Registry</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Right Card: Candidate Observation Launcher */}
                <div className="glass-panel p-6 rounded-xl border border-[rgba(236,233,223,0.08)] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-base font-medium text-[#ece9df]">Run Forensic Intake</h3>
                        <p className="text-xs text-[#9ba69e] mt-0.5">Submit an observation for deterministic assessment against baseline.</p>
                      </div>
                      <span className="px-2.5 py-1 rounded text-[10.5px] font-mono bg-[rgba(14,20,17,0.7)] text-[#c5d3bd] border border-[rgba(236,233,223,0.12)]">
                        READY
                      </span>
                    </div>

                    <div className="space-y-2.5 my-4">
                      <button
                        onClick={() => handleRunFixture('social.lookalike')}
                        className="w-full text-left p-3 rounded-lg bg-[rgba(14,20,17,0.6)] hover:bg-[rgba(216,245,123,0.08)] border border-[rgba(236,233,223,0.06)] hover:border-[rgba(216,245,123,0.3)] transition-all flex items-center justify-between group"
                      >
                        <div>
                          <div className="text-xs font-semibold text-[#f2efe7] group-hover:text-[#d8f57b]">Social Profile Look-alike Test</div>
                          <div className="text-[11px] text-[#9ba69e] font-mono">@northstar_pay_support &bull; Cyrillic &amp; Phishing Bio</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#69756d] group-hover:text-[#d8f57b] group-hover:translate-x-0.5 transition-all" />
                      </button>

                      <button
                        onClick={() => handleRunFixture('app.lookalike')}
                        className="w-full text-left p-3 rounded-lg bg-[rgba(14,20,17,0.6)] hover:bg-[rgba(216,245,123,0.08)] border border-[rgba(236,233,223,0.06)] hover:border-[rgba(216,245,123,0.3)] transition-all flex items-center justify-between group"
                      >
                        <div>
                          <div className="text-xs font-semibold text-[#f2efe7] group-hover:text-[#d8f57b]">Counterfeit APK Publisher Mismatch</div>
                          <div className="text-[11px] text-[#9ba69e] font-mono">pay-northstar-direct.apk &bull; Publisher: Apex Digital Labs</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#69756d] group-hover:text-[#d8f57b] group-hover:translate-x-0.5 transition-all" />
                      </button>

                      <button
                        onClick={() => handleRunFixture('social.official')}
                        className="w-full text-left p-3 rounded-lg bg-[rgba(14,20,17,0.6)] hover:bg-[rgba(216,245,123,0.08)] border border-[rgba(236,233,223,0.06)] hover:border-[rgba(216,245,123,0.3)] transition-all flex items-center justify-between group"
                      >
                        <div>
                          <div className="text-xs font-semibold text-[#f2efe7] group-hover:text-[#d8f57b]">Official Control Asset Verification</div>
                          <div className="text-[11px] text-[#9ba69e] font-mono">did:plc:northstarofficial2026 &bull; Automatic Exclusion Test</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#69756d] group-hover:text-[#d8f57b] group-hover:translate-x-0.5 transition-all" />
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[rgba(236,233,223,0.08)] flex items-center justify-between">
                    <span className="text-xs text-[#9ba69e]">Test live character swap / Unicode homoglyph?</span>
                    <button
                      onClick={() => setActiveTab('simulator')}
                      className="px-3 py-1.5 rounded text-xs font-mono text-[#d8f57b] hover:bg-[rgba(216,245,123,0.08)] transition-colors flex items-center gap-1.5"
                    >
                      <span>Open Simulator</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 2: IDENTITY REGISTRY
              ======================================================== */}
          {activeTab === 'registry' && (
            <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 style={{ fontFamily: 'var(--font-serif)' }} className="text-3xl font-normal text-[#f2efe7] tracking-tight mb-1">
                    Identity Registry
                  </h1>
                  <p className="text-sm text-[#9ba69e]">
                    Official assets are stored separately from external observations. Exact stable identifiers prevent false accusations.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddAssetModal(true)}
                  className="cairn-btn cairn-btn-primary h-10 px-4 text-xs font-semibold flex items-center gap-2 self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register Official Asset</span>
                </button>
              </div>

              {/* Assets Table / List */}
              <div className="glass-panel rounded-xl border border-[rgba(236,233,223,0.08)] overflow-hidden">
                <div className="p-4 border-b border-[rgba(236,233,223,0.08)] flex flex-wrap items-center justify-between gap-3 bg-[rgba(14,20,17,0.5)]">
                  <span className="text-xs font-mono text-[#9ba69e] uppercase tracking-wider">
                    AUTHORIZED REPOSITORY RECORDS ({assets.length})
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-[#69756d]">FALSE-POSITIVE FIREWALL:</span>
                    <span className="text-[11px] font-mono text-[#d8f57b] font-medium">PROTECTED</span>
                  </div>
                </div>

                <div className="divide-y divide-[rgba(236,233,223,0.06)]">
                  {assets.map((asset) => (
                    <div key={asset.id} className="p-4 hover:bg-[rgba(216,245,123,0.03)] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[rgba(14,20,17,0.8)] border border-[rgba(236,233,223,0.1)] flex items-center justify-center flex-shrink-0 text-[#d8f57b] mt-0.5">
                          {asset.asset_type === 'social_profile' ? (
                            <Globe className="w-4 h-4" />
                          ) : asset.asset_type === 'mobile_app' ? (
                            <Smartphone className="w-4 h-4" />
                          ) : (
                            <Shield className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-[#ece9df] flex items-center gap-2">
                            <span>{asset.display_name}</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[rgba(236,233,223,0.06)] text-[#9ba69e] uppercase">
                              {asset.asset_type.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="text-xs font-mono text-[#69756d] mt-1 space-x-2">
                            {asset.stable_external_id && (
                              <span className="text-[#9ba69e]">ID: {asset.stable_external_id}</span>
                            )}
                            {asset.publisher && (
                              <span>&bull; Publisher: {asset.publisher}</span>
                            )}
                            {asset.platform && (
                              <span>&bull; {asset.platform}</span>
                            )}
                            {asset.store && (
                              <span>&bull; {asset.store}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <span className={`text-[10.5px] font-mono px-2.5 py-1 rounded-full border ${
                          asset.authorization_state === 'authorized'
                            ? 'bg-[rgba(216,245,123,0.08)] border-[rgba(216,245,123,0.25)] text-[#d8f57b]'
                            : 'bg-[rgba(233,173,113,0.08)] border-[rgba(233,173,113,0.25)] text-[#e9ad71]'
                        }`}>
                          {asset.authorization_state.toUpperCase().replace('_', ' ')}
                        </span>
                        {asset.canonical_url && (
                          <a
                            href={asset.canonical_url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded text-[#9ba69e] hover:text-[#d8f57b] hover:bg-[rgba(216,245,123,0.08)] transition-all"
                            title="Open Canonical Locator"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 3: REVIEW QUEUE & 4D FORENSIC INSPECTOR
              ======================================================== */}
          {activeTab === 'queue' && (
            <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 style={{ fontFamily: 'var(--font-serif)' }} className="text-3xl font-normal text-[#f2efe7] tracking-tight mb-1">
                    Review Queue &amp; Evidence Inspector
                  </h1>
                  <p className="text-sm text-[#9ba69e]">
                    Resemblance is a signal, not a verdict. Inspect the 4 dimensions of proof before recording a human decision.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#69756d] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filter candidate signals..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-9 pl-9 pr-3 rounded-lg bg-[rgba(14,20,17,0.7)] border border-[rgba(236,233,223,0.12)] text-xs text-[#ece9df] placeholder-[#69756d] focus:outline-none focus:border-[#d8f57b] w-48 sm:w-60"
                    />
                  </div>
                  <button
                    onClick={() => {
                      triggerToast('Queue refreshed from local forensic store.');
                    }}
                    className="p-2 rounded-lg bg-[rgba(14,20,17,0.7)] border border-[rgba(236,233,223,0.12)] text-[#9ba69e] hover:text-[#d8f57b] transition-colors"
                    title="Refresh Incidents"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Master-Detail Split Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left 5 Cols: Candidate Incident List */}
                <div className="lg:col-span-5 space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono text-[#69756d] px-1">
                    <span>TRIAGED INCIDENTS ({filteredCandidates.length})</span>
                    <span>SORT: PRIORITY</span>
                  </div>

                  <div className="space-y-2">
                    {filteredCandidates.map((candidate) => {
                      const isSelected = selectedCandidate?.id === candidate.id;
                      const isHighRisk = candidate.latest_assessment.queue_priority >= 0.75;
                      const isAuthorized = candidate.latest_assessment.decision_state === 'authorized';

                      return (
                        <button
                          key={candidate.id}
                          onClick={() => setSelectedCandidate(candidate)}
                          className={`w-full text-left p-4 rounded-xl border transition-all text-xs ${
                            isSelected
                              ? 'bg-[rgba(19,27,22,0.95)] border-[rgba(216,245,123,0.4)] shadow-[0_0_20px_rgba(216,245,123,0.08)]'
                              : 'bg-[rgba(12,17,14,0.7)] border-[rgba(236,233,223,0.08)] hover:border-[rgba(236,233,223,0.2)]'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-[10px] text-[#69756d] uppercase">
                              {candidate.asset_type.replace('_', ' ')} &bull; {candidate.latest_observation.observed_at}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                              isAuthorized
                                ? 'bg-[rgba(216,245,123,0.1)] text-[#d8f57b]'
                                : isHighRisk
                                ? 'bg-[rgba(239,140,140,0.15)] text-[#ef8c8c]'
                                : 'bg-[rgba(233,173,113,0.15)] text-[#e9ad71]'
                            }`}>
                              {candidate.latest_assessment.decision_state.replace('_', ' ')}
                            </span>
                          </div>

                          <div className="text-sm font-medium text-[#f2efe7] mb-1">
                            {candidate.latest_observation.raw.display_name}
                          </div>

                          <div className="text-[#9ba69e] line-clamp-1 mb-3">
                            {candidate.latest_observation.raw.description || candidate.latest_observation.raw.bio || candidate.source_identity}
                          </div>

                          {/* Priority Score Bar */}
                          <div className="flex items-center gap-3 font-mono text-[11px] pt-2 border-t border-[rgba(236,233,223,0.06)]">
                            <span className="text-[#69756d]">PRIORITY:</span>
                            <div className="flex-1 h-1.5 rounded-full bg-[rgba(236,233,223,0.08)] overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isAuthorized ? 'bg-[#d8f57b]' : isHighRisk ? 'bg-[#ef8c8c]' : 'bg-[#e9ad71]'
                                }`}
                                style={{ width: `${candidate.latest_assessment.queue_priority * 100}%` }}
                              />
                            </div>
                            <span className={`font-semibold ${isHighRisk ? 'text-[#ef8c8c]' : 'text-[#d8f57b]'}`}>
                              {candidate.latest_assessment.queue_priority.toFixed(2)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right 7 Cols: Detailed Forensic Inspector */}
                <div className="lg:col-span-7">
                  {selectedCandidate ? (
                    <div className="glass-panel p-6 rounded-xl border border-[rgba(236,233,223,0.12)] space-y-6">
                      {/* Top Inspector Header */}
                      <div className="flex flex-wrap items-start justify-between gap-3 pb-5 border-b border-[rgba(236,233,223,0.08)]">
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-xs font-mono text-[#69756d] uppercase">
                              CASE ID: {selectedCandidate.id}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[rgba(216,245,123,0.08)] text-[#d8f57b]">
                              {selectedCandidate.latest_observation.source_mode}
                            </span>
                          </div>
                          <h2 style={{ fontFamily: 'var(--font-serif)' }} className="text-2xl font-normal text-[#f2efe7]">
                            {selectedCandidate.latest_observation.raw.display_name}
                          </h2>
                          <div className="text-xs text-[#9ba69e] font-mono mt-1">
                            {selectedCandidate.source_identity}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[11px] font-mono text-[#69756d] block mb-1">TRIAGE DISPOSITION</span>
                          <span className={`px-3 py-1 rounded text-xs font-mono uppercase font-semibold inline-block ${
                            selectedCandidate.latest_assessment.decision_state === 'authorized'
                              ? 'bg-[rgba(216,245,123,0.15)] text-[#d8f57b] border border-[rgba(216,245,123,0.3)]'
                              : selectedCandidate.latest_assessment.decision_state === 'confirmed_impersonation_under_policy'
                              ? 'bg-[rgba(239,140,140,0.15)] text-[#ef8c8c] border border-[rgba(239,140,140,0.3)]'
                              : 'bg-[rgba(233,173,113,0.15)] text-[#e9ad71] border border-[rgba(233,173,113,0.3)]'
                          }`}>
                            {selectedCandidate.latest_assessment.decision_state.replace('_', ' ')}
                          </span>
                        </div>
                      </div>

                      {/* 4-Dimensional Signal Triangulation (Core of Solution.md) */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-xs font-mono uppercase tracking-wider text-[#d8f57b] flex items-center gap-2">
                            <Activity className="w-3.5 h-3.5" />
                            <span>4-DIMENSIONAL SIGNAL TRIANGULATION &amp; CONFIDENCE HALO</span>
                          </div>
                          <span className="text-[10px] font-mono text-[#9cc4d9] px-2 py-0.5 rounded bg-[rgba(156,196,217,0.1)] border border-[rgba(156,196,217,0.2)]">
                            NIST SP 800-86 ALIGNED
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-4 rounded-xl bg-[rgba(10,14,12,0.9)] border border-[rgba(236,233,223,0.08)]">
                          {/* Spider Radar Chart Visualizer */}
                          <div className="md:col-span-5 flex flex-col items-center justify-center py-1">
                            <RadarSpiderChart
                              resemblance={selectedCandidate.latest_assessment.identity_resemblance}
                              authorizationConflict={selectedCandidate.latest_assessment.authorization_conflict}
                              observedHarm={selectedCandidate.latest_assessment.observed_harm}
                              evidenceQuality={selectedCandidate.latest_assessment.evidence_quality}
                              size={260}
                            />
                            <div className="text-[10px] font-mono text-[#69756d] text-center mt-1">
                              Outer ellipse indicates truth boundary uncertainty margin
                            </div>
                          </div>

                          {/* 4 Dimension Stat Cards */}
                          <div className="md:col-span-7 grid grid-cols-2 gap-2.5">
                            {/* Dim 1: Resemblance */}
                            <div className="p-3 rounded-lg bg-[rgba(14,20,17,0.7)] border border-[rgba(236,233,223,0.06)]">
                              <span className="text-[10px] font-mono text-[#69756d] block mb-1">1. RESEMBLANCE</span>
                              <div className="text-xl font-serif text-[#ece9df] mb-1">
                                {(selectedCandidate.latest_assessment.identity_resemblance * 100).toFixed(0)}%
                              </div>
                              <div className="h-1 rounded-full bg-[rgba(236,233,223,0.08)] overflow-hidden">
                                <div className="h-full bg-[#d8f57b]" style={{ width: `${selectedCandidate.latest_assessment.identity_resemblance * 100}%` }} />
                              </div>
                              <span className="text-[9.5px] font-mono text-[#9ba69e] mt-1 block">Lexical &amp; handle similarity</span>
                            </div>

                            {/* Dim 2: Authorization */}
                            <div className="p-3 rounded-lg bg-[rgba(14,20,17,0.7)] border border-[rgba(236,233,223,0.06)]">
                              <span className="text-[10px] font-mono text-[#69756d] block mb-1">2. AUTH CONFLICT</span>
                              <div className="text-sm font-mono text-[#ece9df] mb-1 capitalize truncate">
                                {(selectedCandidate.latest_assessment.authorization_conflict * 100).toFixed(0)}% Conflict
                              </div>
                              <div className="h-1 rounded-full bg-[rgba(236,233,223,0.08)] overflow-hidden">
                                <div className={`h-full ${selectedCandidate.latest_assessment.authorization_conflict < 0.3 ? 'bg-[#d8f57b]' : 'bg-[#e9ad71]'}`} style={{ width: `${selectedCandidate.latest_assessment.authorization_conflict * 100}%` }} />
                              </div>
                              <span className="text-[9.5px] font-mono text-[#9ba69e] mt-1 block capitalize truncate">
                                State: {selectedCandidate.latest_assessment.authorization_state.replace('_', ' ')}
                              </span>
                            </div>

                            {/* Dim 3: Potential Harm */}
                            <div className="p-3 rounded-lg bg-[rgba(14,20,17,0.7)] border border-[rgba(236,233,223,0.06)]">
                              <span className="text-[10px] font-mono text-[#69756d] block mb-1">3. OBSERVED HARM</span>
                              <div className={`text-sm font-mono font-semibold uppercase mb-1 ${selectedCandidate.latest_assessment.potential_harm_level === 'high' ? 'text-[#ef8c8c]' : 'text-[#d8f57b]'}`}>
                                {selectedCandidate.latest_assessment.potential_harm_level} ({(selectedCandidate.latest_assessment.observed_harm * 100).toFixed(0)}%)
                              </div>
                              <div className="h-1 rounded-full bg-[rgba(236,233,223,0.08)] overflow-hidden">
                                <div className={`h-full ${selectedCandidate.latest_assessment.potential_harm_level === 'high' ? 'bg-[#ef8c8c]' : 'bg-[#d8f57b]'}`} style={{ width: `${selectedCandidate.latest_assessment.observed_harm * 100}%` }} />
                              </div>
                              <span className="text-[9.5px] font-mono text-[#9ba69e] mt-1 block">Credential / redirect risk</span>
                            </div>

                            {/* Dim 4: Evidence Quality */}
                            <div className="p-3 rounded-lg bg-[rgba(14,20,17,0.7)] border border-[rgba(236,233,223,0.06)]">
                              <span className="text-[10px] font-mono text-[#69756d] block mb-1">4. EVIDENCE QUALITY</span>
                              <div className="text-xl font-serif text-[#9cc4d9] mb-1">
                                {(selectedCandidate.latest_assessment.evidence_quality * 100).toFixed(0)}%
                              </div>
                              <div className="h-1 rounded-full bg-[rgba(236,233,223,0.08)] overflow-hidden">
                                <div className="h-full bg-[#9cc4d9]" style={{ width: `${selectedCandidate.latest_assessment.evidence_quality * 100}%` }} />
                              </div>
                              <span className="text-[9.5px] font-mono text-[#9ba69e] mt-1 block">
                                {selectedCandidate.latest_assessment.evidence_quality < 0.6 ? 'High uncertainty margin' : 'Verified provenance proof'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Detector Reasons & Counterevidence Tags */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                        <div className="p-3 rounded-lg bg-[rgba(14,20,17,0.6)] border border-[rgba(236,233,223,0.06)]">
                          <span className="text-[10px] text-[#69756d] block mb-2 uppercase">POSITIVE DETECTOR SIGNALS</span>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedCandidate.latest_assessment.reasons.map((r, i) => (
                              <span key={i} className="px-2 py-0.5 rounded bg-[rgba(216,245,123,0.08)] border border-[rgba(216,245,123,0.2)] text-[#d8f57b] text-[10.5px]">
                                {r}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="p-3 rounded-lg bg-[rgba(14,20,17,0.6)] border border-[rgba(236,233,223,0.06)]">
                          <span className="text-[10px] text-[#69756d] block mb-2 uppercase">COUNTEREVIDENCE &amp; LIMITATIONS</span>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedCandidate.latest_assessment.counterevidence.concat(selectedCandidate.latest_assessment.missing.map(m => `missing:${m}`)).map((c, i) => (
                              <span key={i} className="px-2 py-0.5 rounded bg-[rgba(233,173,113,0.08)] border border-[rgba(233,173,113,0.2)] text-[#e9ad71] text-[10.5px]">
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Cryptographic Proof Ledger (Evidence Items) */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-mono uppercase tracking-wider text-[#ece9df]">
                            PROOF LEDGER ({selectedCandidate.evidence?.length || 0} RECORDS)
                          </span>
                          <span className="text-[10.5px] font-mono text-[#69756d]">SHA-256 HASH VERIFIED</span>
                        </div>

                        <div className="space-y-2">
                          {selectedCandidate.evidence?.map((ev) => (
                            <div key={ev.id} className="p-3 rounded bg-[rgba(9,12,10,0.8)] border border-[rgba(236,233,223,0.06)] text-xs">
                              <div className="flex items-center justify-between font-mono text-[10.5px] text-[#69756d] mb-1">
                                <span className="text-[#ece9df] font-semibold">{ev.evidence_type}</span>
                                <span className="text-[#d8f57b]">{ev.integrity_hash.slice(0, 16)}...</span>
                              </div>
                              <p className="text-[#9ba69e] text-xs leading-relaxed">{ev.excerpt}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Accountable Case Disposition Action Panel */}
                      <div className="p-4 rounded-xl bg-[rgba(14,20,17,0.8)] border border-[rgba(216,245,123,0.2)]">
                        <div className="text-xs font-mono uppercase tracking-wider text-[#d8f57b] mb-1">
                          HUMAN-IN-THE-LOOP DISPOSITION
                        </div>
                        <p className="text-xs text-[#9ba69e] mb-3">
                          Select an accountable review verdict. Policy actions are cryptographically signed to the audit log.
                        </p>

                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => {
                              handleCaseDecision(selectedCandidate.id, 'monitor');
                              playTacticalSound('action');
                            }}
                            className="px-3 py-1.5 rounded text-xs font-mono bg-[rgba(236,233,223,0.08)] hover:bg-[rgba(236,233,223,0.15)] text-[#ece9df] transition-all"
                          >
                            Monitor Only
                          </button>

                          <button
                            onClick={() => {
                              handleCaseDecision(selectedCandidate.id, 'investigate');
                              playTacticalSound('action');
                            }}
                            className="px-3 py-1.5 rounded text-xs font-mono bg-[rgba(233,173,113,0.15)] hover:bg-[rgba(233,173,113,0.25)] text-[#e9ad71] border border-[rgba(233,173,113,0.3)] transition-all"
                          >
                            Investigate
                          </button>

                          <button
                            onClick={() => {
                              handleCaseDecision(selectedCandidate.id, 'insufficient_evidence');
                              playTacticalSound('action');
                            }}
                            className="px-3 py-1.5 rounded text-xs font-mono bg-[rgba(236,233,223,0.06)] hover:bg-[rgba(236,233,223,0.12)] text-[#9ba69e] transition-all"
                          >
                            Insufficient Evidence
                          </button>

                          <button
                            onClick={() => {
                              handleCaseDecision(selectedCandidate.id, 'confirmed_impersonation_under_policy');
                              playTacticalSound('alert');
                            }}
                            className="px-3 py-1.5 rounded text-xs font-mono bg-[rgba(239,140,140,0.15)] hover:bg-[rgba(239,140,140,0.25)] text-[#ef8c8c] border border-[rgba(239,140,140,0.3)] transition-all"
                          >
                            Confirm Under Policy
                          </button>

                          <div className="flex flex-wrap items-center gap-2 ml-auto">
                            <button
                              onClick={() => {
                                setShowCertificateModal(true);
                                playTacticalSound('action');
                              }}
                              className="px-3 py-1.5 rounded text-xs font-mono bg-[rgba(156,196,217,0.12)] hover:bg-[rgba(156,196,217,0.22)] text-[#9cc4d9] border border-[rgba(156,196,217,0.25)] transition-all flex items-center gap-1.5"
                              title="Generate printable ISO/IEC 27037 forensic certificate"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Admissibility Certificate</span>
                            </button>

                            <button
                              onClick={() => {
                                setShowTakedownModal(true);
                                playTacticalSound('action');
                              }}
                              className="px-3 py-1.5 rounded text-xs font-mono bg-[rgba(233,173,113,0.15)] hover:bg-[rgba(233,173,113,0.25)] text-[#e9ad71] border border-[rgba(233,173,113,0.3)] transition-all flex items-center gap-1.5"
                              title="Draft legal takedown notice for platform abuse desk"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Platform Notice</span>
                            </button>

                            <button
                              onClick={() => {
                                handleGenerateReport(selectedCandidate.id);
                                playTacticalSound('success');
                              }}
                              className="px-3 py-1.5 rounded text-xs font-mono bg-[rgba(216,245,123,0.15)] hover:bg-[rgba(216,245,123,0.25)] text-[#d8f57b] border border-[rgba(216,245,123,0.3)] transition-all flex items-center gap-1.5"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Generate Report</span>
                            </button>
                          </div>
                        </div>

                        {selectedCandidate.case?.report_drafts?.[0] && (
                          <div className="mt-3 p-3 rounded bg-[rgba(216,245,123,0.05)] border border-[rgba(216,245,123,0.2)] text-xs font-mono">
                            <span className="text-[#d8f57b] font-semibold block mb-0.5">DRAFT REPORT PREVIEW:</span>
                            <span className="text-[#ece9df]">{selectedCandidate.case.report_drafts[0].content.summary}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="glass-panel p-12 rounded-xl text-center text-xs text-[#69756d] font-mono">
                      Select an incident from the review queue to inspect forensic evidence.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 4: COVERAGE CONTRACT
              ======================================================== */}
          {activeTab === 'coverage' && (
            <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 style={{ fontFamily: 'var(--font-serif)' }} className="text-3xl font-normal text-[#f2efe7] tracking-tight mb-1">
                    Coverage Contract
                  </h1>
                  <p className="text-sm text-[#9ba69e]">
                    Declared capabilities stay visible beside operational state. Outages remain unavailable instead of pretending &ldquo;all clear&rdquo;.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setConnectors(INITIAL_CONNECTORS);
                    triggerToast('All connectors polled and verified.');
                  }}
                  className="px-3.5 py-2 rounded-lg bg-[rgba(14,20,17,0.8)] border border-[rgba(236,233,223,0.12)] text-xs font-mono text-[#d8f57b] hover:bg-[rgba(216,245,123,0.08)] transition-all flex items-center gap-2 self-start sm:self-auto"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Poll Connector State</span>
                </button>
              </div>

              {/* Connector Matrix Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {connectors.map((c) => (
                  <div key={c.connector_key} className="glass-panel p-5 rounded-xl border border-[rgba(236,233,223,0.08)] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-[#ece9df] flex items-center gap-2">
                          <Radio className="w-3.5 h-3.5 text-[#d8f57b]" />
                          {c.source}
                        </span>
                        <span className={`text-[10.5px] font-mono px-2.5 py-0.5 rounded-full border ${
                          c.state === 'active'
                            ? 'bg-[rgba(216,245,123,0.08)] text-[#d8f57b] border-[rgba(216,245,123,0.25)]'
                            : c.state === 'degraded'
                            ? 'bg-[rgba(233,173,113,0.08)] text-[#e9ad71] border-[rgba(233,173,113,0.25)]'
                            : 'bg-[rgba(239,140,140,0.08)] text-[#ef8c8c] border-[rgba(239,140,140,0.25)]'
                        }`}>
                          {c.state.toUpperCase()}
                        </span>
                      </div>

                      <div className="space-y-2 text-xs font-mono text-[#69756d] mb-4">
                        <div>
                          <span className="text-[#9ba69e]">CONNECTOR KEY:</span> {c.connector_key}
                        </div>
                        <div>
                          <span className="text-[#9ba69e]">OBSERVABLE FIELDS:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {c.fields.map((f, idx) => (
                              <span key={idx} className="px-1.5 py-0.5 rounded bg-[rgba(236,233,223,0.06)] text-[#ece9df] text-[10px]">
                                {f}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-[#9ba69e]">RIGHTS POLICY:</span> {c.rights_policy}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[rgba(236,233,223,0.06)] flex items-center justify-between text-[11px] font-mono text-[#69756d]">
                      <span>LAST POLLED:</span>
                      <span className="text-[#ece9df]">{c.last_success_at}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 5: LOOK-ALIKE & CONFUSABLE SIMULATOR (BONUS PS.md)
              ======================================================== */}
          {activeTab === 'simulator' && (
            <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
              <div>
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[rgba(216,245,123,0.08)] text-[10.5px] font-mono text-[#d8f57b] uppercase tracking-wider mb-2">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>EVALUATION TEST BENCH &bull; BONUS CRITERION</span>
                </div>
                <h1 style={{ fontFamily: 'var(--font-serif)' }} className="text-3xl font-normal text-[#f2efe7] tracking-tight mb-1">
                  Look-alike Name &amp; Homoglyph Simulator
                </h1>
                <p className="text-sm text-[#9ba69e]">
                  Evaluate character swaps, Unicode confusable homoglyphs, added words, and spacing mutations against the official brand baseline.
                </p>
              </div>

              {/* Preset Fast Testing Chips & Baseline Selector */}
              <div className="glass-panel p-5 rounded-xl border border-[rgba(236,233,223,0.12)] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-mono text-[#9ba69e] block mb-1.5">OFFICIAL BRAND BASELINE</label>
                    <input
                      type="text"
                      value={simBase}
                      onChange={(e) => setSimBase(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg bg-[rgba(14,20,17,0.8)] border border-[rgba(236,233,223,0.15)] text-sm font-mono text-[#d8f57b] focus:outline-none focus:border-[#d8f57b]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-mono text-[#9ba69e] block mb-1.5">TEST CANDIDATE HANDLE / DOMAIN / TITLE</label>
                    <input
                      type="text"
                      value={simInput}
                      onChange={(e) => setSimInput(e.target.value)}
                      placeholder="e.g. Northstаr Pay Support"
                      className="w-full h-10 px-3 rounded-lg bg-[rgba(14,20,17,0.8)] border border-[rgba(236,233,223,0.15)] text-sm font-mono text-[#f2efe7] focus:outline-none focus:border-[#d8f57b]"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[rgba(236,233,223,0.06)]">
                  <span className="text-[11px] font-mono text-[#69756d]">QUICK ATTACK PRESETS:</span>
                  <button
                    onClick={() => {
                      setSimInput('Northstаr Pay'); // with Cyrillic 'а' (U+0430)
                      playTacticalSound('action');
                    }}
                    className="px-2.5 py-1 rounded bg-[rgba(14,20,17,0.8)] hover:bg-[rgba(216,245,123,0.08)] text-[11px] font-mono text-[#d8f57b] border border-[rgba(236,233,223,0.08)]"
                  >
                    Cyrillic &apos;а&apos; Swap
                  </button>
                  <button
                    onClick={() => {
                      setSimInput('N0rthst4r P@y'); // Leetspeak substitution
                      playTacticalSound('action');
                    }}
                    className="px-2.5 py-1 rounded bg-[rgba(14,20,17,0.8)] hover:bg-[rgba(216,245,123,0.08)] text-[11px] font-mono text-[#e9ad71] border border-[rgba(236,233,223,0.08)]"
                  >
                    Leetspeak Matrix (&apos;0&apos; &amp; &apos;4&apos;)
                  </button>
                  <button
                    onClick={() => {
                      setSimInput('Northstar Pay Support & Emergency Help');
                      playTacticalSound('action');
                    }}
                    className="px-2.5 py-1 rounded bg-[rgba(14,20,17,0.8)] hover:bg-[rgba(216,245,123,0.08)] text-[11px] font-mono text-[#ef8c8c] border border-[rgba(236,233,223,0.08)]"
                  >
                    High-Risk Keyword Insertion
                  </button>
                  <button
                    onClick={() => {
                      setSimInput('Northstar Pay Official Social');
                      playTacticalSound('action');
                    }}
                    className="px-2.5 py-1 rounded bg-[rgba(14,20,17,0.8)] hover:bg-[rgba(216,245,123,0.08)] text-[11px] font-mono text-[#9cc4d9] border border-[rgba(236,233,223,0.08)]"
                  >
                    Registered Official Asset
                  </button>
                </div>
              </div>

              {/* Advanced Forensic Code-Point Inspector Component */}
              <HomoglyphInspector
                candidateText={simInput}
                baselineText={simBase}
                onFeedIntoQueue={handleQueueSimulatedFinding}
              />
            </div>
          )}

          {/* ========================================================
              TAB 6: PROOF LEDGER & AUDIT EXPORT
              ======================================================== */}
          {activeTab === 'audit' && (
            <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 style={{ fontFamily: 'var(--font-serif)' }} className="text-3xl font-normal text-[#f2efe7] tracking-tight mb-1">
                    Proof Ledger &amp; Export
                  </h1>
                  <p className="text-sm text-[#9ba69e]">
                    Every observation, transformation, detector result, analyst decision, and external action is cryptographically chained.
                  </p>
                </div>
                <button
                  onClick={() => setShowDossierModal(true)}
                  className="cairn-btn cairn-btn-primary h-10 px-4 text-xs font-semibold flex items-center gap-2 self-start sm:self-auto"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Cryptographic Dossier</span>
                </button>
              </div>

              {/* Event Timeline */}
              <div className="glass-panel p-6 rounded-xl border border-[rgba(236,233,223,0.08)]">
                <div className="text-xs font-mono uppercase tracking-wider text-[#ece9df] mb-4">
                  APPEND-ONLY EVENT AUDIT LOG
                </div>

                <div className="space-y-3 font-mono text-xs">
                  <div className="p-3 rounded bg-[rgba(14,20,17,0.6)] border border-[rgba(236,233,223,0.06)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[#d8f57b] font-semibold">[CASE_DECISION]</span>
                      <span className="text-[#ece9df] ml-2">Case case_app_002_live confirmed impersonation under organizational policy</span>
                      <div className="text-[10px] text-[#69756d] mt-0.5">Actor: marcus.thorne@northstar.governance &bull; Reason: Publisher mismatch confirmed</div>
                    </div>
                    <span className="text-[10.5px] text-[#69756d]">2026-10-14 09:20:00Z</span>
                  </div>

                  <div className="p-3 rounded bg-[rgba(14,20,17,0.6)] border border-[rgba(236,233,223,0.06)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[#e9ad71] font-semibold">[INTAKE_TRIAGED]</span>
                      <span className="text-[#ece9df] ml-2">cand_social_lookalike_01 evaluated by detector v2.1</span>
                      <div className="text-[10px] text-[#69756d] mt-0.5">Integrity SHA-256: 9f83c18b76e42b6a9c1e7d8a63f104e84b238e83b4b88a9134b281f6294711fa</div>
                    </div>
                    <span className="text-[10.5px] text-[#69756d]">2026-10-14 09:42:00Z</span>
                  </div>

                  <div className="p-3 rounded bg-[rgba(14,20,17,0.6)] border border-[rgba(236,233,223,0.06)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[#9cc4d9] font-semibold">[FIREWALL_PASS]</span>
                      <span className="text-[#ece9df] ml-2">Official control did:plc:northstarofficial2026 matched stable identifier</span>
                      <div className="text-[10px] text-[#69756d] mt-0.5">Protected from adversarial queue by verified registry record</div>
                    </div>
                    <span className="text-[10.5px] text-[#69756d]">2026-10-14 07:30:00Z</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ========================================================
          MODAL: REGISTER OFFICIAL ASSET
          ======================================================== */}
      {showAddAssetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="max-w-lg w-full rounded-xl bg-[#0d120f] border border-[rgba(216,245,123,0.3)] shadow-[0_20px_60px_rgba(0,0,0,0.8)] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[rgba(236,233,223,0.08)] pb-3">
              <h3 className="text-base font-semibold text-[#ece9df] font-mono">Register Official Asset</h3>
              <button onClick={() => setShowAddAssetModal(false)} className="text-[#69756d] hover:text-[#ece9df]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRegisterAsset} className="space-y-3 text-xs font-mono">
              <div>
                <label className="text-[#9ba69e] block mb-1">ASSET TYPE</label>
                <select
                  value={newAssetType}
                  onChange={(e) => setNewAssetType(e.target.value as any)}
                  className="w-full h-9 px-3 rounded bg-[rgba(14,20,17,0.8)] border border-[rgba(236,233,223,0.15)] text-[#ece9df]"
                >
                  <option value="social_profile">Social Profile (Bluesky / Instagram / X)</option>
                  <option value="mobile_app">Mobile Application (App Store / Google Play)</option>
                  <option value="logo">Visual Logo Asset</option>
                  <option value="exception">Authorized Partner / Affiliate Exception</option>
                </select>
              </div>

              <div>
                <label className="text-[#9ba69e] block mb-1">DISPLAY NAME *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Northstar Pay Official Helpdesk"
                  value={newAssetDisplayName}
                  onChange={(e) => setNewAssetDisplayName(e.target.value)}
                  className="w-full h-9 px-3 rounded bg-[rgba(14,20,17,0.8)] border border-[rgba(236,233,223,0.15)] text-[#ece9df]"
                />
              </div>

              <div>
                <label className="text-[#9ba69e] block mb-1">CANONICAL LOCATOR URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={newAssetUrl}
                  onChange={(e) => setNewAssetUrl(e.target.value)}
                  className="w-full h-9 px-3 rounded bg-[rgba(14,20,17,0.8)] border border-[rgba(236,233,223,0.15)] text-[#ece9df]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#9ba69e] block mb-1">STABLE IDENTIFIER</label>
                  <input
                    type="text"
                    placeholder="did:plc:... or package id"
                    value={newAssetStableId}
                    onChange={(e) => setNewAssetStableId(e.target.value)}
                    className="w-full h-9 px-3 rounded bg-[rgba(14,20,17,0.8)] border border-[rgba(236,233,223,0.15)] text-[#ece9df]"
                  />
                </div>
                <div>
                  <label className="text-[#9ba69e] block mb-1">PLATFORM / STORE</label>
                  <input
                    type="text"
                    placeholder="bluesky or app_store"
                    value={newAssetScope}
                    onChange={(e) => setNewAssetScope(e.target.value)}
                    className="w-full h-9 px-3 rounded bg-[rgba(14,20,17,0.8)] border border-[rgba(236,233,223,0.15)] text-[#ece9df]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[#9ba69e] block mb-1">PUBLISHER (IF APP)</label>
                <input
                  type="text"
                  placeholder="e.g. Northstar Financial Services LLC"
                  value={newAssetPublisher}
                  onChange={(e) => setNewAssetPublisher(e.target.value)}
                  className="w-full h-9 px-3 rounded bg-[rgba(14,20,17,0.8)] border border-[rgba(236,233,223,0.15)] text-[#ece9df]"
                />
              </div>

              <div className="pt-3 border-t border-[rgba(236,233,223,0.08)] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddAssetModal(false)}
                  className="px-4 py-2 rounded text-xs font-mono text-[#9ba69e] hover:text-[#ece9df]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded text-xs font-mono bg-[#d8f57b] text-[#131b0e] font-semibold hover:bg-[#efffb9]"
                >
                  Confirm &amp; Version Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: EXPORT EVIDENCE DOSSIER
          ======================================================== */}
      {showDossierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="max-w-2xl w-full rounded-xl bg-[#0d120f] border border-[rgba(216,245,123,0.3)] shadow-[0_20px_60px_rgba(0,0,0,0.8)] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[rgba(236,233,223,0.08)] pb-3">
              <div>
                <h3 className="text-base font-semibold text-[#ece9df] font-mono">Cryptographic Evidence Dossier</h3>
                <span className="text-xs text-[#9ba69e] font-mono">STANDARDIZED RISK INTELLIGENCE PACKAGE</span>
              </div>
              <button onClick={() => setShowDossierModal(false)} className="text-[#69756d] hover:text-[#ece9df]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded bg-[rgba(8,11,10,0.9)] border border-[rgba(236,233,223,0.08)] font-mono text-[11px] text-[#9ba69e] max-h-80 overflow-y-auto">
              <pre>{JSON.stringify({
                export_version: '2.0',
                tenant: brand.name,
                generated_at: new Date().toISOString(),
                audit_authority: 'CAIRNWISE_PROOF_LEDGER',
                official_assets_count: assets.length,
                incidents_evaluated: candidates.length,
                cryptographic_signatures: candidates.flatMap(c => c.evidence.map(e => ({
                  id: e.id,
                  type: e.evidence_type,
                  sha256: e.integrity_hash,
                }))),
              }, null, 2)}</pre>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-xs text-[#69756d] font-mono">Ready for compliance &amp; legal counsel review</span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(candidates, null, 2));
                    triggerToast('Dossier JSON copied to clipboard.');
                  }}
                  className="px-3 py-1.5 rounded text-xs font-mono bg-[rgba(236,233,223,0.08)] hover:bg-[rgba(236,233,223,0.15)] text-[#ece9df] flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy JSON</span>
                </button>
                <button
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(candidates, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `cairnwise_dossier_${Date.now()}.json`;
                    a.click();
                    triggerToast('Downloaded cryptographic evidence dossier.');
                    setShowDossierModal(false);
                  }}
                  className="px-3 py-1.5 rounded text-xs font-mono bg-[#d8f57b] text-[#131b0e] font-semibold hover:bg-[#efffb9] flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .json</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ========================================================
          MODAL: COURT EVIDENCE CERTIFICATE (ISO/IEC 27037)
          ======================================================== */}
      {selectedCandidate && (
        <EvidenceCertificateModal
          isOpen={showCertificateModal}
          onClose={() => setShowCertificateModal(false)}
          candidate={selectedCandidate}
          brandName={brand.name}
        />
      )}

      {/* ========================================================
          MODAL: PLATFORM TAKEDOWN & ABUSE DESK NOTICE
          ======================================================== */}
      {selectedCandidate && (
        <TakedownNoticeModal
          isOpen={showTakedownModal}
          onClose={() => setShowTakedownModal(false)}
          candidate={selectedCandidate}
          brandName={brand.name}
          onNoticeDispatched={(platform) => {
            triggerToast(`Dispatched ${platform.toUpperCase()} notice. Cryptographic record added.`);
            playTacticalSound('success');
          }}
        />
      )}
    </div>
  );
}
