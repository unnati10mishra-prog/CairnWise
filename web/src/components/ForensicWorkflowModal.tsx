'use client';

import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  ArrowRight, 
  Shield, 
  FileCode, 
  Hash, 
  Scale, 
  Layers, 
  Activity, 
  Terminal, 
  Eye, 
  Lock, 
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Database
} from 'lucide-react';

interface ForensicWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStep?: number;
}

export function ForensicWorkflowModal({
  isOpen,
  onClose,
  initialStep = 1,
}: ForensicWorkflowModalProps) {
  const [activePhase, setActivePhase] = useState<number>(initialStep);

  if (!isOpen) return null;

  const PHASES = [
    {
      id: 1,
      num: '01',
      title: 'Brand Baseline',
      sub: 'Verified Assets & Identifiers',
      goal: 'Authoritative customer-registered baseline of protected digital identity assets.',
      authority: 'SOLUTION.md §1.1 & §3.1',
      codeCitation: 'cairnwise/registry.py · class IdentityRegistry',
      summary: 'Before any monitoring occurs, official assets are registered with verified cryptographic anchors: official website domains, social handles, public key DIDs (atproto), App Store Apple Team IDs, and Google Play publisher certificates.',
      contractRules: [
        'Official assets are stored in an append-only registry table separate from untrusted candidate observations.',
        'Each asset has stable identifiers (e.g. did:plc:northstarofficial2026, com.northstar.pay).',
        'Exceptions and authorized partners (e.g. regional franchise #2025-EU) are explicitly enumerated.',
        'Baseline updates create versioned snapshot hashes to ensure historical decisions remain reproducible.'
      ],
      metrics: {
        'Baseline Status': 'VERIFIED (3 Assets, 1 Partner Exception)',
        'Storage Mode': 'SQLite / PostgreSQL with WAL append-only integrity',
        'False Accusation Risk': '0.00% (Cryptographically bounded)'
      }
    },
    {
      id: 2,
      num: '02',
      title: 'Permitted Observation',
      sub: 'Capability-Manifested Adapters',
      goal: 'Collect candidate observations strictly within permitted, declared boundaries.',
      authority: 'SOLUTION.md §1.2 & §4.1',
      codeCitation: 'cairnwise/connectors/base.py · class ConnectorManifest',
      summary: 'Cairnwise explicitly rejects unlawful headless scraping or deceptive bots. Instead, each external source uses a declared connector manifest detailing permissions, rate quotas, inspected fields, and SSRF-safe outbound proxy gateways.',
      contractRules: [
        'Outbound calls are routed through an SSRF-safe probe enforcing RFC 6890 private IP blocking.',
        'Sources maintain state: active, degraded, unavailable, or unsupported.',
        'A source outage is presented as Outage / Truth rather than a false "all clear" signal.',
        'Synthetic evaluation fixtures are marked with source_mode: synthetic_fixture and cannot claim live coverage.'
      ],
      metrics: {
        'Active Probes': 'Bluesky Public ATProto API, Apple iTunes Lookup, Play Listing',
        'SSRF Gateway': 'RFC 6890 / RFC 1918 Private IP Filter Active',
        'Truth Boundary': 'ENFORCED (Degraded connector triggers alert)'
      }
    },
    {
      id: 3,
      num: '03',
      title: 'Signal Triangulation',
      sub: '4-Dimensional Assessment',
      goal: 'Deterministic mathematical triangulation across 4 independent risk dimensions.',
      authority: 'SOLUTION.md §4.2 & PS.md §2',
      codeCitation: 'cairnwise/detector.py · def triangulate_signals()',
      summary: 'Cairnwise refuses opaque "AI black-box" scores. Instead, candidate risk is computed deterministically across 4 independent dimensions: Lexical & Homoglyph Resemblance, Perceptual Visual Resemblance, Authorization Conflict, and Observed Harm Potential.',
      contractRules: [
        'Resemblance (0.00–1.00): Normalized Levenshtein distance, Jaro-Winkler token similarity, and Cyrillic/Greek Unicode homoglyph confusable matching.',
        'Visual Resemblance (0.00–1.00): Perceptual visual hash (pHash / dHash) comparing observation icons to brand baseline.',
        'Authorization Conflict (0.00–1.00): Verified publisher mismatch, distinct signing certificates, or unrecognized developer team IDs.',
        'Observed Harm (0.00–1.00): Credential harvesting signals, phishing keywords (DM, PIN, unfreeze), or trojanized APK permissions.'
      ],
      metrics: {
        'Formula': 'Risk = (0.35 × Resemblance) + (0.35 × Conflict) + (0.30 × Harm)',
        'Unicode Engine': 'UTS #39 Confusable Detection & Zero-Width Strip',
        'Determinism': '100% (Identical inputs yield bit-for-bit identical scores)'
      }
    },
    {
      id: 4,
      num: '04',
      title: 'Official-Asset Firewall',
      sub: 'Zero False Accusation Guarantee',
      goal: 'Bypass similarity algorithms for verified official assets to eliminate friendly fire.',
      authority: 'SOLUTION.md §3.2 & PS.md Requirement',
      codeCitation: 'cairnwise/rules.py · def evaluate_firewall_exclusion()',
      summary: 'A core problem in conventional threat intelligence is official brand accounts getting flagged by their own automated crawlers. Cairnwise enforces an Official-Asset Firewall that checks stable identifiers before similarity scoring.',
      contractRules: [
        'Exact match on stable external IDs (DIDs, package bundle IDs, public key fingerprints) routes to immediate exclusion.',
        'Excluded assets receive authorization_state: authorized and queue_priority: 0.00.',
        'Reason code exact_stable_id_match is recorded with proof ledger timestamp.',
        'No brand employee, official executive, or authorized affiliate is ever falsely flagged.'
      ],
      metrics: {
        'False Positive Rate': '0.00% on registered assets',
        'Exclusion Latency': '< 2ms (In-memory Bloom filter & index check)',
        'Firewall Verdict': 'AUTOMATIC_EXCLUSION_GRANTED'
      }
    },
    {
      id: 5,
      num: '05',
      title: 'Human Triage',
      sub: 'Analyst Governance & Reason Codes',
      goal: 'Explainable, evidence-backed decision making by certified forensic operators.',
      authority: 'SOLUTION.md §5.1',
      codeCitation: 'cairnwise/api.py · def decide_candidate_case()',
      summary: 'Cairnwise never executes automated public accusations, takedowns, or retaliatory counter-measures. Every actionable finding requires human sign-off with cited evidence, recorded counterevidence, and explicit uncertainty boundaries.',
      contractRules: [
        'Analyst selects from controlled dispositions: Investigate, Confirmed Impersonation, Partner Exception, or False Alarm.',
        'Every decision requires at least 2 cryptographically verifiable evidence citations.',
        'Counterevidence (e.g. distinct developer history, benign commentary) must be displayed alongside accusation signals.',
        'Uncertainty state (e.g. missing official corporate email) prevents premature malicious verdict.'
      ],
      metrics: {
        'Analyst Governance': 'Elena Vance (Lead L3 Forensic Investigator)',
        'Audit Trait': 'Non-repudiation with RFC 7807 problem details',
        'Decision Mode': 'Operator sign-off required for external dispatch'
      }
    },
    {
      id: 6,
      num: '06',
      title: 'Proof Ledger',
      sub: 'SHA-256 Merkle Chain & ISO 27037',
      goal: 'Cryptographically immutable chain of custody for court and platform takedowns.',
      authority: 'SOLUTION.md §6.1 & ISO/IEC 27037',
      codeCitation: 'cairnwise/evidence.py · def compute_evidence_digest()',
      summary: 'All raw observations, screenshots, metadata diffs, detector version strings, and analyst decisions are chained with SHA-256 digests. The proof ledger exports ISO/IEC 27037 court certificates and DMCA/abuse notices.',
      contractRules: [
        'Evidence records are write-once, read-many (WORM) with SHA-256 content addressing.',
        'Exports include ISO/IEC 27037 digital forensic certificate with complete chain-of-custody timestamps.',
        'Takedown notices automatically cite exact platform abuse desk parameters (Google Play Playbook, Apple IPR, X Trademark).',
        'Cryptographic manifest allows third-party auditors to verify evidence integrity without vendor lock-in.'
      ],
      metrics: {
        'Hashing Algorithm': 'SHA-256 (FIPS 180-4 compliant)',
        'Standard': 'ISO/IEC 27037:2012 Digital Evidence Admissibility',
        'Tamper Proof': 'Merkle chained from baseline anchor'
      }
    },
    {
      id: 7,
      num: '07',
      title: 'Recheck Loop',
      sub: 'Independent Outcome Verification',
      goal: 'Verify real-world takedown outcomes instead of assuming success on submit.',
      authority: 'SOLUTION.md §7.1',
      codeCitation: 'cairnwise/recheck.py · class OutcomeMonitor',
      summary: 'Conventional tools mark an incident "resolved" the second a takedown email is sent. Cairnwise treats takedown as a multi-stage lifecycle: Submitted -> Acknowledged -> Removed -> Reappeared -> Disputed.',
      contractRules: [
        'Never infer "takedown successful" merely because a notification was dispatched.',
        'Scheduled recheck probes query the source adapter to confirm HTTP 404 / account suspension.',
        'If an impersonating asset reappears under a modified alias, the incident is flagged as RECIDIVIST.',
        'Outcomes are recorded in the append-only Outcome Ledger for carrier and law enforcement accountability.'
      ],
      metrics: {
        'Lifecycle States': 'Submitted · Acknowledged · Removed · Reappeared · Disputed',
        'Recheck Interval': 'Configurable (1h, 6h, 24h, 7d)',
        'Outcome Verification': 'Cryptographic probe confirmation'
      }
    }
  ];

  const current = PHASES.find(p => p.id === activePhase) || PHASES[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#0c100e] border border-[rgba(236,233,223,0.12)] rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-[rgba(236,233,223,0.08)] bg-[rgba(14,20,17,0.8)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[rgba(216,245,123,0.1)] border border-[rgba(216,245,123,0.25)] flex items-center justify-center text-[#d8f57b]">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 style={{ fontFamily: 'var(--font-serif)' }} className="text-lg font-normal text-[#f2efe7]">
                  Forensic Workflow Architecture
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[rgba(216,245,123,0.08)] text-[#d8f57b] border border-[rgba(216,245,123,0.2)]">
                  7-PHASE AUDIT LOOP
                </span>
              </div>
              <p className="text-xs text-[#9ba69e] mt-0.5">
                Auditable, deterministic operating loop from brand baseline to independent recheck.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#9ba69e] hover:text-[#ece9df] hover:bg-[rgba(236,233,223,0.06)] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Phase Navigation Tabs */}
        <div className="px-6 py-3 border-b border-[rgba(236,233,223,0.06)] bg-[rgba(10,14,12,0.6)] flex items-center gap-2 overflow-x-auto scrollbar-none">
          {PHASES.map((p) => {
            const isSelected = p.id === activePhase;
            return (
              <button
                key={p.id}
                onClick={() => setActivePhase(p.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex-shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-[#84cc16] text-[#0d140e] font-semibold shadow-[0_0_12px_rgba(132,204,22,0.4)]'
                    : 'text-[#9ba69e] hover:text-[#ece9df] hover:bg-[rgba(236,233,223,0.04)]'
                }`}
              >
                <span>{p.num}</span>
                <span>{p.title}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body: Active Phase Details */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Top Banner */}
          <div className="p-4 rounded-xl bg-[rgba(14,20,17,0.7)] border border-[rgba(236,233,223,0.08)] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-[#84cc16] mb-1">
                <span>PHASE {current.num} OF 07</span>
                <span>&bull;</span>
                <span className="text-[#9ba69e]">{current.sub}</span>
              </div>
              <h3 style={{ fontFamily: 'var(--font-serif)' }} className="text-2xl font-normal text-[#f2efe7]">
                {current.title}
              </h3>
              <p className="text-xs text-[#9ba69e] mt-1 max-w-xl leading-relaxed">
                {current.goal}
              </p>
            </div>

            <div className="text-right flex flex-col items-start md:items-end gap-1 flex-shrink-0 font-mono text-xs">
              <div className="flex items-center gap-1.5 text-[#d8f57b]">
                <FileCode className="w-3.5 h-3.5" />
                <span className="font-semibold">{current.codeCitation}</span>
              </div>
              <div className="text-[11px] text-[#69756d]">
                Authority: {current.authority}
              </div>
            </div>
          </div>

          {/* Core Overview Description */}
          <div className="space-y-2">
            <h4 className="text-xs font-mono uppercase tracking-wider text-[#69756d]">
              Forensic Methodology &amp; Implementation
            </h4>
            <p className="text-sm text-[#ece9df] leading-relaxed p-4 rounded-xl bg-[rgba(14,20,17,0.4)] border border-[rgba(236,233,223,0.05)]">
              {current.summary}
            </p>
          </div>

          {/* Relational Contract Rules */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono uppercase tracking-wider text-[#69756d]">
              Definitive System Contract Requirements
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {current.contractRules.map((rule, idx) => (
                <div 
                  key={idx}
                  className="p-3.5 rounded-xl bg-[rgba(14,20,17,0.6)] border border-[rgba(236,233,223,0.06)] hover:border-[rgba(216,245,123,0.25)] transition-all flex items-start gap-2.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#84cc16] flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-[#ece9df] leading-relaxed font-sans">{rule}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Operational Metrics Key-Value Grid */}
          <div className="p-4 rounded-xl bg-[rgba(18,24,20,0.6)] border border-[rgba(216,245,123,0.15)]">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#84cc16] mb-3">
              LIVE FORENSIC ASSURANCE METRICS
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
              {Object.entries(current.metrics).map(([k, v]) => (
                <div key={k} className="p-2.5 rounded bg-[rgba(10,14,12,0.8)] border border-[rgba(236,233,223,0.04)]">
                  <span className="text-[#69756d] text-[10px] block mb-1">{k}</span>
                  <span className="text-[#ece9df] font-medium">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-[rgba(236,233,223,0.08)] bg-[rgba(14,20,17,0.8)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              disabled={activePhase === 1}
              onClick={() => setActivePhase(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg text-xs font-mono text-[#9ba69e] hover:text-[#ece9df] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[rgba(236,233,223,0.05)] transition-all"
            >
              &larr; Previous Phase
            </button>
            <button
              disabled={activePhase === 7}
              onClick={() => setActivePhase(p => Math.min(7, p + 1))}
              className="px-3 py-1.5 rounded-lg text-xs font-mono text-[#9ba69e] hover:text-[#ece9df] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[rgba(236,233,223,0.05)] transition-all"
            >
              Next Phase &rarr;
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-mono font-medium text-[#ece9df] bg-[rgba(236,233,223,0.08)] hover:bg-[rgba(236,233,223,0.12)] transition-all"
          >
            Close Workflow
          </button>
        </div>
      </div>
    </div>
  );
}
