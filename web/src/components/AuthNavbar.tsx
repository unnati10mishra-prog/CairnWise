'use client';

import Link from 'next/link';
import { BrandLogo } from './BrandLogo';
import { useAuth } from '@/lib/auth-context';
import { Shield, Sparkles, Terminal, LogOut } from 'lucide-react';

interface AuthNavbarProps {
  currentPath?: 'login' | 'signup' | 'forgot-password' | 'workspace';
}

export function AuthNavbar({ currentPath }: AuthNavbarProps) {
  const { user, isConfigured, signOut } = useAuth();

  return (
    <header className="w-full flex items-center justify-between pb-5 mb-5 border-b border-[rgba(236,233,223,0.08)] flex-nowrap gap-3">
      <div className="flex items-center flex-shrink-0">
        <BrandLogo size="md" />
      </div>

      <div className="flex items-center gap-2.5 sm:gap-3 flex-shrink-0 whitespace-nowrap">
        {/* Status Pill */}
        <div className="whitespace-nowrap flex-shrink-0 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(216,245,123,0.08)] border border-[rgba(216,245,123,0.25)] text-[10.5px] font-mono tracking-wider text-[#d8f57b] shadow-[0_0_12px_rgba(216,245,123,0.08)]">
          <span className="w-2 h-2 rounded-full bg-[#d8f57b] animate-pulse shadow-[0_0_8px_#d8f57b] flex-shrink-0" />
          <span className="whitespace-nowrap font-medium">OPS FEED ACTIVE</span>
        </div>

        {/* Supabase status indicator */}
        <span 
          title={isConfigured ? "Connected to live Supabase instance" : "Running in preview mode (demo auth enabled)"}
          className="whitespace-nowrap flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10.5px] font-mono tracking-wider uppercase text-[#c5d3bd] border-[rgba(216,245,123,0.25)] bg-[rgba(14,20,17,0.7)] shadow-[0_0_8px_rgba(216,245,123,0.06)]"
        >
          <Shield className="w-3.5 h-3.5 text-[#d8f57b] flex-shrink-0" />
          <span className="whitespace-nowrap font-medium">{isConfigured ? "Supabase Live" : "Supabase Ready"}</span>
        </span>

        {/* User state or navigation link */}
        {user ? (
          <div className="flex items-center gap-2.5 whitespace-nowrap flex-shrink-0">
            <Link 
              href="/workspace"
              className="whitespace-nowrap text-xs text-[#d8f57b] hover:text-[#efffb9] font-medium flex items-center gap-1.5 px-3 py-1.5 rounded border border-[rgba(216,245,123,0.25)] bg-[rgba(216,245,123,0.08)] transition-all shadow-[0_0_10px_rgba(216,245,123,0.1)] flex-shrink-0"
            >
              <Terminal className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="whitespace-nowrap">Workspace</span>
            </Link>
            <button
              onClick={() => signOut()}
              title="Sign Out"
              className="text-[#9ba69e] hover:text-[#ef8c8c] p-1.5 rounded transition-colors flex-shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center whitespace-nowrap flex-shrink-0">
            {currentPath === 'login' ? (
              <Link 
                href="/signup" 
                className="whitespace-nowrap text-xs text-[#9ba69e] hover:text-[#f2efe7] px-3.5 py-1.5 rounded border border-[rgba(236,233,223,0.16)] hover:border-[rgba(216,245,123,0.45)] bg-[rgba(14,20,17,0.6)] hover:bg-[rgba(216,245,123,0.06)] transition-all flex items-center gap-1.5 flex-shrink-0"
              >
                <span className="whitespace-nowrap">New Operator?</span>
                <span className="text-[#d8f57b] font-medium whitespace-nowrap">Sign Up</span>
              </Link>
            ) : currentPath === 'signup' ? (
              <Link 
                href="/login" 
                className="whitespace-nowrap text-xs text-[#9ba69e] hover:text-[#f2efe7] px-3.5 py-1.5 rounded border border-[rgba(236,233,223,0.16)] hover:border-[rgba(216,245,123,0.45)] bg-[rgba(14,20,17,0.6)] hover:bg-[rgba(216,245,123,0.06)] transition-all flex items-center gap-1.5 flex-shrink-0"
              >
                <span className="whitespace-nowrap">Existing Operator?</span>
                <span className="text-[#d8f57b] font-medium whitespace-nowrap">Log In</span>
              </Link>
            ) : (
              <Link 
                href="/login" 
                className="whitespace-nowrap text-xs text-[#d8f57b] hover:text-[#efffb9] px-3.5 py-1.5 rounded border border-[rgba(216,245,123,0.3)] bg-[rgba(216,245,123,0.08)] font-medium transition-all flex-shrink-0 shadow-[0_0_10px_rgba(216,245,123,0.1)]"
              >
                Console Login
              </Link>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
