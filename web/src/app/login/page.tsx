'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthNavbar } from '@/components/AuthNavbar';
import { TelemetryPanel } from '@/components/TelemetryPanel';
import { useAuth } from '@/lib/auth-context';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  AlertCircle, 
  KeyRound, 
  Sparkles,
  CheckCircle2,
  Fingerprint
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { signInWithEmail, signInWithGoogle, user, isConfigured } = useAuth();

  const [mode, setMode] = useState<'password' | 'magic'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  // Auto redirect if already signed in
  React.useEffect(() => {
    if (user) {
      router.push('/workspace');
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email) {
      setErrorMsg('Please enter your work email address.');
      return;
    }

    if (mode === 'password' && !password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setIsLoading(true);

    if (mode === 'magic') {
      // Magic Link mode
      setTimeout(() => {
        setIsLoading(false);
        setMagicLinkSent(true);
      }, 900);
      return;
    }

    const { error } = await signInWithEmail(email, password);
    setIsLoading(false);

    if (error) {
      setErrorMsg(error);
    } else {
      router.push('/workspace');
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMsg(null);
    setIsLoading(true);
    const { error } = await signInWithGoogle();
    setIsLoading(false);
    if (error) {
      setErrorMsg(error);
    } else {
      router.push('/workspace');
    }
  };

  const fillQuickDemo = (role: 'analyst' | 'reviewer') => {
    if (role === 'analyst') {
      setEmail('elena.vance@northstar.security');
      setPassword('Cairnwise2026!Analyst');
    } else {
      setEmail('marcus.thorne@northstar.governance');
      setPassword('Cairnwise2026!Reviewer');
    }
    setErrorMsg(null);
  };

  return (
    <main className="auth-split-layout">
      {/* Left Column: Live Cinematic Telemetry Showcase (50% Equal Split) */}
      <TelemetryPanel />

      {/* Right Column: Authentic Editorial Form (50% Equal Split) */}
      <div className="auth-form-column">
        <AuthNavbar currentPath="login" />

        <div className="max-w-[490px] w-full mx-auto my-auto py-6 sm:py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[rgba(216,245,123,0.06)] border border-[rgba(216,245,123,0.2)] text-[11px] font-mono text-[#d8f57b] uppercase tracking-wider mb-3">
              <Fingerprint className="w-3.5 h-3.5" />
              <span>Operator Authentication</span>
            </div>
            <h1 
              style={{ fontFamily: 'var(--font-serif)' }}
              className="text-3xl sm:text-4xl font-normal text-[#f2efe7] tracking-tight leading-tight mb-2"
            >
              Sign in to <span className="text-[#ece9df]">Cairn</span><em className="text-[#d8f57b] not-italic font-normal">wise</em>
            </h1>
            <p className="text-sm text-[#9ba69e] leading-relaxed">
              Enter your enterprise credentials to access active forensic queues and identity intelligence ledger.
            </p>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="cairn-alert cairn-alert-danger" role="alert">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#ef8c8c]" />
              <div className="flex-1">
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          {/* Magic Link Sent Feedback */}
          {magicLinkSent && (
            <div className="cairn-alert cairn-alert-info">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#d8f57b]" />
              <div>
                <strong>Authentication link dispatched:</strong> Check {email} for your secure cryptographic entry link.
              </div>
            </div>
          )}

          {/* Social Google Auth */}
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={isLoading}
            className="social-auth-btn mb-4 group"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
              />
              <path
                fill="#FBBC05"
                d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8s.2-2 .4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
              />
              <path
                fill="#34A853"
                d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"
              />
            </svg>
            <span>Continue with Google Workspace</span>
          </button>

          <div className="hairline-divider">
            <span>or sign in with credentials</span>
          </div>

          {/* Auth Method Tabs */}
          <div className="auth-tab-bar">
            <button
              type="button"
              onClick={() => { setMode('password'); setErrorMsg(null); }}
              className={`auth-tab ${mode === 'password' ? 'active' : ''}`}
            >
              Enterprise Password
            </button>
            <button
              type="button"
              onClick={() => { setMode('magic'); setErrorMsg(null); }}
              className={`auth-tab ${mode === 'magic' ? 'active' : ''}`}
            >
              Passwordless Magic Link
            </button>
          </div>

          {/* Main Form */}
          <form onSubmit={handleSubmit}>
            {/* Work Email */}
            <div className="cairn-input-group">
              <label htmlFor="login-email" className="cairn-label">
                <span>Work Email</span>
                <span className="text-[10px] font-mono text-[#69756d]">SSO & RLS PROTECTED</span>
              </label>
              <div className="cairn-input-wrapper">
                <span className="cairn-input-icon">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="analyst@enterprise.com"
                  autoComplete="email"
                  required
                  className="cairn-input font-mono"
                />
              </div>
            </div>

            {/* Password (if mode === 'password') */}
            {mode === 'password' && (
              <div className="cairn-input-group">
                <div className="cairn-label">
                  <span>Operator Password</span>
                  <Link 
                    href="/forgot-password" 
                    className="text-[11px] text-[#d8f57b] hover:text-[#efffb9] transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="cairn-input-wrapper">
                  <span className="cairn-input-icon">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    required
                    className="cairn-input font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="cairn-input-toggle"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Remember Me */}
            <div className="flex items-center justify-between mb-6">
              <label className="cairn-checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="cairn-checkbox-input"
                />
                <span>Persist console session for 30 days</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="cairn-btn cairn-btn-primary w-full h-12 text-sm tracking-wide font-medium shadow-[0_0_20px_rgba(216,245,123,0.2)]"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-[#131b0e] border-t-transparent rounded-full animate-spin" />
                  <span>Verifying Cryptographic Ledger...</span>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span>{mode === 'password' ? 'Access Risk Console' : 'Send One-Time Magic Link'}</span>
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Helper */}
          <div className="mt-8 pt-6 border-t border-[rgba(236,233,223,0.08)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono text-[#69756d] uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-[#d8f57b]" /> Evaluation Quick Fill:
              </span>
              <span className="text-[10px] font-mono text-[#9ba69e]">1-Click Autofill</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillQuickDemo('analyst')}
                className="px-2.5 py-1.5 rounded bg-[rgba(14,20,17,0.7)] hover:bg-[rgba(216,245,123,0.1)] border border-[rgba(236,233,223,0.1)] hover:border-[rgba(216,245,123,0.3)] text-left transition-all"
              >
                <div className="text-[11px] font-medium text-[#f2efe7]">Senior Analyst</div>
                <div className="text-[10px] font-mono text-[#9ba69e] truncate">elena.vance@northstar</div>
              </button>
              <button
                type="button"
                onClick={() => fillQuickDemo('reviewer')}
                className="px-2.5 py-1.5 rounded bg-[rgba(14,20,17,0.7)] hover:bg-[rgba(216,245,123,0.1)] border border-[rgba(236,233,223,0.1)] hover:border-[rgba(216,245,123,0.3)] text-left transition-all"
              >
                <div className="text-[11px] font-medium text-[#f2efe7]">Approver / Lead</div>
                <div className="text-[10px] font-mono text-[#9ba69e] truncate">marcus.thorne@northstar</div>
              </button>
            </div>
          </div>

          {/* Sign up prompt */}
          <div className="mt-6 text-center text-xs text-[#9ba69e]">
            <span>Need enterprise operator credentials? </span>
            <Link 
              href="/signup" 
              className="text-[#d8f57b] hover:text-[#efffb9] font-medium ml-1 underline underline-offset-4"
            >
              Provision new account &rarr;
            </Link>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-auto pt-6 text-[11px] font-mono text-[#69756d] flex items-center justify-between border-t border-[rgba(236,233,223,0.06)]">
          <span>&copy; 2026 CAIRNWISE RISK LABS</span>
          <span className="flex items-center gap-1.5">
            <KeyRound className="w-3 h-3 text-[#d8f57b]" />
            <span>SUPABASE AUTH V2</span>
          </span>
        </div>
      </div>
    </main>
  );
}
