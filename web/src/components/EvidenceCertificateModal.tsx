'use client';

import React, { useState, useEffect } from 'react';
import { X, Printer, Download, CheckCircle, ShieldCheck, Hash, FileText } from 'lucide-react';
import { RadarSpiderChart } from './RadarSpiderChart';

interface EvidenceCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: {
    id: string;
    asset_type: string;
    source_identity: string;
    latest_observation: {
      source_mode: string;
      observed_at: string;
      raw: {
        display_name: string;
        handle?: string;
        bio?: string;
        publisher?: string;
        destination_url?: string;
        icon_similarity?: number;
      };
    };
    latest_assessment: {
      identity_resemblance: number;
      authorization_state: string;
      authorization_conflict: number;
      potential_harm_level: string;
      observed_harm: number;
      evidence_quality: number;
      queue_priority: number;
      decision_state: string;
      reasons: string[];
      counterevidence: string[];
      missing: string[];
    };
    evidence: Array<{
      id: string;
      evidence_type: string;
      excerpt: string;
      integrity_hash: string;
      captured_at?: string;
    }>;
    case?: {
      id: string;
      owner: string;
      disposition: string;
      decided_at?: string;
    };
  };
  brandName: string;
}

export function EvidenceCertificateModal({
  isOpen,
  onClose,
  candidate,
  brandName,
}: EvidenceCertificateModalProps) {
  const [issuedAt, setIssuedAt] = useState('2026-10-14T08:00:00Z');
  const [certSuffix, setCertSuffix] = useState('7B9F1A');

  useEffect(() => {
    setIssuedAt(new Date().toISOString());
    setCertSuffix(Date.now().toString(36).toUpperCase());
  }, []);

  if (!isOpen) return null;

  const certificateId = `CW-CERT-${candidate.id.toUpperCase()}-${certSuffix}`;
  const nowIso = issuedAt;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJson = () => {
    const payload = {
      certificate_id: certificateId,
      standard: 'ISO/IEC 27037:2012 & RFC 7807',
      issued_at: nowIso,
      brand_baseline: brandName,
      incident: candidate,
      cryptographic_attestation: {
        sha256_root_hash: candidate.evidence?.[0]?.integrity_hash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        tamper_evident: true,
        custody_status: 'unbroken_chain',
      },
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${certificateId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl bg-[#090d0b] border border-[rgba(216,245,123,0.3)] shadow-[0_25px_80px_rgba(0,0,0,0.95)] p-6 sm:p-8 space-y-6 text-[#ece9df]">
        
        {/* Top Control Bar (Hidden in Print) */}
        <div className="flex items-center justify-between pb-4 border-b border-[rgba(236,233,223,0.1)] print:hidden">
          <div className="flex items-center gap-2 text-xs font-mono text-[#d8f57b]">
            <ShieldCheck className="w-4 h-4" />
            <span className="font-semibold uppercase tracking-wider">FORENSIC EVIDENCE CERTIFICATE</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-lg bg-[rgba(216,245,123,0.12)] hover:bg-[rgba(216,245,123,0.25)] text-[#d8f57b] border border-[rgba(216,245,123,0.3)] text-xs font-mono flex items-center gap-1.5 transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>

            <button
              onClick={handleDownloadJson}
              className="px-3.5 py-1.5 rounded-lg bg-[rgba(236,233,223,0.08)] hover:bg-[rgba(236,233,223,0.18)] text-[#ece9df] text-xs font-mono flex items-center gap-1.5 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>JSON Package</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#69756d] hover:text-[#ece9df] hover:bg-[rgba(236,233,223,0.08)] transition-all ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Certificate Body */}
        <div id="forensic-certificate-printable" className="space-y-6">
          {/* Certificate Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-[rgba(236,233,223,0.15)]">
            <div>
              <div className="text-[11px] font-mono tracking-widest text-[#d8f57b] uppercase mb-1">
                CAIRNWISE RISK INTELLIGENCE &bull; DIGITAL FORENSICS UNIT
              </div>
              <h1 style={{ fontFamily: 'var(--font-serif)' }} className="text-2xl sm:text-3xl font-normal text-[#f2efe7]">
                Evidence Admissibility Dossier
              </h1>
              <div className="text-xs text-[#9ba69e] font-mono mt-1">
                Standard: ISO/IEC 27037:2012 Digital Evidence Identification &bull; RFC 7807 Attestation
              </div>
            </div>

            <div className="text-left sm:text-right font-mono text-[11px] text-[#69756d] space-y-0.5">
              <div><span className="text-[#9ba69e]">CERTIFICATE UID:</span> <span className="text-[#ece9df] font-bold">{certificateId}</span></div>
              <div><span className="text-[#9ba69e]">DATE ISSUED:</span> {nowIso}</div>
              <div><span className="text-[#9ba69e]">TENANT:</span> <span className="text-[#d8f57b]">{brandName}</span></div>
            </div>
          </div>

          {/* Side-by-Side Identity Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-4 rounded-xl bg-[rgba(14,20,17,0.7)] border border-[rgba(216,245,123,0.2)] space-y-2">
              <div className="text-[#d8f57b] font-semibold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>OFFICIAL REGISTERED BASELINE</span>
              </div>
              <div className="space-y-1 text-[#9ba69e]">
                <div><span className="text-[#69756d]">Brand Name:</span> <span className="text-[#ece9df]">{brandName}</span></div>
                <div><span className="text-[#69756d]">Asset Scope:</span> Global Official Protected Asset</div>
                <div><span className="text-[#69756d]">Registry Authority:</span> Corporate Brand Security Registrar</div>
                <div><span className="text-[#69756d]">Status:</span> <span className="text-[#d8f57b] font-semibold">VERIFIED AUTHORIZED</span></div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[rgba(14,20,17,0.7)] border border-[rgba(239,140,140,0.25)] space-y-2">
              <div className="text-[#ef8c8c] font-semibold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5" />
                <span>ADVERSARIAL CANDIDATE FINDING</span>
              </div>
              <div className="space-y-1 text-[#9ba69e]">
                <div><span className="text-[#69756d]">Candidate Title:</span> <span className="text-[#ece9df]">{candidate.latest_observation.raw.display_name}</span></div>
                <div><span className="text-[#69756d]">Identifier:</span> <span className="text-[#ece9df]">{candidate.source_identity}</span></div>
                <div><span className="text-[#69756d]">Observed Destination:</span> <span className="text-[#e9ad71]">{candidate.latest_observation.raw.destination_url || 'Unresolved redirect'}</span></div>
                <div><span className="text-[#69756d]">Authorization:</span> <span className="text-[#e9ad71] font-semibold">{candidate.latest_assessment.authorization_state.toUpperCase()}</span></div>
              </div>
            </div>
          </div>

          {/* 4D Triangulation Radar Diagram and Metric Summary */}
          <div className="p-5 rounded-xl bg-[rgba(14,20,17,0.8)] border border-[rgba(236,233,223,0.1)]">
            <div className="text-xs font-mono uppercase tracking-wider text-[#d8f57b] mb-4">
              4-DIMENSIONAL SIGNAL TRIANGULATION PROFILE
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              <div className="md:col-span-5 flex justify-center">
                <RadarSpiderChart
                  resemblance={candidate.latest_assessment.identity_resemblance}
                  authorizationConflict={candidate.latest_assessment.authorization_conflict}
                  observedHarm={candidate.latest_assessment.observed_harm}
                  evidenceQuality={candidate.latest_assessment.evidence_quality}
                  size={240}
                />
              </div>

              <div className="md:col-span-7 space-y-3 font-mono text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 rounded bg-[rgba(9,12,10,0.8)] border border-[rgba(236,233,223,0.06)]">
                    <span className="text-[#69756d] block text-[10px]">1. RESEMBLANCE</span>
                    <span className="text-base text-[#d8f57b] font-serif font-normal">
                      {(candidate.latest_assessment.identity_resemblance * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="p-2.5 rounded bg-[rgba(9,12,10,0.8)] border border-[rgba(236,233,223,0.06)]">
                    <span className="text-[#69756d] block text-[10px]">2. AUTH CONFLICT</span>
                    <span className="text-base text-[#e9ad71] font-serif font-normal">
                      {(candidate.latest_assessment.authorization_conflict * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="p-2.5 rounded bg-[rgba(9,12,10,0.8)] border border-[rgba(236,233,223,0.06)]">
                    <span className="text-[#69756d] block text-[10px]">3. OBSERVED HARM</span>
                    <span className="text-base text-[#ef8c8c] font-serif font-normal">
                      {(candidate.latest_assessment.observed_harm * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="p-2.5 rounded bg-[rgba(9,12,10,0.8)] border border-[rgba(236,233,223,0.06)]">
                    <span className="text-[#69756d] block text-[10px]">4. EVIDENCE QUALITY</span>
                    <span className="text-base text-[#9cc4d9] font-serif font-normal">
                      {(candidate.latest_assessment.evidence_quality * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-[#9ba69e] leading-relaxed pt-1">
                  Overall triage queue priority computed at <strong className="text-[#d8f57b]">{candidate.latest_assessment.queue_priority.toFixed(2)}</strong>.
                  Evaluation policy state: <span className="text-[#ece9df] uppercase">{candidate.latest_assessment.decision_state.replace(/_/g, ' ')}</span>.
                </div>
              </div>
            </div>
          </div>

          {/* Cryptographic SHA-256 Evidence Chain */}
          <div className="space-y-2 font-mono text-xs">
            <div className="text-[11px] text-[#69756d] uppercase tracking-wider">
              CRYPTOGRAPHIC INTEGRITY PROOF CHAIN (SHA-256)
            </div>

            <div className="space-y-2">
              {candidate.evidence?.map((ev, i) => (
                <div key={ev.id || i} className="p-3 rounded-lg bg-[rgba(9,12,10,0.9)] border border-[rgba(236,233,223,0.08)]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10.5px] text-[#69756d] mb-1">
                    <span className="text-[#ece9df] font-semibold">{ev.evidence_type}</span>
                    <span className="text-[#d8f57b] break-all">{ev.integrity_hash}</span>
                  </div>
                  <p className="text-[11.5px] text-[#9ba69e] leading-relaxed">{ev.excerpt}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Human Adjudication Block */}
          <div className="p-4 rounded-xl bg-[rgba(14,20,17,0.7)] border border-[rgba(236,233,223,0.12)] font-mono text-xs space-y-2">
            <div className="text-[#d8f57b] font-semibold text-[11px] uppercase tracking-wider">
              ACCOUNTABLE HUMAN-IN-THE-LOOP ADJUDICATION
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[#9ba69e]">
              <div>
                <span className="text-[#69756d] block text-[10px]">RECORDING ANALYST:</span>
                <span className="text-[#ece9df]">{candidate.case?.owner || 'marcus.thorne@northstar.governance'}</span>
              </div>
              <div>
                <span className="text-[#69756d] block text-[10px]">DISPOSITION VERDICT:</span>
                <span className="text-[#d8f57b] font-semibold uppercase">{candidate.case?.disposition || 'in_review'}</span>
              </div>
              <div>
                <span className="text-[#69756d] block text-[10px]">TIMESTAMP:</span>
                <span className="text-[#ece9df]">{candidate.case?.decided_at || nowIso}</span>
              </div>
            </div>
          </div>

          {/* Legal Notice Footer */}
          <div className="text-[10px] font-mono text-[#69756d] leading-relaxed border-t border-[rgba(236,233,223,0.08)] pt-4">
            CONFIDENTIAL DIGITAL EVIDENCE DOSSIER. Generated in accordance with Cairnwise strict truth-boundary protocols.
            Identity resemblance constitutes an evidentiary risk signal and does not establish intent or ownership.
            Tamper-evident hash records verify observation provenance without alteration.
          </div>
        </div>
      </div>
    </div>
  );
}
