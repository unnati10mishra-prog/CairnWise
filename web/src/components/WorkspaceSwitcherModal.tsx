'use client';

import React from 'react';
import { 
  X, 
  Building2, 
  Check, 
  ChevronRight, 
  Globe, 
  Shield, 
  Lock,
  Layers
} from 'lucide-react';

interface WorkspaceSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBrand: {
    id: string;
    name: string;
    locale: string;
    website?: string;
  };
  onSelectWorkspace: (workspace: {
    id: string;
    name: string;
    canonical_name: string;
    locale: string;
    website: string;
    regions: string[];
    registered_at: string;
  }) => void;
}

export function WorkspaceSwitcherModal({
  isOpen,
  onClose,
  currentBrand,
  onSelectWorkspace,
}: WorkspaceSwitcherModalProps) {
  if (!isOpen) return null;

  const WORKSPACES = [
    {
      id: 'brand_northstar_01',
      name: 'Northstar Pay',
      canonical_name: 'northstar pay',
      locale: 'en-IN',
      website: 'https://northstar.pay.example',
      regions: ['IN', 'SG', 'EU'],
      registered_at: '2026-01-15T08:00:00Z',
      environment: 'Production Primary',
      protectedAssetsCount: 4,
    },
    {
      id: 'brand_apex_02',
      name: 'Apex Global Financial',
      canonical_name: 'apex global financial',
      locale: 'en-US',
      website: 'https://apex.financial.example',
      regions: ['US', 'CA', 'UK'],
      registered_at: '2026-02-10T12:00:00Z',
      environment: 'Sandbox Evaluation',
      protectedAssetsCount: 3,
    },
    {
      id: 'brand_sol_03',
      name: 'Sol Identity & Governance',
      canonical_name: 'sol identity',
      locale: 'en-GB',
      website: 'https://sol-identity.example',
      regions: ['GB', 'EU'],
      registered_at: '2026-03-01T09:30:00Z',
      environment: 'Staging Audit',
      protectedAssetsCount: 5,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#0c100e] border border-[rgba(236,233,223,0.12)] rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[rgba(236,233,223,0.08)] bg-[rgba(14,20,17,0.8)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[rgba(216,245,123,0.1)] border border-[rgba(216,245,123,0.25)] flex items-center justify-center text-[#d8f57b]">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-serif)' }} className="text-lg font-normal text-[#f2efe7]">
                Switch Enterprise Workspace
              </h2>
              <p className="text-xs text-[#9ba69e] mt-0.5">
                Select protected brand profile and registration authority.
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

        {/* Workspaces List */}
        <div className="p-6 space-y-3">
          {WORKSPACES.map((ws) => {
            const isSelected = ws.id === currentBrand.id || ws.name.toLowerCase() === currentBrand.name.toLowerCase();
            return (
              <button
                key={ws.id}
                onClick={() => {
                  onSelectWorkspace({
                    id: ws.id,
                    name: ws.name,
                    canonical_name: ws.canonical_name,
                    locale: ws.locale,
                    website: ws.website,
                    regions: ws.regions,
                    registered_at: ws.registered_at,
                  });
                  onClose();
                }}
                className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between group cursor-pointer ${
                  isSelected
                    ? 'bg-[rgba(216,245,123,0.08)] border-[rgba(216,245,123,0.3)] shadow-[0_0_16px_rgba(216,245,123,0.08)]'
                    : 'bg-[rgba(14,20,17,0.6)] border-[rgba(236,233,223,0.06)] hover:border-[rgba(236,233,223,0.15)] hover:bg-[rgba(14,20,17,0.9)]'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    isSelected
                      ? 'bg-[#84cc16] text-[#0d140e] font-bold'
                      : 'bg-[rgba(236,233,223,0.06)] text-[#9ba69e]'
                  }`}>
                    {ws.name.slice(0, 1)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#f2efe7] group-hover:text-[#d8f57b] transition-colors">
                        {ws.name}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[rgba(236,233,223,0.06)] text-[#9ba69e]">
                        {ws.locale}
                      </span>
                    </div>
                    <div className="text-xs text-[#9ba69e] mt-1 font-mono flex items-center gap-2">
                      <span>{ws.environment}</span>
                      <span>&bull;</span>
                      <span>{ws.protectedAssetsCount} Protected Assets</span>
                    </div>
                  </div>
                </div>

                {isSelected ? (
                  <div className="w-6 h-6 rounded-full bg-[#84cc16] text-[#0d140e] flex items-center justify-center flex-shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                ) : (
                  <ChevronRight className="w-4 h-4 text-[#69756d] group-hover:text-[#ece9df] transition-colors" />
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[rgba(236,233,223,0.08)] bg-[rgba(14,20,17,0.8)] text-xs text-[#69756d] flex items-center justify-between">
          <span>Role: Master Security Administrator</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-mono text-[#ece9df] bg-[rgba(236,233,223,0.06)] hover:bg-[rgba(236,233,223,0.1)] transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
