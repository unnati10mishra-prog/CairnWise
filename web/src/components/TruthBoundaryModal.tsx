'use client';

import React from 'react';
import { 
  X, 
  ShieldCheck, 
  AlertTriangle, 
  FileCode, 
  CheckCircle2, 
  Scale, 
  Layers,
  ExternalLink
} from 'lucide-react';

interface TruthBoundaryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TruthBoundaryModal({ isOpen, onClose }: TruthBoundaryModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-[#0c100e] border border-[rgba(236,233,223,0.12)] rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[rgba(236,233,223,0.08)] bg-[rgba(14,20,17,0.8)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[rgba(132,204,22,0.12)] border border-[rgba(132,204,22,0.25)] flex items-center justify-center text-[#84cc16]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 style={{ fontFamily: 'var(--font-serif)' }} className="text-lg font-normal text-[#f2efe7]">
                  Cairnwise Truth Boundary Contract
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[rgba(132,204,22,0.08)] text-[#84cc16] border border-[rgba(132,204,22,0.2)]">
                  NON-NEGOTIABLE
                </span>
              </div>
              <p className="text-xs text-[#9ba69e] mt-0.5">
                Evaluation mode boundaries, honest outage reporting, and zero false accusation guarantees.
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

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto text-xs leading-relaxed">
          <div className="p-4 rounded-xl bg-[rgba(14,20,17,0.6)] border border-[rgba(236,233,223,0.06)] space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[#84cc16]">
              <CheckCircle2 className="w-4 h-4" />
              <span>1. Evaluation Mode Honesty (No Fake Crawler Claims)</span>
            </div>
            <p className="text-[#9ba69e] font-sans">
              Cairnwise explicitly labels its evaluation environment. It does not claim full-internet live coverage or automated global sweeps. When running on fixture data, candidate observations are cryptographically tagged with <code className="text-[#ece9df] bg-[rgba(236,233,223,0.06)] px-1 rounded">source_mode: synthetic_fixture</code>.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[rgba(14,20,17,0.6)] border border-[rgba(236,233,223,0.06)] space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[#e9ad71]">
              <CheckCircle2 className="w-4 h-4" />
              <span>2. Source Outages Reported as Truth (Not "0 Threats")</span>
            </div>
            <p className="text-[#9ba69e] font-sans">
              If an external connector experiences rate limits, IP blocking, or network failure, Cairnwise marks the status as <strong className="text-[#ef8c8c]">UNAVAILABLE</strong>. It explicitly refuses to show an empty queue or report "0 threats detected" when a sensor is blind.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[rgba(14,20,17,0.6)] border border-[rgba(236,233,223,0.06)] space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[#84cc16]">
              <CheckCircle2 className="w-4 h-4" />
              <span>3. Zero False Accusation Guarantee (Official Firewall)</span>
            </div>
            <p className="text-[#9ba69e] font-sans">
              Exact matches against verified stable external IDs (DIDs, package bundle IDs, public key signatures) are firewalled prior to similarity scoring. Official accounts and registered partner franchises are 100% immune from false accusation.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[rgba(14,20,17,0.6)] border border-[rgba(236,233,223,0.06)] space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[#ece9df]">
              <CheckCircle2 className="w-4 h-4" />
              <span>4. Resemblance Is A Signal, Not Legal Proof</span>
            </div>
            <p className="text-[#9ba69e] font-sans">
              A high string similarity score or visual icon match alone can never produce a definitive criminal or malicious verdict. Cairnwise mandates human analyst governance with cited evidence and counterevidence before any response is dispatched.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[rgba(236,233,223,0.08)] bg-[rgba(14,20,17,0.8)] flex items-center justify-between text-xs font-mono text-[#69756d]">
          <span>Authority: SOLUTION.md Non-negotiable Truth Constraints</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-mono font-medium text-[#ece9df] bg-[rgba(236,233,223,0.08)] hover:bg-[rgba(236,233,223,0.12)] transition-all"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
}
