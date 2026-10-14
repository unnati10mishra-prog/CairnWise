'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthNavbar } from '@/components/AuthNavbar';
import { TelemetryPanel } from '@/components/TelemetryPanel';
import { PasswordStrength } from '@/components/PasswordStrength';
import { useAuth } from '@/lib/auth-context';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  User, 
  Building2, 
  ArrowRight, 
  AlertCircle, 
  ShieldCheck, 
  CheckCircle2,
  BadgeCheck,
  UserCheck
} from 'lucide-react';

const ROLES = [
  {
    id: 'analyst',
    title: 'Risk Analyst',
    description: 'Investigate look-alike feeds & assemble evidence',
  },
  {
    id: 'reviewer',
    title: 'Senior Reviewer',
    description: 'Second-pair signoff & escalation authorization',
  },
  {
    id: 'lead',
    title: 'Security Lead',
    description: 'Full ledger management & policy configuration',
  },
];

export default function SignupPage() {
  const router = useRouter();
  const { signUpWithEmail, signInWithGoogle, user } = useAuth();

  const [fullName, setFullName] = useState('');
  const [organization, setOrganization] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState('analyst');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Auto redirect if already logged in
  React.useEffect(() => {
    if (user) {
      router.push('/workspace');
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!fullName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!organization.trim()) {
      setErrorMsg('Please specify your enterprise or organization name.');
      return;
    }
    if (!email.trim()) {
      setErrorMsg('Please provide a valid work email.');
      return;
    }
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }
    if (!acceptedTerms) {
      setErrorMsg('Please confirm acknowledgment of immutable audit logging.');
      return;
    }

    setIsLoading(true);

    const { error } = await signUpWithEmail(email, password, {
      fullName,
      organization,
      role: selectedRole,
    });

    setIsLoading(false);

    if (error) {
      setErrorMsg(error);
    } else {
      setSuccessMsg('Operator credentials created successfully. Initializing workspace...');
      setTimeout(() => {
        router.push('/workspace');
      }, 1000);
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

  return (
    <main className="auth-split-layout">
      {/* Left Column: Live Cinematic Telemetry Showcase (50% Equal Split) */}
      <TelemetryPanel />

      {/* Right Column: Authentic Editorial Registration Form (50% Equal Split) */}
      <div className="auth-form-column">
        <AuthNavbar currentPath="signup" />

        <div className="max-w-[500px] w-full mx-auto my-auto py-6">
          {/* Header */}
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[rgba(216,245,123,0.06)] border border-[rgba(216,245,123,0.2)] text-[11px] font-mono text-[#d8f57b] uppercase tracking-wider mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Provision Operator Access</span>
            </div>
            <h1 
              style={{ fontFamily: 'var(--font-serif)' }}
              className="text-3xl sm:text-4xl font-normal text-[#f2efe7] tracking-tight leading-tight mb-2"
            >
              Create Operator <span className="text-[#ece9df]">Account</span>
            </h1>
            <p className="text-sm text-[#9ba69e] leading-relaxed">
              Join enterprise security teams safeguarding digital assets with verifiable multi-modal evidence.
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

          {/* Success Message */}
          {successMsg && (
            <div className="cairn-alert cairn-alert-info">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#d8f57b]" />
              <div className="flex-1">
                <span>{successMsg}</span>
              </div>
            </div>
          )}

          {/* Google Workspace Provisioning */}
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
            <span>Provision via Google Workspace</span>
          </button>

          <div className="hairline-divider">
            <span>or configure dedicated credentials</span>
          </div>

          {/* Registration Form */}
          <form onSubmit={handleSubmit}>
            {/* Full Name & Enterprise */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div className="cairn-input-group !mb-0">
                <label htmlFor="signup-name" className="cairn-label">
                  <span>Full Name</span>
                </label>
                <div className="cairn-input-wrapper">
                  <span className="cairn-input-icon">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    id="signup-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Elena Vance"
                    autoComplete="name"
                    required
                    className="cairn-input"
                  />
                </div>
              </div>

              <div className="cairn-input-group !mb-0">
                <label htmlFor="signup-org" className="cairn-label">
                  <span>Organization</span>
                </label>
                <div className="cairn-input-wrapper">
                  <span className="cairn-input-icon">
                    <Building2 className="w-4 h-4" />
                  </span>
                  <input
                    id="signup-org"
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="Northstar Financial"
                    autoComplete="organization"
                    required
                    className="cairn-input"
                  />
                </div>
              </div>
            </div>

            {/* Work Email */}
            <div className="cairn-input-group">
              <label htmlFor="signup-email" className="cairn-label">
                <span>Enterprise Work Email</span>
              </label>
              <div className="cairn-input-wrapper">
                <span className="cairn-input-icon">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="elena.vance@northstar.security"
                  autoComplete="email"
                  required
                  className="cairn-input font-mono"
                />
              </div>
            </div>

            {/* Operational Role Select Pills */}
            <div className="mb-4">
              <label className="cairn-label mb-2 block">
                <span>Operational Role Designation</span>
                <span className="text-[10px] font-mono text-[#d8f57b]">RBAC PROTOCOL</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {ROLES.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRole(role.id)}
                    className={`p-2.5 rounded text-left transition-all border ${
                      selectedRole === role.id
                        ? 'bg-[rgba(216,245,123,0.12)] border-[#d8f57b] text-[#f2efe7] shadow-[0_0_12px_rgba(216,245,123,0.15)]'
                        : 'bg-[rgba(10,13,12,0.6)] border-[rgba(236,233,223,0.1)] text-[#9ba69e] hover:border-[rgba(236,233,223,0.25)]'
                    }`}
                  >
                    <div className="text-xs font-medium text-[#f2efe7] flex items-center justify-between">
                      <span>{role.title}</span>
                      {selectedRole === role.id && <BadgeCheck className="w-3.5 h-3.5 text-[#d8f57b]" />}
                    </div>
                    <div className="text-[10px] text-[#69756d] leading-tight mt-1 line-clamp-2">
                      {role.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Password */}
            <div className="cairn-input-group !mb-1">
              <label htmlFor="signup-password" className="cairn-label">
                <span>Create Master Password</span>
              </label>
              <div className="cairn-input-wrapper">
                <span className="cairn-input-icon">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  autoComplete="new-password"
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

            {/* Password Strength Meter */}
            <PasswordStrength password={password} />

            {/* Terms and Immutable Audit Agreement */}
            <div className="mb-6 mt-4">
              <label className="cairn-checkbox-label">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  required
                  className="cairn-checkbox-input"
                />
                <span className="text-xs text-[#9ba69e]">
                  I certify that all investigative verdicts, notes, and escalations performed under this credential will be cryptographically signed to the immutable audit ledger.
                </span>
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
                  <span>Provisioning Supabase Credentials...</span>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span>Initialize Operator Credentials</span>
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </button>
          </form>

          {/* Already have an account link */}
          <div className="mt-6 text-center text-xs text-[#9ba69e]">
            <span>Already have provisioned credentials? </span>
            <Link 
              href="/login" 
              className="text-[#d8f57b] hover:text-[#efffb9] font-medium ml-1 underline underline-offset-4"
            >
              Sign in to console &rarr;
            </Link>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-auto pt-6 text-[11px] font-mono text-[#69756d] flex items-center justify-between border-t border-[rgba(236,233,223,0.06)]">
          <span>&copy; 2026 CAIRNWISE RISK LABS</span>
          <span className="flex items-center gap-1.5">
            <UserCheck className="w-3 h-3 text-[#d8f57b]" />
            <span>ROLE-BASED GOVERNANCE</span>
          </span>
        </div>
      </div>
    </main>
  );
}
