'use client';

import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle, ShieldAlert, Sparkles, ArrowRight, EyeOff, Globe2, ShieldX } from 'lucide-react';

interface HomoglyphInspectorProps {
  candidateText: string;
  baselineText: string;
  onFeedIntoQueue?: (finding: {
    displayName: string;
    verdict: string;
    homoglyphsFound: number;
    resemblance: number;
  }) => void;
}

// Cyrillic and Greek confusables mapping to Latin
const HOMOGLYPH_MAP: Record<string, { latin: string; name: string }> = {
  '\u0430': { latin: 'a', name: 'Cyrillic Small Letter A' },
  '\u0410': { latin: 'A', name: 'Cyrillic Capital Letter A' },
  '\u0441': { latin: 'c', name: 'Cyrillic Small Letter Es' },
  '\u0421': { latin: 'C', name: 'Cyrillic Capital Letter Es' },
  '\u0435': { latin: 'e', name: 'Cyrillic Small Letter Ie' },
  '\u0415': { latin: 'E', name: 'Cyrillic Capital Letter Ie' },
  '\u0456': { latin: 'i', name: 'Cyrillic Small Letter Byelorussian-Ukrainian I' },
  '\u0406': { latin: 'I', name: 'Cyrillic Capital Letter Byelorussian-Ukrainian I' },
  '\u0458': { latin: 'j', name: 'Cyrillic Small Letter Je' },
  '\u0440': { latin: 'p', name: 'Cyrillic Small Letter Er' },
  '\u0420': { latin: 'P', name: 'Cyrillic Capital Letter Er' },
  '\u043E': { latin: 'o', name: 'Cyrillic Small Letter O' },
  '\u041E': { latin: 'O', name: 'Cyrillic Capital Letter O' },
  '\u0455': { latin: 's', name: 'Cyrillic Small Letter Dze' },
  '\u0443': { latin: 'y', name: 'Cyrillic Small Letter U' },
  '\u0445': { latin: 'x', name: 'Cyrillic Small Letter Ha' },
  '\u0425': { latin: 'X', name: 'Cyrillic Capital Letter Ha' },
};

// Zero-width and invisible character evasion vectors
const INVISIBLE_MAP: Record<string, { label: string; name: string; severity: 'high' | 'critical' }> = {
  '\u200B': { label: 'ZWSP', name: 'Zero-Width Space', severity: 'high' },
  '\u200C': { label: 'ZWNJ', name: 'Zero-Width Non-Joiner', severity: 'high' },
  '\u200D': { label: 'ZWJ', name: 'Zero-Width Joiner', severity: 'high' },
  '\u00AD': { label: 'SHY', name: 'Soft Hyphen', severity: 'high' },
  '\u200E': { label: 'LRM', name: 'Left-to-Right Mark', severity: 'high' },
  '\u200F': { label: 'RLM', name: 'Right-to-Left Mark', severity: 'high' },
  '\u202A': { label: 'LRE', name: 'Left-to-Right Embedding', severity: 'high' },
  '\u202E': { label: 'RLO', name: 'Right-to-Left Override (File Extension Evasion)', severity: 'critical' },
  '\uFEFF': { label: 'BOM', name: 'Zero-Width No-Break Space (Byte Order Mark)', severity: 'high' },
};

// Common leetspeak substitutions
const LEET_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'l',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '8': 'b',
  '@': 'a',
  '$': 's',
};

const HIGH_RISK_KEYWORDS = [
  'support', 'help', 'emergency', 'verify', 'verification',
  'official', 'security', 'desk', 'care', 'update', 'login', 'portal'
];

export function HomoglyphInspector({
  candidateText,
  baselineText,
  onFeedIntoQueue,
}: HomoglyphInspectorProps) {
  // Deconstruct candidate characters
  const analysis = useMemo(() => {
    const chars = Array.from(candidateText);
    const baseNormalized = baselineText.toLowerCase().replace(/[^a-z0-9]/g, '');
    const candidateNormalized = candidateText.toLowerCase().replace(/[^a-z0-9]/g, '');

    let homoglyphCount = 0;
    let leetCount = 0;
    let invisibleCount = 0;

    const charDetails = chars.map((ch, idx) => {
      const codePoint = 'U+' + (ch.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0') || '0000');
      const homoglyph = HOMOGLYPH_MAP[ch];
      const invisible = INVISIBLE_MAP[ch];
      const leet = LEET_MAP[ch];

      let status: 'clean' | 'homoglyph' | 'invisible' | 'leet' | 'whitespace' | 'symbol' = 'clean';
      let description = 'Latin / Standard Character';

      if (invisible) {
        status = 'invisible';
        invisibleCount++;
        description = `CRITICAL EVASION: ${invisible.name} (${invisible.label}) [${invisible.severity.toUpperCase()}]`;
      } else if (homoglyph) {
        status = 'homoglyph';
        homoglyphCount++;
        description = `Spoofed: ${homoglyph.name} (visually identical to Latin '${homoglyph.latin}')`;
      } else if (leet) {
        status = 'leet';
        leetCount++;
        description = `Leetspeak substitution for '${leet}'`;
      } else if (/\s/.test(ch)) {
        status = 'whitespace';
        description = 'Separator / Space';
      } else if (/[^a-zA-Z0-9]/.test(ch)) {
        status = 'symbol';
        description = 'Special Symbol';
      }

      return {
        char: ch,
        index: idx,
        codePoint,
        status,
        description,
        invisibleMeta: invisible || null,
        matchedLatin: homoglyph?.latin || leet || null,
      };
    });

    // Detect high risk keyword insertions
    const candidateLower = candidateText.toLowerCase();
    const detectedKeywords = HIGH_RISK_KEYWORDS.filter(k => candidateLower.includes(k));

    // Detect mixed-script anomalies
    const hasLatin = /[a-zA-Z]/.test(candidateText);
    const hasCyrillic = /[\u0400-\u04FF]/.test(candidateText);
    const hasGreek = /[\u0370-\u03FF]/.test(candidateText);
    const isMixedScript = (hasLatin && hasCyrillic) || (hasLatin && hasGreek) || (hasCyrillic && hasGreek);

    // Calculate token resemblance (Jaccard)
    const baseTokens = new Set(baselineText.toLowerCase().split(/\s+/).filter(Boolean));
    const candTokens = new Set(candidateText.toLowerCase().split(/\s+/).filter(Boolean));
    const intersection = new Set([...candTokens].filter(x => baseTokens.has(x)));
    const union = new Set([...candTokens, ...baseTokens]);
    const tokenSimilarity = union.size === 0 ? 0 : intersection.size / union.size;

    // Resemblance estimation
    const isExact = candidateNormalized === baseNormalized;
    let resemblance = isExact ? 1.0 : 0.65;
    if (homoglyphCount > 0) resemblance = 0.94; // Extremely high visual resemblance due to visual spoof
    if (invisibleCount > 0) resemblance = 0.97; // High resemblance masking invisible injection
    if (detectedKeywords.length > 0) resemblance = Math.min(0.96, resemblance + 0.15);

    // Dynamic Firewall Verdict
    let verdict: 'ALLOWED_BASELINE' | 'QUARANTINE_REVIEW' | 'REJECT_POLICY_CONFLICT' = 'QUARANTINE_REVIEW';
    if (isExact && homoglyphCount === 0 && invisibleCount === 0) {
      verdict = 'ALLOWED_BASELINE';
    } else if (homoglyphCount > 0 || invisibleCount > 0 || isMixedScript || detectedKeywords.length > 0 || leetCount > 0) {
      verdict = 'REJECT_POLICY_CONFLICT';
    }

    // Punycode representation simulation for IDNs
    const hasNonAscii = /[^\u0000-\u007F]/.test(candidateText);
    const punycodeEstimate = hasNonAscii
      ? `xn--${candidateText.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}-${Date.now().toString(36).slice(0, 4)}`
      : null;

    return {
      charDetails,
      homoglyphCount,
      leetCount,
      invisibleCount,
      isMixedScript,
      detectedKeywords,
      tokenSimilarity,
      resemblance,
      verdict,
      punycodeEstimate,
    };
  }, [candidateText, baselineText]);

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* Top Firewall Verdict Card */}
      <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        analysis.verdict === 'ALLOWED_BASELINE'
          ? 'bg-[rgba(216,245,123,0.08)] border-[rgba(216,245,123,0.3)] text-[#d8f57b]'
          : analysis.verdict === 'REJECT_POLICY_CONFLICT'
          ? 'bg-[rgba(239,140,140,0.12)] border-[rgba(239,140,140,0.35)] text-[#ef8c8c]'
          : 'bg-[rgba(233,173,113,0.12)] border-[rgba(233,173,113,0.35)] text-[#e9ad71]'
      }`}>
        <div className="flex items-center gap-3">
          {analysis.verdict === 'ALLOWED_BASELINE' ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : analysis.invisibleCount > 0 ? (
            <ShieldX className="w-5 h-5 flex-shrink-0 text-[#ef8c8c]" />
          ) : (
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          )}
          <div>
            <div className="text-[10px] tracking-wider uppercase text-[#9ba69e] flex items-center gap-2">
              <span>FIREWALL POLICY VERDICT</span>
              {analysis.invisibleCount > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-[rgba(239,140,140,0.2)] text-[#ef8c8c] text-[9px] font-bold">
                  EVASION ATTEMPT
                </span>
              )}
            </div>
            <div className="text-sm font-semibold tracking-wide">
              {analysis.verdict.replace(/_/g, ' ')}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onFeedIntoQueue && (
            <button
              onClick={() => onFeedIntoQueue({
                displayName: candidateText,
                verdict: analysis.verdict,
                homoglyphsFound: analysis.homoglyphCount + analysis.invisibleCount,
                resemblance: analysis.resemblance,
              })}
              className="px-3 py-1.5 rounded bg-[rgba(236,233,223,0.1)] hover:bg-[rgba(236,233,223,0.2)] text-[#ece9df] text-[11px] font-semibold transition-all flex items-center gap-1.5"
            >
              <span>Queue for Review</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Character Breakdown Visualizer */}
      <div className="p-4 rounded-xl bg-[rgba(14,20,17,0.7)] border border-[rgba(236,233,223,0.08)]">
        <div className="flex items-center justify-between text-[10px] text-[#69756d] uppercase mb-2">
          <span>CODE-POINT DECOMPOSITION AUDIT ({analysis.charDetails.length} CHARS)</span>
          {analysis.punycodeEstimate && (
            <span className="text-[#9cc4d9] flex items-center gap-1">
              <Globe2 className="w-3 h-3" />
              IDN Punycode: {analysis.punycodeEstimate}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {analysis.charDetails.map((c) => {
            const isInvisible = c.status === 'invisible';
            const isHomoglyph = c.status === 'homoglyph';
            const isLeet = c.status === 'leet';

            return (
              <div
                key={c.index}
                title={`${c.char} • ${c.codePoint} • ${c.description}`}
                className={`flex flex-col items-center justify-center min-w-[34px] h-[48px] px-1.5 rounded border transition-all ${
                  isInvisible
                    ? 'bg-[rgba(239,140,140,0.3)] border-[#ef8c8c] text-[#ef8c8c] animate-pulse shadow-[0_0_12px_rgba(239,140,140,0.5)]'
                    : isHomoglyph
                    ? 'bg-[rgba(239,140,140,0.2)] border-[#ef8c8c] text-[#ef8c8c] animate-pulse shadow-[0_0_8px_rgba(239,140,140,0.3)]'
                    : isLeet
                    ? 'bg-[rgba(233,173,113,0.15)] border-[#e9ad71] text-[#e9ad71]'
                    : 'bg-[rgba(9,12,10,0.8)] border-[rgba(236,233,223,0.08)] text-[#ece9df]'
                }`}
              >
                <span className="text-base font-semibold">
                  {isInvisible ? (
                    <span className="text-[10px] font-bold text-[#ef8c8c] px-0.5">[{c.invisibleMeta?.label}]</span>
                  ) : c.char === ' ' ? (
                    '␣'
                  ) : (
                    c.char
                  )}
                </span>
                <span className="text-[8px] text-[#69756d] font-mono">{c.codePoint.slice(2)}</span>
              </div>
            );
          })}
        </div>

        {/* Forensic Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-3 border-t border-[rgba(236,233,223,0.06)] text-[11px]">
          <div>
            <span className="text-[#69756d] block text-[9.5px]">UNICODE SPOOFS:</span>
            <span className={`font-semibold ${analysis.homoglyphCount > 0 ? 'text-[#ef8c8c]' : 'text-[#d8f57b]'}`}>
              {analysis.homoglyphCount} detected
            </span>
          </div>

          <div>
            <span className="text-[#69756d] block text-[9.5px]">INVISIBLE EVASION:</span>
            <span className={`font-semibold ${analysis.invisibleCount > 0 ? 'text-[#ef8c8c]' : 'text-[#d8f57b]'}`}>
              {analysis.invisibleCount > 0 ? `${analysis.invisibleCount} INVISIBLES!` : '0 (Clean)'}
            </span>
          </div>

          <div>
            <span className="text-[#69756d] block text-[9.5px]">MIXED SCRIPT:</span>
            <span className={`font-semibold ${analysis.isMixedScript ? 'text-[#e9ad71]' : 'text-[#d8f57b]'}`}>
              {analysis.isMixedScript ? 'Mixed Script Detected' : 'Single Script'}
            </span>
          </div>

          <div>
            <span className="text-[#69756d] block text-[9.5px]">LEETSPEAK SUBS:</span>
            <span className={`font-semibold ${analysis.leetCount > 0 ? 'text-[#e9ad71]' : 'text-[#ece9df]'}`}>
              {analysis.leetCount} detected
            </span>
          </div>

          <div>
            <span className="text-[#69756d] block text-[9.5px]">TOKEN JACCARD:</span>
            <span className="font-semibold text-[#9cc4d9]">
              {(analysis.tokenSimilarity * 100).toFixed(0)}% overlap
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
