'use client';

import React from 'react';
import { 
  X, 
  UserCheck, 
  Key, 
  Shield, 
  LogOut, 
  Award, 
  Clock, 
  Lock,
  Terminal,
  CheckCircle2
} from 'lucide-react';

interface AnalystProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  onSignOut: () => void;
}

export function AnalystProfileModal({
  isOpen,
  onClose,
  email,
  onSignOut,
}: AnalystProfileModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-[#0c100e] border border-[rgba(236,233,223,0.12)] rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[rgba(236,233,223,0.08)] bg-[rgba(14,20,17,0.8)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1b221d] border border-[rgba(236,233,223,0.15)] flex items-center justify-center text-sm font-mono font-medium text-[#d8f57b]">
              EV
            </div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-serif)' }} className="text-base font-normal text-[#f2efe7]">
                Elena Vance
              </h2>
              <span className="text-[11px] font-mono text-[#69756d]">
                Lead Forensic Analyst &bull; L3 Investigator
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#9ba69e] hover:text-[#ece9df] hover:bg-[rgba(236,233,223,0.06)] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Credentials Body */}
        <div className="p-6 space-y-4 text-xs font-mono">
          <div className="p-3.5 rounded-xl bg-[rgba(14,20,17,0.7)] border border-[rgba(236,233,223,0.06)] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[#69756d]">AUTHENTICATED IDENTITY:</span>
              <span className="text-[#ece9df] truncate max-w-[200px]">{email || 'elena.vance@northstar.security'}</span>
            </div>
            <div className="flex items-center justify-between border-t border-[rgba(236,233,223,0.04)] pt-2">
              <span className="text-[#69756d]">CLEARANCE LEVEL:</span>
              <span className="text-[#d8f57b] font-semibold">Tier-1 Apex Governance</span>
            </div>
            <div className="flex items-center justify-between border-t border-[rgba(236,233,223,0.04)] pt-2">
              <span className="text-[#69756d]">EVIDENCE QUALIFICATION:</span>
              <span className="text-[#6ee7b7]">ISO/IEC 27037 Certified</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[rgba(14,20,17,0.7)] border border-[rgba(236,233,223,0.06)] space-y-2">
            <div className="flex items-center gap-1.5 text-[#d8f57b]">
              <Key className="w-3.5 h-3.5" />
              <span className="font-semibold">Sovereign Ed25519 Signing Key:</span>
            </div>
            <div className="p-2 rounded bg-[rgba(10,14,12,0.9)] text-[10px] text-[#9ba69e] break-all border border-[rgba(236,233,223,0.04)]">
              ed25519:8f3c:2a11:9b04:77e1:002a:c881:e942:5501:33b2
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[rgba(110,231,183,0.05)] border border-[rgba(110,231,183,0.2)] text-[11px] text-[#6ee7b7] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>Hardware Token Security Key (FIPS 140-3) Active</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-[rgba(236,233,223,0.08)] bg-[rgba(14,20,17,0.8)] flex items-center justify-between">
          <button
            onClick={() => {
              onSignOut();
              onClose();
            }}
            className="px-3.5 py-1.5 rounded-lg text-xs font-mono text-[#ef8c8c] hover:bg-[rgba(239,140,140,0.1)] border border-[rgba(239,140,140,0.25)] transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-mono text-[#ece9df] bg-[rgba(236,233,223,0.06)] hover:bg-[rgba(236,233,223,0.12)] transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
