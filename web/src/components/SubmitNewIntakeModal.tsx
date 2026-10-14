'use client';

import React, { useState, useMemo } from 'react';
import { 
  X, 
  Plus, 
  Shield, 
  Terminal, 
  Sliders, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight,
  Globe,
  Smartphone,
  ExternalLink,
  Layers,
  FileCheck
} from 'lucide-react';

interface SubmitNewIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  brandName: string;
  brandLocale: string;
  onIngestCandidate: (candidateData: {
    assetType: 'social_profile' | 'mobile_app';
    platform: string;
    identity: string;
    displayName: string;
    publisher?: string;
    bio: string;
    destinationUrl: string;
    iconSimilarity: number;
    scores: {
      resemblance: number;
      conflict: number;
      harm: number;
      risk: number;
    };
  }) => void;
}

export function SubmitNewIntakeModal({
  isOpen,
  onClose,
  brandName,
  brandLocale,
  onIngestCandidate,
}: SubmitNewIntakeModalProps) {
  const [platform, setPlatform] = useState<string>('twitter');
  const [assetType, setAssetType] = useState<'social_profile' | 'mobile_app'>('social_profile');
  const [identity, setIdentity] = useState('@northstar_pay_bonus');
  const [displayName, setDisplayName] = useState('Northstar Pay Official Rewards');
  const [bio, setBio] = useState('Official festive cashback portal. Send DM with your registered UPI mobile number and OTP to claim ₹2,500 bonus immediately.');
  const [publisher, setPublisher] = useState('');
  const [destinationUrl, setDestinationUrl] = useState('https://northstar-rewards-claim.xyz/verify');
  const [iconSimilarity, setIconSimilarity] = useState(0.88);

  // Live 4D Triangulation Computation
  const computedScores = useMemo(() => {
    const canonical = brandName.toLowerCase();
    const inputTitle = displayName.toLowerCase();
    const inputId = identity.toLowerCase();
    const inputBio = bio.toLowerCase();

    // Check Cyrillic or confusable homoglyphs
    const cyrillicMatch = displayName.match(/[\u0400-\u04FF]/g) || identity.match(/[\u0400-\u04FF]/g);
    const hasHomoglyphs = cyrillicMatch !== null && cyrillicMatch.length > 0;

    // Resemblance
    let resemblance = 0.50;
    if (inputTitle.includes('northstar') || inputId.includes('northstar')) resemblance += 0.35;
    if (inputTitle.includes('pay') || inputId.includes('pay')) resemblance += 0.10;
    if (hasHomoglyphs) resemblance += 0.05;
    resemblance = Math.min(0.99, Number(resemblance.toFixed(2)));

    // Authorization Conflict
    let conflict = 0.85;
    if (publisher && publisher.toLowerCase().includes('northstar financial services')) {
      conflict = 0.05; // Official publisher match
    } else if (publisher && publisher.trim().length > 0) {
      conflict = 0.95; // Unrecognized third-party publisher
    }

    // Observed Harm Signals
    const harmKeywords = ['dm', 'otp', 'pin', 'phone', 'bonus', 'claim', 'cashback', 'urgent', 'unfreeze', 'seed phrase', 'verify', 'wallet'];
    const hits = harmKeywords.filter(k => inputBio.includes(k) || inputTitle.includes(k));
    let harm = Math.min(0.98, Number((0.40 + hits.length * 0.14).toFixed(2)));

    // Deterministic Composite Risk (Formula from SOLUTION.md §4.2)
    const risk = Number(((resemblance * 0.35) + (conflict * 0.35) + (harm * 0.30)).toFixed(2));

    return {
      resemblance,
      conflict,
      harm,
      risk,
      hitsCount: hits.length,
      hasHomoglyphs,
    };
  }, [brandName, displayName, identity, bio, publisher]);

  if (!isOpen) return null;

  const applyPreset = (presetKey: 'social_phish' | 'app_trojan' | 'official_test') => {
    if (presetKey === 'social_phish') {
      setPlatform('twitter');
      setAssetType('social_profile');
      setIdentity('@northstar_pay_support');
      setDisplayName('Northstar Pay Support Urgent');
      setBio('Official 24x7 Northstar helpline. DM us your account number and phone to unfreeze funds immediately.');
      setPublisher('');
      setDestinationUrl('https://northstar-resolve-ticket.help/verify');
      setIconSimilarity(0.92);
    } else if (presetKey === 'app_trojan') {
      setPlatform('google_play');
      setAssetType('mobile_app');
      setIdentity('com.apex.northstar.paysecure');
      setDisplayName('Northstar Pay Secure — UPI Terminal');
      setBio('Direct instant merchant UPI gateway with contactless tap-to-pay functionality.');
      setPublisher('Apex Digital Labs Ltd (Unverified)');
      setDestinationUrl('https://apex-direct-dl.example/pay-northstar.apk');
      setIconSimilarity(0.85);
    } else if (presetKey === 'official_test') {
      setPlatform('bluesky');
      setAssetType('social_profile');
      setIdentity('did:plc:northstarofficial2026');
      setDisplayName('Northstar Pay Official');
      setBio('The authentic Northstar Pay digital payment ecosystem. Regulated by RBI & MAS.');
      setPublisher('Northstar Financial Services LLC');
      setDestinationUrl('https://northstar.pay.example');
      setIconSimilarity(1.0);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identity.trim() || !displayName.trim()) return;

    onIngestCandidate({
      assetType,
      platform,
      identity: identity.trim(),
      displayName: displayName.trim(),
      publisher: publisher.trim() || undefined,
      bio: bio.trim(),
      destinationUrl: destinationUrl.trim(),
      iconSimilarity,
      scores: {
        resemblance: computedScores.resemblance,
        conflict: computedScores.conflict,
        harm: computedScores.harm,
        risk: computedScores.risk,
      },
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-3xl max-h-[92vh] bg-[#0c100e] border border-[rgba(236,233,223,0.12)] rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-[rgba(236,233,223,0.08)] bg-[rgba(14,20,17,0.8)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[rgba(132,204,22,0.12)] border border-[rgba(132,204,22,0.25)] flex items-center justify-center text-[#84cc16]">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 style={{ fontFamily: 'var(--font-serif)' }} className="text-lg font-normal text-[#f2efe7]">
                  Forensic Observation Intake
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[rgba(132,204,22,0.08)] text-[#84cc16] border border-[rgba(132,204,22,0.2)]">
                  LIVE 4D TRIANGULATION
                </span>
              </div>
              <p className="text-xs text-[#9ba69e] mt-0.5">
                Submit an unverified profile or APK listing for deterministic baseline comparison.
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

        {/* Quick Presets Bar */}
        <div className="px-6 py-3 border-b border-[rgba(236,233,223,0.06)] bg-[rgba(10,14,12,0.7)] flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-mono text-[#69756d] uppercase tracking-wider mr-1">
            TEST SCENARIOS:
          </span>
          <button
            type="button"
            onClick={() => applyPreset('social_phish')}
            className="px-2.5 py-1 rounded text-xs font-mono bg-[rgba(233,173,113,0.1)] hover:bg-[rgba(233,173,113,0.2)] text-[#e9ad71] border border-[rgba(233,173,113,0.25)] transition-all"
          >
            1. Phishing Support Profile
          </button>
          <button
            type="button"
            onClick={() => applyPreset('app_trojan')}
            className="px-2.5 py-1 rounded text-xs font-mono bg-[rgba(239,140,140,0.1)] hover:bg-[rgba(239,140,140,0.2)] text-[#ef8c8c] border border-[rgba(239,140,140,0.25)] transition-all"
          >
            2. Rogue Merchant APK
          </button>
          <button
            type="button"
            onClick={() => applyPreset('official_test')}
            className="px-2.5 py-1 rounded text-xs font-mono bg-[rgba(110,231,183,0.1)] hover:bg-[rgba(110,231,183,0.2)] text-[#6ee7b7] border border-[rgba(110,231,183,0.25)] transition-all"
          >
            3. Official Asset (Firewall Test)
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Channel & Type Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-[#9ba69e] block mb-1.5">
                Target Platform / Source
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[rgba(14,20,17,0.8)] border border-[rgba(236,233,223,0.12)] text-[#ece9df] text-xs font-mono focus:outline-none focus:border-[#84cc16]"
              >
                <option value="twitter">X (Twitter)</option>
                <option value="google_play">Google Play Store</option>
                <option value="apple_app_store">Apple App Store</option>
                <option value="instagram">Instagram</option>
                <option value="youtube">YouTube</option>
                <option value="tiktok">TikTok</option>
                <option value="bluesky">Bluesky (ATProto)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-[#9ba69e] block mb-1.5">
                Observation Entity Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAssetType('social_profile')}
                  className={`px-3 py-2 rounded-lg text-xs font-mono flex items-center justify-center gap-1.5 border transition-all ${
                    assetType === 'social_profile'
                      ? 'bg-[rgba(132,204,22,0.15)] text-[#84cc16] border-[#84cc16] font-semibold'
                      : 'bg-[rgba(14,20,17,0.6)] text-[#9ba69e] border-[rgba(236,233,223,0.08)]'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Social Profile</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAssetType('mobile_app')}
                  className={`px-3 py-2 rounded-lg text-xs font-mono flex items-center justify-center gap-1.5 border transition-all ${
                    assetType === 'mobile_app'
                      ? 'bg-[rgba(132,204,22,0.15)] text-[#84cc16] border-[#84cc16] font-semibold'
                      : 'bg-[rgba(14,20,17,0.6)] text-[#9ba69e] border-[rgba(236,233,223,0.08)]'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Mobile App</span>
                </button>
              </div>
            </div>
          </div>

          {/* Identifier & Title Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-[#9ba69e] block mb-1.5">
                Handle / Package / Identifier
              </label>
              <input
                type="text"
                required
                value={identity}
                onChange={(e) => setIdentity(e.target.value)}
                placeholder="@handle or com.package.name"
                className="w-full px-3 py-2 rounded-lg bg-[rgba(14,20,17,0.8)] border border-[rgba(236,233,223,0.12)] text-[#ece9df] text-xs font-mono focus:outline-none focus:border-[#84cc16]"
              />
            </div>

            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-[#9ba69e] block mb-1.5">
                Display Title / Profile Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Northstar Pay Official Help"
                className="w-full px-3 py-2 rounded-lg bg-[rgba(14,20,17,0.8)] border border-[rgba(236,233,223,0.12)] text-[#ece9df] text-xs font-mono focus:outline-none focus:border-[#84cc16]"
              />
            </div>
          </div>

          {/* Bio / Description */}
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-[#9ba69e] block mb-1.5">
              Profile Bio or Listing Description
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Full text excerpt observed on the external listing..."
              className="w-full px-3 py-2 rounded-lg bg-[rgba(14,20,17,0.8)] border border-[rgba(236,233,223,0.12)] text-[#ece9df] text-xs font-mono focus:outline-none focus:border-[#84cc16]"
            />
          </div>

          {/* Optional Publisher & Destination URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {assetType === 'mobile_app' && (
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-[#9ba69e] block mb-1.5">
                  App Store Publisher / Developer
                </label>
                <input
                  type="text"
                  value={publisher}
                  onChange={(e) => setPublisher(e.target.value)}
                  placeholder="e.g. Apex Digital Labs Ltd"
                  className="w-full px-3 py-2 rounded-lg bg-[rgba(14,20,17,0.8)] border border-[rgba(236,233,223,0.12)] text-[#ece9df] text-xs font-mono focus:outline-none focus:border-[#84cc16]"
                />
              </div>
            )}

            <div className={assetType === 'mobile_app' ? '' : 'sm:col-span-2'}>
              <label className="text-xs font-mono uppercase tracking-wider text-[#9ba69e] block mb-1.5">
                Observed Destination / Phishing URL
              </label>
              <input
                type="url"
                value={destinationUrl}
                onChange={(e) => setDestinationUrl(e.target.value)}
                placeholder="https://example.com/login"
                className="w-full px-3 py-2 rounded-lg bg-[rgba(14,20,17,0.8)] border border-[rgba(236,233,223,0.12)] text-[#ece9df] text-xs font-mono focus:outline-none focus:border-[#84cc16]"
              />
            </div>
          </div>

          {/* Icon Similarity Slider */}
          <div className="p-4 rounded-xl bg-[rgba(14,20,17,0.6)] border border-[rgba(236,233,223,0.08)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono uppercase tracking-wider text-[#9ba69e]">
                Visual Icon Resemblance (pHash / dHash)
              </span>
              <span className="text-xs font-mono font-bold text-[#84cc16]">
                {(iconSimilarity * 100).toFixed(0)}% Visual Match
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={iconSimilarity}
              onChange={(e) => setIconSimilarity(parseFloat(e.target.value))}
              className="w-full accent-[#84cc16] cursor-pointer"
            />
          </div>

          {/* Real-time 4D Scoring Triangulation Panel */}
          <div className="p-4 rounded-xl bg-[rgba(18,24,20,0.8)] border border-[rgba(132,204,22,0.25)] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#84cc16]" />
                <span className="text-xs font-mono uppercase tracking-wider font-semibold text-[#f2efe7]">
                  Deterministic 4D Triangulation Radar
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-[#9ba69e]">Calculated Risk:</span>
                <span className={`text-base font-mono font-bold ${
                  computedScores.risk >= 0.8 
                    ? 'text-[#ef8c8c]' 
                    : computedScores.risk >= 0.5 
                    ? 'text-[#e9ad71]' 
                    : 'text-[#84cc16]'
                }`}>
                  {computedScores.risk.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Score Progress Bars */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-2.5 rounded bg-[rgba(10,14,12,0.8)] border border-[rgba(236,233,223,0.04)]">
                <span className="text-[#69756d] text-[10px] block mb-1">1. RESEMBLANCE</span>
                <span className="text-[#ece9df] font-semibold">{computedScores.resemblance.toFixed(2)}</span>
                <div className="w-full h-1 bg-[rgba(236,233,223,0.1)] rounded-full mt-1.5 overflow-hidden">
                  <div className="h-full bg-[#e9ad71]" style={{ width: `${computedScores.resemblance * 100}%` }} />
                </div>
              </div>

              <div className="p-2.5 rounded bg-[rgba(10,14,12,0.8)] border border-[rgba(236,233,223,0.04)]">
                <span className="text-[#69756d] text-[10px] block mb-1">2. VISUAL (PHASH)</span>
                <span className="text-[#ece9df] font-semibold">{iconSimilarity.toFixed(2)}</span>
                <div className="w-full h-1 bg-[rgba(236,233,223,0.1)] rounded-full mt-1.5 overflow-hidden">
                  <div className="h-full bg-[#84cc16]" style={{ width: `${iconSimilarity * 100}%` }} />
                </div>
              </div>

              <div className="p-2.5 rounded bg-[rgba(10,14,12,0.8)] border border-[rgba(236,233,223,0.04)]">
                <span className="text-[#69756d] text-[10px] block mb-1">3. CONFLICT</span>
                <span className="text-[#ece9df] font-semibold">{computedScores.conflict.toFixed(2)}</span>
                <div className="w-full h-1 bg-[rgba(236,233,223,0.1)] rounded-full mt-1.5 overflow-hidden">
                  <div className="h-full bg-[#ef8c8c]" style={{ width: `${computedScores.conflict * 100}%` }} />
                </div>
              </div>

              <div className="p-2.5 rounded bg-[rgba(10,14,12,0.8)] border border-[rgba(236,233,223,0.04)]">
                <span className="text-[#69756d] text-[10px] block mb-1">4. OBSERVED HARM</span>
                <span className="text-[#ece9df] font-semibold">{computedScores.harm.toFixed(2)}</span>
                <div className="w-full h-1 bg-[rgba(236,233,223,0.1)] rounded-full mt-1.5 overflow-hidden">
                  <div className="h-full bg-[#ef8c8c]" style={{ width: `${computedScores.harm * 100}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-mono text-[#9ba69e] hover:text-[#ece9df] hover:bg-[rgba(236,233,223,0.05)] transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg text-xs font-mono font-semibold bg-[#84cc16] hover:bg-[#97e01b] text-[#0d140e] transition-all flex items-center gap-2 shadow-[0_2px_12px_rgba(132,204,22,0.3)]"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Run 4D Triangulation &amp; Ingest</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
