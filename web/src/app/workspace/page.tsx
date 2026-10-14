'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BrandLogo } from '@/components/BrandLogo';
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
  UserCheck
} from 'lucide-react';

const QUEUE_ITEMS = [
  {
    id: 'CW-INC-001',
    target: '@northstar_official',
    entity: 'Instagram Profile',
    threat: 'VIP Impersonation & Phishing Bio',
    riskScore: 0.94,
    status: 'TRIAGED',
    visualMatch: 98,
    lexicalScore: 92,
    infraFlag: true,
    lastUpdated: '12m ago',
  },
  {
    id: 'CW-INC-002',
    target: 'pay-northstar-direct.apk',
    entity: 'Android Application Package',
    threat: 'Trojanized Payment Interceptor',
    riskScore: 0.89,
    status: 'ESCALATED',
    visualMatch: 86,
    lexicalScore: 96,
    infraFlag: true,
    lastUpdated: '42m ago',
  },
  {
    id: 'CW-INC-003',
    target: 't.me/northstar_vip_trading',
    entity: 'Telegram Community Channel',
    threat: 'Credential Harvesting Group',
    riskScore: 0.77,
    status: 'IN REVIEW',
    visualMatch: 74,
    lexicalScore: 88,
    infraFlag: false,
    lastUpdated: '1h ago',
  },
  {
    id: 'CW-INC-004',
    target: '@northstar_customercare',
    entity: 'X (Twitter) Support Bot',
    threat: 'Automated Account Recovery Scam',
    riskScore: 0.82,
    status: 'TRIAGED',
    visualMatch: 91,
    lexicalScore: 90,
    infraFlag: true,
    lastUpdated: '3h ago',
  },
];

export default function WorkspacePage() {
  const router = useRouter();
  const { user, signOut, loading, isConfigured } = useAuth();
  const [selectedIncident, setSelectedIncident] = useState(QUEUE_ITEMS[0]);
  const [verdictNotice, setVerdictNotice] = useState<string | null>(null);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const handleAction = (action: string) => {
    setVerdictNotice(`Verdict [${action}] cryptographically recorded for ${selectedIncident.id} by ${user?.email || 'operator'}.`);
    setTimeout(() => {
      setVerdictNotice(null);
    }, 4500);
  };

  return (
    <div className="min-h-screen bg-[#080a0a] text-[#f2efe7] flex flex-col">
      {/* Top Console Navigation Bar */}
      <header className="h-16 px-6 border-b border-[rgba(236,233,223,0.1)] bg-[rgba(10,13,12,0.9)] backdrop-blur-md flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-6">
          <BrandLogo size="sm" />
          <div className="h-4 w-[1px] bg-[rgba(236,233,223,0.15)]" />
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#d8f57b] animate-pulse" />
            <span className="text-xs font-mono text-[#d8f57b] uppercase tracking-wider">
              Console Active
            </span>
          </div>
        </div>

        {/* Right User Bar */}
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-medium text-[#f2efe7] flex items-center justify-end gap-1.5">
                  <span>{user.fullName || user.email}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[rgba(216,245,123,0.1)] text-[#d8f57b] border border-[rgba(216,245,123,0.25)]">
                    {user.role?.toUpperCase() || 'ANALYST'}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-[#69756d]">
                  {user.organization || 'Enterprise Security'} &bull; {user.email}
                </div>
              </div>

              <button
                onClick={handleSignOut}
                className="cairn-btn cairn-btn-secondary h-8 px-3 text-xs flex items-center gap-1.5 hover:text-[#ef8c8c] hover:border-[#ef8c8c]"
                title="Sign out of console"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#9ba69e]">Preview Session</span>
              <Link
                href="/login"
                className="cairn-btn cairn-btn-primary h-8 px-3 text-xs"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Main Operator Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {/* Notice Banner */}
        {verdictNotice && (
          <div className="cairn-alert cairn-alert-info">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-[#d8f57b]" />
            <div className="text-xs font-mono">
              <strong>Ledger Update:</strong> {verdictNotice}
            </div>
          </div>
        )}

        {/* Workspace Headline */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[rgba(236,233,223,0.08)]">
          <div>
            <h1 
              style={{ fontFamily: 'var(--font-serif)' }}
              className="text-2xl sm:text-3xl font-normal text-[#f2efe7]"
            >
              Identity Risk Incident Queue
            </h1>
            <p className="text-xs text-[#9ba69e] mt-1">
              Active look-alike detections prioritized by multi-modal evidence confidence.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-3 py-1.5 rounded bg-[rgba(14,20,17,0.7)] border border-[rgba(236,233,223,0.12)] text-[#9ba69e]">
              Supabase Status: <strong className="text-[#d8f57b]">{isConfigured ? 'Connected' : 'Preview Demo'}</strong>
            </span>
          </div>
        </div>

        {/* 2-Column Split: Queue on Left, Forensic Inspector on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
          {/* Incident List (Left 7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs text-[#69756d] font-mono px-1">
              <span>ACTIVE INCIDENTS ({QUEUE_ITEMS.length})</span>
              <span>SORTED BY RISK SCORE</span>
            </div>

            <div className="space-y-2.5">
              {QUEUE_ITEMS.map((item) => {
                const isSelected = selectedIncident.id === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedIncident(item)}
                    className={`w-full text-left p-4 rounded-lg transition-all border ${
                      isSelected
                        ? 'bg-[rgba(216,245,123,0.08)] border-[#d8f57b] shadow-[0_4px_20px_rgba(0,0,0,0.4)]'
                        : 'bg-[rgba(14,20,17,0.6)] border-[rgba(236,233,223,0.08)] hover:border-[rgba(236,233,223,0.2)]'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[rgba(236,233,223,0.06)] text-[#9ba69e]">
                            {item.id}
                          </span>
                          <span className="text-xs text-[#69756d]">{item.entity}</span>
                        </div>
                        <div className="text-sm font-mono font-medium text-[#f2efe7]">
                          {item.target}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono font-medium ${
                          item.riskScore >= 0.9 
                            ? 'bg-[rgba(239,140,140,0.15)] text-[#ef8c8c] border border-[rgba(239,140,140,0.3)]'
                            : 'bg-[rgba(233,173,113,0.15)] text-[#e9ad71] border border-[rgba(233,173,113,0.3)]'
                        }`}>
                          {(item.riskScore * 100).toFixed(0)}% RISK
                        </span>
                        <div className="text-[10px] font-mono text-[#69756d] mt-1">{item.lastUpdated}</div>
                      </div>
                    </div>

                    <div className="text-xs text-[#9ba69e] line-clamp-1 mb-2">
                      {item.threat}
                    </div>

                    {/* Progress meters */}
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[rgba(236,233,223,0.06)] text-[10px] font-mono text-[#69756d]">
                      <div>Visual Cosine: <strong className="text-[#d8f57b]">{item.visualMatch}%</strong></div>
                      <div>Lexical Distance: <strong className="text-[#9cc4d9]">{item.lexicalScore}%</strong></div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Forensic Evidence Inspector (Right 5 cols) */}
          <div className="lg:col-span-5">
            <div className="glass-panel-elevated p-6 sticky top-24">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-[rgba(236,233,223,0.08)]">
                <span className="text-xs font-mono text-[#d8f57b] uppercase tracking-wider flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" />
                  <span>Forensic Evidence Dossier</span>
                </span>
                <span className="text-[11px] font-mono text-[#69756d]">{selectedIncident.id}</span>
              </div>

              <h3 
                style={{ fontFamily: 'var(--font-serif)' }}
                className="text-xl font-normal text-[#f2efe7] mb-1"
              >
                {selectedIncident.target}
              </h3>
              <p className="text-xs text-[#9ba69e] mb-4">
                {selectedIncident.threat}
              </p>

              {/* Forensic Details List */}
              <div className="space-y-3 p-3.5 rounded bg-[rgba(8,10,10,0.7)] border border-[rgba(236,233,223,0.08)] mb-6 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-[#69756d]">Entity Type:</span>
                  <span className="text-[#f2efe7]">{selectedIncident.entity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#69756d]">Visual Brand Match:</span>
                  <span className="text-[#d8f57b] font-medium">{selectedIncident.visualMatch}% Cosine</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#69756d]">Homoglyph Distance:</span>
                  <span className="text-[#9cc4d9] font-medium">{selectedIncident.lexicalScore}% Levenshtein</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#69756d]">Infrastructure ASN:</span>
                  <span className="text-[#e9ad71] font-medium">Flagged Proxy Network</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[rgba(236,233,223,0.08)]">
                  <span className="text-[#69756d]">Cryptographic Proof:</span>
                  <span className="text-[#d8f57b]">SHA256: d91a...37f0</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  onClick={() => handleAction('TAKEDOWN AUTHORIZED')}
                  className="cairn-btn cairn-btn-primary w-full h-11 text-xs font-semibold"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Authorize Cryptographic Takedown Notice</span>
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleAction('ESCALATED TO LEGAL')}
                    className="cairn-btn cairn-btn-secondary h-10 text-xs"
                  >
                    Escalate to Legal
                  </button>
                  <button
                    onClick={() => handleAction('MONITORING MODE')}
                    className="cairn-btn cairn-btn-ghost h-10 text-xs border border-[rgba(236,233,223,0.12)]"
                  >
                    Monitor Passively
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-[rgba(236,233,223,0.08)] flex items-center justify-between text-[11px] font-mono text-[#69756d]">
                <span>Operator: {user?.role || 'analyst'}</span>
                <span>Audit trail logged</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
