'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AuthNavbar } from '@/components/AuthNavbar';
import { TelemetryPanel } from '@/components/TelemetryPanel';
import { getSupabase } from '@/lib/supabase';
import { 
  Mail, 
  ArrowRight, 
  ArrowLeft, 
  AlertCircle, 
  CheckCircle2, 
  KeyRound,
  ShieldAlert
} from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim()) {
      setErrorMsg('Please specify your registered enterprise email address.');
      return;
    }

    setIsLoading(true);

    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined,
      });
      setIsLoading(false);
      if (error) {
        setErrorMsg(error.message);
      } else {
        setIsSuccess(true);
      }
    } else {
      // Mock / Preview Mode
      setTimeout(() => {
        setIsLoading(false);
        setIsSuccess(true);
      }, 700);
    }
  };

  return (
    <main className="auth-split-layout">
      {/* Left Column: Live Cinematic Telemetry Showcase (50% Equal Split) */}
      <TelemetryPanel />

      {/* Right Column: Password Recovery Form (50% Equal Split) */}
      <div className="auth-form-column">
        <AuthNavbar currentPath="forgot-password" />

        <div className="max-w-[490px] w-full mx-auto my-auto py-8">
          <Link 
            href="/login" 
            className="inline-flex items-center gap-2 text-xs text-[#9ba69e] hover:text-[#d8f57b] mb-6 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Console Sign In</span>
          </Link>

          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[rgba(233,173,113,0.08)] border border-[rgba(233,173,113,0.25)] text-[11px] font-mono text-[#e9ad71] uppercase tracking-wider mb-3">
              <KeyRound className="w-3.5 h-3.5" />
              <span>Credential Recovery</span>
            </div>
            <h1 
              style={{ fontFamily: 'var(--font-serif)' }}
              className="text-3xl sm:text-4xl font-normal text-[#f2efe7] tracking-tight leading-tight mb-2"
            >
              Reset Operator <span className="text-[#ece9df]">Password</span>
            </h1>
            <p className="text-sm text-[#9ba69e] leading-relaxed">
              Enter the verified work email linked to your Cairnwise operator account to receive a secure recovery dispatch.
            </p>
          </div>

          {errorMsg && (
            <div className="cairn-alert cairn-alert-danger" role="alert">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#ef8c8c]" />
              <div className="flex-1">
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          {isSuccess ? (
            <div className="p-6 rounded-lg bg-[rgba(216,245,123,0.06)] border border-[rgba(216,245,123,0.25)]">
              <div className="flex items-center gap-3 text-[#d8f57b] mb-3">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <h3 className="text-base font-medium">Recovery Dispatch Sent</h3>
              </div>
              <p className="text-xs text-[#9ba69e] mb-4 leading-relaxed">
                If <strong className="text-[#f2efe7] font-mono">{email}</strong> exists in the directory, you will receive an authenticated reset link shortly.
              </p>
              <div className="flex items-center gap-3">
                <Link
                  href="/login"
                  className="cairn-btn cairn-btn-primary h-10 text-xs font-medium"
                >
                  Return to Sign In
                </Link>
                <button
                  type="button"
                  onClick={() => setIsSuccess(false)}
                  className="text-xs text-[#9ba69e] hover:text-[#f2efe7] px-3 py-2"
                >
                  Try another email
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="cairn-input-group mb-6">
                <label htmlFor="reset-email" className="cairn-label">
                  <span>Registered Work Email</span>
                </label>
                <div className="cairn-input-wrapper">
                  <span className="cairn-input-icon">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    id="reset-email"
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

              <button
                type="submit"
                disabled={isLoading}
                className="cairn-btn cairn-btn-primary w-full h-12 text-sm tracking-wide font-medium shadow-[0_0_20px_rgba(216,245,123,0.2)]"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-[#131b0e] border-t-transparent rounded-full animate-spin" />
                    <span>Transmitting Reset Dispatch...</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span>Send Password Reset Instructions</span>
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </button>
            </form>
          )}

          <div className="mt-8 p-4 rounded bg-[rgba(10,14,12,0.6)] border border-[rgba(236,233,223,0.08)] flex items-start gap-3">
            <ShieldAlert className="w-4 h-4 text-[#e9ad71] flex-shrink-0 mt-0.5" />
            <div className="text-[11px] text-[#9ba69e] leading-relaxed">
              <strong className="text-[#ece9df]">Enterprise Security Note:</strong> For zero-trust compliance, password recovery tokens expire in 15 minutes and can only be used once.
            </div>
          </div>
        </div>

        <div className="mt-auto pt-6 text-[11px] font-mono text-[#69756d] flex items-center justify-between border-t border-[rgba(236,233,223,0.06)]">
          <span>&copy; 2026 CAIRNWISE RISK LABS</span>
          <span>RECOVERY DISPATCH SYSTEM</span>
        </div>
      </div>
    </main>
  );
}
