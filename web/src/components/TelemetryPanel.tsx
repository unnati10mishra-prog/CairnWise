'use client';

import React, { useState } from 'react';

interface CaseItem {
  id: string;
  title: string;
  source: string;
  time: string;
  type: string;
  priority: string;
  width: string;
  bulletClass: string;
  description: string;
}

const CASES: Record<string, CaseItem> = {
  social: {
    id: 'social',
    title: 'Northstar Pay Support',
    source: 'Social profile',
    time: '18 min ago',
    type: 'Review required',
    priority: '0.62',
    width: '62%',
    bulletClass: 'warm',
    description: 'Resembles the official baseline. Stable ID is not registered; destination still needs verification.',
  },
  app: {
    id: 'app',
    title: 'Northstar Pay Secure',
    source: 'App listing',
    time: '42 min ago',
    type: 'Insufficient evidence',
    priority: '0.51',
    width: '51%',
    bulletClass: '',
    description: 'Title and icon are visually similar. Publisher differs from the official record; listing metadata is incomplete.',
  },
  partner: {
    id: 'partner',
    title: 'Northstar Rewards EU',
    source: 'Partner exception',
    time: '1 h ago',
    type: 'Scope review',
    priority: '0.28',
    width: '28%',
    bulletClass: 'cool',
    description: 'Known partner relationship is present, but the regional approval scope expired and needs a fresh review.',
  },
};

export function TelemetryPanel() {
  const [selectedCase, setSelectedCase] = useState<string>('social');
  const [activeTab, setActiveTab] = useState<'queue' | 'registry' | 'coverage'>('queue');

  const current = CASES[selectedCase] || CASES.social;

  return (
    <div className="auth-telemetry-column">
      {/* Editorial Backdrop Caption */}
      <div className="telemetry-editorial-header">
        <div className="telemetry-kicker">
          <span className="pulse-dot" />
          <span>Interactive Risk Intelligence Console</span>
        </div>
        <p className="telemetry-quote">
          &ldquo;When an identity signal appears, the question is not <em>does this look familiar?</em> It is <em>what was observed, what is authorized, and what is missing?</em>&rdquo;
        </p>
      </div>

      {/* The Iconic Cairnwise 3D Product Console */}
      <div className="console-stage is-in-view">
        <div className="console-halo" aria-hidden="true" />

        <div className="product-console" role="region" aria-label="Cairnwise Interactive Console">
          {/* Top Window Bar */}
          <div className="console-bar">
            <div className="window-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <span className="console-bar-title font-mono">CAIRNWISE / NORTHSTAR PAY</span>
            <span className="console-live font-mono">
              <i className="pulse-dot" />
              <span>LIVE OPS TELEMETRY</span>
            </span>
          </div>

          {/* Prototype / Stage Disclosure */}
          <div className="preview-disclosure font-mono">
            <strong>Operator Terminal</strong>
            <span>4-dimensional signal triangulation · active ledger</span>
          </div>

          {/* Console Body Layout */}
          <div className="console-layout">
            {/* Left Micro Rail */}
            <aside className="console-rail">
              <div className="rail-mark font-serif">cw</div>
              <button
                type="button"
                onClick={() => setActiveTab('queue')}
                className={`rail-button ${activeTab === 'queue' ? 'active' : ''}`}
                title="Review Queue"
              >
                ⌁
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('registry')}
                className={`rail-button ${activeTab === 'registry' ? 'active' : ''}`}
                title="Identity Registry"
              >
                ◇
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('coverage')}
                className={`rail-button ${activeTab === 'coverage' ? 'active' : ''}`}
                title="Coverage Graph"
              >
                ◌
              </button>
              <span className="rail-spacer" />
              <span className="rail-version font-mono">v0.1</span>
            </aside>

            {/* Main Console Content */}
            <div className="console-main">
              {/* Heading */}
              <div className="console-heading">
                <div>
                  <span className="console-kicker font-mono">Tuesday &bull; 14 October 2026</span>
                  <h2 className="font-serif">Command center</h2>
                </div>
                <span className="console-search font-mono">
                  ⌕ Quick find <kbd className="font-mono">⌘ K</kbd>
                </span>
              </div>

              {/* Metrics Row */}
              <div className="console-metrics">
                <div>
                  <span className="font-mono">Active queue</span>
                  <strong className="font-serif">08</strong>
                  <small>triaged signals</small>
                </div>
                <div>
                  <span className="font-mono">Evidence ready</span>
                  <strong className="font-serif text-[#d8f57b]">94%</strong>
                  <small>multi-modal proof</small>
                </div>
                <div>
                  <span className="font-mono">Source state</span>
                  <strong className="font-serif green">01</strong>
                  <small>verified baseline</small>
                </div>
              </div>

              {/* 2-Column Grid: Queue on Left, Inspector on Right */}
              <div className="console-grid">
                {/* Queue Panel */}
                <div className="queue-panel">
                  <div className="console-panel-head font-mono">
                    <span>Incident queue</span>
                    <span>Triage priority</span>
                  </div>
                  <div className="console-rows">
                    <button
                      type="button"
                      onClick={() => setSelectedCase('social')}
                      className={`console-case ${selectedCase === 'social' ? 'selected' : ''}`}
                    >
                      <span className="case-bullet warm" />
                      <span>
                        <b>Northstar Pay Support</b>
                        <small>Social · name + avatar</small>
                      </span>
                      <em>0.62</em>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedCase('app')}
                      className={`console-case ${selectedCase === 'app' ? 'selected' : ''}`}
                    >
                      <span className="case-bullet" />
                      <span>
                        <b>Northstar Pay Secure</b>
                        <small>App · publisher conflict</small>
                      </span>
                      <em>0.51</em>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedCase('partner')}
                      className={`console-case ${selectedCase === 'partner' ? 'selected' : ''}`}
                    >
                      <span className="case-bullet cool" />
                      <span>
                        <b>Northstar Rewards EU</b>
                        <small>Partner · scope expired</small>
                      </span>
                      <em>0.28</em>
                    </button>
                  </div>
                  <div className="console-panel-foot font-mono">
                    <span>Showing 3 of 8 items</span>
                    <span className="text-[#d8f57b]">Queue →</span>
                  </div>
                </div>

                {/* Inspector Panel */}
                <div className="inspector-panel">
                  <div className="console-panel-head font-mono">
                    <span>Selected finding</span>
                    <span className="text-[#9ba69e]">{current.time}</span>
                  </div>

                  <div className="inspector-status">
                    <span className={`status ${current.bulletClass === 'warm' ? 'warm' : current.bulletClass === 'cool' ? 'cool' : ''}`}>
                      {current.type}
                    </span>
                    <span className="font-mono text-[10px] text-[#69756d]">{current.source}</span>
                  </div>

                  <h3 className="font-serif">{current.title}</h3>
                  <p>{current.description}</p>

                  <div className="inspector-meter">
                    <div>
                      <span className="font-mono">Queue priority</span>
                      <b className="font-mono text-[#d8f57b]">{current.priority}</b>
                    </div>
                    <i>
                      <span style={{ width: current.width }} />
                    </i>
                  </div>

                  <div className="inspector-button font-mono">
                    <span>View evidence dossier</span>
                    <span className="text-[#d8f57b]">↗</span>
                  </div>
                </div>
              </div>

              {/* Console Footer */}
              <div className="console-footer font-mono">
                <span>
                  <i className="pulse-dot" /> Source mode · SHA-256 Ledger
                </span>
                <span>All actions cryptographically logged</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Proof Strip */}
      <div className="telemetry-proof-strip font-mono">
        <div>
          <span>01 / IDENTIFIERS</span>
          <strong>Baseline Verified</strong>
        </div>
        <div>
          <span>02 / RECOG</span>
          <strong>Cosine Sim 98%</strong>
        </div>
        <div>
          <span>03 / GOVERNANCE</span>
          <strong>Supabase RLS</strong>
        </div>
      </div>
    </div>
  );
}
