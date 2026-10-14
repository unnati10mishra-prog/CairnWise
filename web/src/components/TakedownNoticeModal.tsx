'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { X, Copy, Check, Send, AlertTriangle, ShieldAlert, Globe, Smartphone, Radio } from 'lucide-react';

interface TakedownNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: {
    id: string;
    asset_type: string;
    source_identity: string;
    latest_observation: {
      raw: {
        display_name: string;
        handle?: string;
        destination_url?: string;
        publisher?: string;
      };
    };
    latest_assessment: {
      reasons: string[];
    };
    evidence: Array<{
      integrity_hash: string;
      evidence_type: string;
    }>;
  };
  brandName: string;
  onNoticeDispatched?: (platform: string, noticeText: string) => void;
}

export function TakedownNoticeModal({
  isOpen,
  onClose,
  candidate,
  brandName,
  onNoticeDispatched,
}: TakedownNoticeModalProps) {
  const [platform, setPlatform] = useState<'social' | 'store' | 'hosting'>('social');
  const [copied, setCopied] = useState(false);
  const [dispatched, setDispatched] = useState(false);
  const [tmRef, setTmRef] = useState('TM-REG-2025-884102');
  const [legalEmail, setLegalEmail] = useState('brand-security@northstarpay.com');
  const [timestamp, setTimestamp] = useState('2026-10-14 08:00:00 UTC');

  useEffect(() => {
    setTimestamp(new Date().toUTCString());
  }, []);

  const noticeText = useMemo(() => {
    const candidateName = candidate.latest_observation.raw.display_name;
    const identifier = candidate.source_identity;
    const destUrl = candidate.latest_observation.raw.destination_url || 'Unresolved redirect';
    const evidenceHashes = candidate.evidence?.map(e => `SHA-256 (${e.evidence_type}): ${e.integrity_hash}`).join('\n') || 'None attached';

    if (platform === 'social') {
      return `FORMAL NOTICE OF BRAND IMPERSONATION & TRADEMARK INFRINGEMENT

TO: Social Media Trust & Safety / Legal Abuse Department
DATE: ${timestamp}
RE: Immediate Suspension Request — Unauthorized Brand Impersonation

1. TRADEMARK HOLDER IDENTIFICATION:
We represent ${brandName}. Registered Trademark Identifier: ${tmRef}.
Official corporate domain: https://northstarpay.com
Authorized Contact: ${legalEmail}

2. INFRINGING MATERIAL IDENTIFICATION:
Account Handle / Display Name: ${candidateName} (${identifier})
Direct Profile Locator: https://bsky.app/profile/${identifier}
Observed Exfiltration Destination: ${destUrl}

3. INFRINGEMENT DETAILS & PROOF:
The reported profile uses ${brandName}'s registered name and visual brand indicators without authorization.
Observed behavioral indicators include: ${candidate.latest_assessment.reasons.join(', ')}.

4. CRYPTOGRAPHIC FORENSIC CHAIN OF EVIDENCE:
All observation snapshots have been preserved with cryptographically tamper-evident SHA-256 verification hashes:
${evidenceHashes}

5. STATEMENT OF GOOD FAITH:
We have a good faith belief that the use of the trademark in this manner is not authorized by the trademark owner, its agent, or the law. The information in this notice is accurate under penalty of perjury.

Please suspend this account immediately to prevent further consumer deception.

Respectfully submitted,
Brand Protection & Legal Operations
${brandName}`;
    }

    if (platform === 'store') {
      return `APPLICATION STORE TRADEMARK & CONSUMER FRAUD NOTICE

TO: Mobile App Store Trust & Safety / App Review Board
DATE: ${timestamp}
RE: Misleading Application Takedown — Package & Trademark Conflict

1. EXCLUSIVE RIGHTS HOLDER:
Entity: ${brandName}
Official Developer: Northstar Financial Services LLC
Trademark Registration: ${tmRef}

2. REPORTED MOBILE APP:
Application Name: ${candidateName}
Package Identifier / Store Locator: ${identifier}
Reported Publisher: ${candidate.latest_observation.raw.publisher || 'Unknown unauthorized developer'}

3. EVIDENCE OF MISLEADING REPRESENTATION:
The application title and icon create severe customer confusion regarding affiliation with ${brandName}.
The publisher is an unverified third party attempting to divert financial transactions.

4. HASH INTEGRITY ATTESTATION:
${evidenceHashes}

We request expedited removal under Developer Program Policy (Impersonation and Intellectual Property).

Signed,
Digital Risk Operations, ${brandName}`;
    }

    // Hosting / Registrar Phishing Notice
    return `URGENT: PHISHING & FRAUDULENT EXFILTRATION HOSTING ABUSE NOTICE

TO: Domain Registrar Abuse Desk / Hosting Provider Network Operations Center
DATE: ${timestamp}
RE: Emergency Phishing Neutralization Request

Target Phishing URL: ${destUrl}
Target Domain Name: ${identifier}
Impersonated Brand: ${brandName} (Ref: ${tmRef})

TECHNICAL DETAILS:
The above URL hosts an unauthorized credential harvesting portal targeting customers of ${brandName}.
The landing page prompts visitors for private authentication credentials and payment PINs.

EVIDENCE LEDGER (FORENSIC PROVENANCE):
${evidenceHashes}

Under ICANN RAA and applicable computer fraud prevention policies, please suspend the DNS delegation or terminate hosting for this abusive host immediately.

Security Operations Centre (SOC)
${brandName} — ${legalEmail}`;
  }, [platform, candidate, brandName, tmRef, legalEmail, timestamp]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(noticeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDispatch = () => {
    setDispatched(true);
    onNoticeDispatched?.(platform, noticeText);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-3xl rounded-2xl bg-[#090d0b] border border-[rgba(216,245,123,0.3)] shadow-[0_25px_80px_rgba(0,0,0,0.95)] p-6 space-y-4 text-[#ece9df]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[rgba(236,233,223,0.1)]">
          <div>
            <div className="text-[10px] font-mono tracking-widest text-[#d8f57b] uppercase">
              PLATFORM ENFORCEMENT &bull; TAKEDOWN NOTICE GENERATOR
            </div>
            <h3 className="text-xl font-normal text-[#f2efe7] font-serif">
              Generate Platform Submission Notice
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#69756d] hover:text-[#ece9df]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Platform Selection Tabs */}
        <div className="grid grid-cols-3 gap-2 font-mono text-xs">
          <button
            onClick={() => setPlatform('social')}
            className={`p-2.5 rounded-lg border text-left transition-all flex items-center gap-2 ${
              platform === 'social'
                ? 'bg-[rgba(216,245,123,0.1)] border-[rgba(216,245,123,0.35)] text-[#d8f57b]'
                : 'bg-[rgba(14,20,17,0.7)] border-[rgba(236,233,223,0.08)] text-[#9ba69e]'
            }`}
          >
            <Radio className="w-3.5 h-3.5 flex-shrink-0" />
            <div>
              <div className="font-semibold">Social Network</div>
              <div className="text-[10px] text-[#69756d]">X &bull; Bluesky &bull; Meta</div>
            </div>
          </button>

          <button
            onClick={() => setPlatform('store')}
            className={`p-2.5 rounded-lg border text-left transition-all flex items-center gap-2 ${
              platform === 'store'
                ? 'bg-[rgba(216,245,123,0.1)] border-[rgba(216,245,123,0.35)] text-[#d8f57b]'
                : 'bg-[rgba(14,20,17,0.7)] border-[rgba(236,233,223,0.08)] text-[#9ba69e]'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 flex-shrink-0" />
            <div>
              <div className="font-semibold">App Store</div>
              <div className="text-[10px] text-[#69756d]">Apple &bull; Google Play</div>
            </div>
          </button>

          <button
            onClick={() => setPlatform('hosting')}
            className={`p-2.5 rounded-lg border text-left transition-all flex items-center gap-2 ${
              platform === 'hosting'
                ? 'bg-[rgba(216,245,123,0.1)] border-[rgba(216,245,123,0.35)] text-[#d8f57b]'
                : 'bg-[rgba(14,20,17,0.7)] border-[rgba(236,233,223,0.08)] text-[#9ba69e]'
            }`}
          >
            <Globe className="w-3.5 h-3.5 flex-shrink-0" />
            <div>
              <div className="font-semibold">Registrar / Host</div>
              <div className="text-[10px] text-[#69756d]">DNS &bull; Cloudflare Abuse</div>
            </div>
          </button>
        </div>

        {/* Customizable Metadata Row */}
        <div className="grid grid-cols-2 gap-3 text-xs font-mono">
          <div>
            <label className="text-[#69756d] block mb-1 text-[10px]">TRADEMARK REF #</label>
            <input
              type="text"
              value={tmRef}
              onChange={(e) => setTmRef(e.target.value)}
              className="w-full h-8 px-2.5 rounded bg-[rgba(14,20,17,0.8)] border border-[rgba(236,233,223,0.12)] text-[#ece9df]"
            />
          </div>

          <div>
            <label className="text-[#69756d] block mb-1 text-[10px]">LEGAL CONTACT EMAIL</label>
            <input
              type="email"
              value={legalEmail}
              onChange={(e) => setLegalEmail(e.target.value)}
              className="w-full h-8 px-2.5 rounded bg-[rgba(14,20,17,0.8)] border border-[rgba(236,233,223,0.12)] text-[#ece9df]"
            />
          </div>
        </div>

        {/* Generated Legal Notice Content */}
        <div className="relative">
          <div className="p-4 rounded-xl bg-[rgba(8,11,10,0.9)] border border-[rgba(236,233,223,0.1)] font-mono text-[11px] text-[#ece9df] max-h-72 overflow-y-auto whitespace-pre-wrap leading-relaxed select-all">
            {noticeText}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[rgba(236,233,223,0.08)] font-mono text-xs">
          <span className="text-[#69756d] text-[11px]">
            Notice includes certified SHA-256 evidence hashes
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3.5 py-2 rounded-lg bg-[rgba(236,233,223,0.08)] hover:bg-[rgba(236,233,223,0.15)] text-[#ece9df] flex items-center gap-1.5 transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#d8f57b]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied to Clipboard' : 'Copy Notice Text'}</span>
            </button>

            <button
              onClick={handleDispatch}
              disabled={dispatched}
              className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
                dispatched
                  ? 'bg-[rgba(216,245,123,0.2)] text-[#d8f57b] cursor-default'
                  : 'bg-[#d8f57b] text-[#131b0e] hover:bg-[#efffb9]'
              }`}
            >
              {dispatched ? <Check className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
              <span>{dispatched ? 'Marked as Dispatched' : 'Record Notice Dispatched'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
