'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Terminal, 
  Compass, 
  Database, 
  ShieldAlert, 
  Radio, 
  Sliders, 
  Scale, 
  Printer, 
  Send, 
  Download, 
  RefreshCw, 
  Volume2, 
  VolumeX, 
  X,
  ArrowRight,
  Sparkles
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: 'overview' | 'registry' | 'queue' | 'coverage' | 'simulator' | 'audit') => void;
  onRunFixture: (fixture: string) => void;
  onQuickDecision?: (decision: string) => void;
  onOpenCertificate?: () => void;
  onOpenTakedown?: () => void;
  onExportDossier?: () => void;
  onToggleAudio?: () => void;
  audioEnabled?: boolean;
}

interface CommandItem {
  id: string;
  category: 'Navigation' | 'Triage & Disposition' | 'Forensics & Proof' | 'System & Controls';
  title: string;
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  onNavigateTab,
  onRunFixture,
  onQuickDecision,
  onOpenCertificate,
  onOpenTakedown,
  onExportDossier,
  onToggleAudio,
  audioEnabled = true,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const commands: CommandItem[] = useMemo(() => [
    // Navigation
    {
      id: 'nav-overview',
      category: 'Navigation',
      title: 'Go to Overview & 7-Phase Triage Loop',
      shortcut: '1',
      icon: <Compass className="w-4 h-4 text-[#d8f57b]" />,
      action: () => { onNavigateTab('overview'); onClose(); },
    },
    {
      id: 'nav-registry',
      category: 'Navigation',
      title: 'Go to Official Identity Registry',
      shortcut: '2',
      icon: <Database className="w-4 h-4 text-[#9cc4d9]" />,
      action: () => { onNavigateTab('registry'); onClose(); },
    },
    {
      id: 'nav-queue',
      category: 'Navigation',
      title: 'Go to 4D Review Queue & Inspector',
      shortcut: '3',
      icon: <ShieldAlert className="w-4 h-4 text-[#e9ad71]" />,
      action: () => { onNavigateTab('queue'); onClose(); },
    },
    {
      id: 'nav-coverage',
      category: 'Navigation',
      title: 'Go to Coverage Contract & Ingestion Matrix',
      shortcut: '4',
      icon: <Radio className="w-4 h-4 text-[#d8f57b]" />,
      action: () => { onNavigateTab('coverage'); onClose(); },
    },
    {
      id: 'nav-simulator',
      category: 'Navigation',
      title: 'Go to Look-alike & Homoglyph Simulator',
      shortcut: '5',
      icon: <Sliders className="w-4 h-4 text-[#d8f57b]" />,
      action: () => { onNavigateTab('simulator'); onClose(); },
    },
    {
      id: 'nav-audit',
      category: 'Navigation',
      title: 'Go to Merkle Proof Ledger & Audits',
      shortcut: '6',
      icon: <Scale className="w-4 h-4 text-[#d8f57b]" />,
      action: () => { onNavigateTab('audit'); onClose(); },
    },

    // Triage & Dispositions
    {
      id: 'disp-investigate',
      category: 'Triage & Disposition',
      title: 'Mark Active Case: Investigate (High Risk Triage)',
      shortcut: 'I',
      icon: <Search className="w-4 h-4 text-[#e9ad71]" />,
      action: () => { onQuickDecision?.('investigate'); onClose(); },
    },
    {
      id: 'disp-confirm',
      category: 'Triage & Disposition',
      title: 'Mark Active Case: Confirm Impersonation Under Policy',
      shortcut: 'C',
      icon: <ShieldAlert className="w-4 h-4 text-[#ef8c8c]" />,
      action: () => { onQuickDecision?.('confirmed_impersonation_under_policy'); onClose(); },
    },
    {
      id: 'disp-monitor',
      category: 'Triage & Disposition',
      title: 'Mark Active Case: Monitor Only (Non-Urgent)',
      shortcut: 'M',
      icon: <Terminal className="w-4 h-4 text-[#ece9df]" />,
      action: () => { onQuickDecision?.('monitor'); onClose(); },
    },
    {
      id: 'disp-insufficient',
      category: 'Triage & Disposition',
      title: 'Mark Active Case: Insufficient Evidence (Truth Boundary)',
      shortcut: 'E',
      icon: <Scale className="w-4 h-4 text-[#9ba69e]" />,
      action: () => { onQuickDecision?.('insufficient_evidence'); onClose(); },
    },

    // Forensics & Proof
    {
      id: 'cert-print',
      category: 'Forensics & Proof',
      title: 'Open ISO/IEC 27037 Court Admissibility Certificate',
      shortcut: 'P',
      icon: <Printer className="w-4 h-4 text-[#9cc4d9]" />,
      action: () => { onOpenCertificate?.(); onClose(); },
    },
    {
      id: 'takedown-notice',
      category: 'Forensics & Proof',
      title: 'Generate Multi-Platform Legal Takedown Notice',
      shortcut: 'T',
      icon: <Send className="w-4 h-4 text-[#e9ad71]" />,
      action: () => { onOpenTakedown?.(); onClose(); },
    },
    {
      id: 'export-dossier',
      category: 'Forensics & Proof',
      title: 'Export Cryptographic Proof Dossier (JSON Package)',
      shortcut: 'D',
      icon: <Download className="w-4 h-4 text-[#d8f57b]" />,
      action: () => { onExportDossier?.(); onClose(); },
    },

    // System & Controls
    {
      id: 'fix-social',
      category: 'System & Controls',
      title: 'Run Fixture: social.lookalike (Northstar Support)',
      icon: <Sparkles className="w-4 h-4 text-[#e9ad71]" />,
      action: () => { onRunFixture('social.lookalike'); onClose(); },
    },
    {
      id: 'fix-app',
      category: 'System & Controls',
      title: 'Run Fixture: app.lookalike (Apex Digital Labs Trojan)',
      icon: <Sparkles className="w-4 h-4 text-[#ef8c8c]" />,
      action: () => { onRunFixture('app.lookalike'); onClose(); },
    },
    {
      id: 'fix-outage',
      category: 'System & Controls',
      title: 'Simulate Source Outage (Truth Boundary Check)',
      icon: <Radio className="w-4 h-4 text-[#ef8c8c]" />,
      action: () => { onRunFixture('source.outage'); onClose(); },
    },
    {
      id: 'toggle-audio',
      category: 'System & Controls',
      title: audioEnabled ? 'Mute Tactical Web Audio Synthesizer' : 'Enable Tactical Web Audio Synthesizer',
      shortcut: 'A',
      icon: audioEnabled ? <VolumeX className="w-4 h-4 text-[#69756d]" /> : <Volume2 className="w-4 h-4 text-[#d8f57b]" />,
      action: () => { onToggleAudio?.(); onClose(); },
    },
  ], [onNavigateTab, onRunFixture, onQuickDecision, onOpenCertificate, onOpenTakedown, onExportDossier, onToggleAudio, audioEnabled, onClose]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const lower = query.toLowerCase();
    return commands.filter(c => 
      c.title.toLowerCase().includes(lower) || 
      c.category.toLowerCase().includes(lower)
    );
  }, [commands, query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-xl rounded-2xl bg-[#090d0b] border border-[rgba(216,245,123,0.35)] shadow-[0_25px_80px_rgba(0,0,0,0.95)] overflow-hidden font-mono text-xs">
        
        {/* Search Input Bar */}
        <div className="p-4 border-b border-[rgba(236,233,223,0.1)] flex items-center gap-3 bg-[rgba(14,20,17,0.7)]">
          <Terminal className="w-4 h-4 text-[#d8f57b]" />
          <input
            type="text"
            autoFocus
            placeholder="Type a command, phase, or shortcut..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-[#ece9df] placeholder-[#69756d] focus:outline-none"
          />
          <kbd className="px-2 py-0.5 rounded bg-[rgba(236,233,223,0.08)] text-[10px] text-[#9ba69e] border border-[rgba(236,233,223,0.12)]">
            ESC
          </kbd>
        </div>

        {/* Command List Results */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center text-[#69756d]">
              No command matching &ldquo;{query}&rdquo;
            </div>
          ) : (
            filteredCommands.map((item) => (
              <button
                key={item.id}
                onClick={item.action}
                className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-[rgba(216,245,123,0.08)] hover:text-[#d8f57b] text-[#ece9df] transition-all group text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="p-1.5 rounded bg-[rgba(236,233,223,0.04)] group-hover:bg-[rgba(216,245,123,0.15)] transition-colors">
                    {item.icon}
                  </span>
                  <div>
                    <div className="font-medium">{item.title}</div>
                    <div className="text-[10px] text-[#69756d]">{item.category}</div>
                  </div>
                </div>

                {item.shortcut && (
                  <kbd className="px-2 py-0.5 rounded bg-[rgba(236,233,223,0.06)] group-hover:bg-[rgba(216,245,123,0.2)] text-[10px] text-[#9ba69e] group-hover:text-[#d8f57b] border border-[rgba(236,233,223,0.1)]">
                    {item.shortcut}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer Hints */}
        <div className="p-3 border-t border-[rgba(236,233,223,0.06)] bg-[rgba(7,9,8,0.9)] flex items-center justify-between text-[10.5px] text-[#69756d]">
          <span>Navigation: <strong className="text-[#ece9df]">1-6</strong> &bull; Dispositions: <strong className="text-[#ece9df]">M / I / C / E</strong></span>
          <span>Cairnwise Apex Console</span>
        </div>
      </div>
    </div>
  );
}
