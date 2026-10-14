'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getSupabase, isSupabaseConfigured, UserSession } from './supabase';

interface AuthContextType {
  user: UserSession | null;
  loading: boolean;
  isConfigured: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string, metadata?: { fullName?: string; organization?: string; role?: string }) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'cairnwise_demo_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();

    if (supabase) {
      // Real Supabase session handler
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            fullName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
            organization: session.user.user_metadata?.organization,
            role: session.user.user_metadata?.role || 'analyst',
            provider: session.user.app_metadata?.provider === 'google' ? 'google' : 'email',
          });
        }
        setLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            fullName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
            organization: session.user.user_metadata?.organization,
            role: session.user.user_metadata?.role || 'analyst',
            provider: session.user.app_metadata?.provider === 'google' ? 'google' : 'email',
          });
        } else {
          setUser(null);
        }
        setLoading(false);
      });

      return () => {
        subscription.unsubscribe();
      };
    } else {
      // Local preview / evaluation mode persistence
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) {
          setUser(JSON.parse(stored));
        }
      } catch {
        // Ignore localStorage error
      }
      setLoading(false);
    }
  }, []);

  const signInWithEmail = async (email: string, password: string): Promise<{ error: string | null }> => {
    const supabase = getSupabase();

    if (supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        return { error: error.message };
      }
      return { error: null };
    }

    // Interactive Demo / Prototype simulation
    if (!email || !password) {
      return { error: 'Please enter both email and password.' };
    }
    if (password.length < 8) {
      return { error: 'Password must be at least 8 characters long.' };
    }

    const demoUser: UserSession = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      email,
      fullName: email.split('@')[0],
      organization: 'Northstar Financial',
      role: 'analyst',
      provider: 'email',
    };
    setUser(demoUser);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(demoUser));
    } catch {}
    return { error: null };
  };

  const signUpWithEmail = async (
    email: string, 
    password: string, 
    metadata?: { fullName?: string; organization?: string; role?: string }
  ): Promise<{ error: string | null }> => {
    const supabase = getSupabase();

    if (supabase) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: metadata?.fullName,
            organization: metadata?.organization,
            role: metadata?.role || 'analyst',
          },
        },
      });
      if (error) {
        return { error: error.message };
      }
      return { error: null };
    }

    // Demo mode simulation
    if (!email || !password) {
      return { error: 'Please provide all required fields.' };
    }
    if (password.length < 8) {
      return { error: 'Password must be at least 8 characters.' };
    }

    const demoUser: UserSession = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      email,
      fullName: metadata?.fullName || email.split('@')[0],
      organization: metadata?.organization || 'Enterprise Org',
      role: metadata?.role || 'analyst',
      provider: 'email',
    };
    setUser(demoUser);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(demoUser));
    } catch {}
    return { error: null };
  };

  const signInWithGoogle = async (): Promise<{ error: string | null }> => {
    const supabase = getSupabase();

    if (supabase) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/workspace` : undefined,
        },
      });
      if (error) {
        return { error: error.message };
      }
      return { error: null };
    }

    // Demo Mode Google Auth Simulation
    const demoUser: UserSession = {
      id: 'usr_goog_' + Math.random().toString(36).substring(2, 9),
      email: 'analyst@northstarpay.example',
      fullName: 'Security Analyst',
      organization: 'Northstar Pay Operations',
      role: 'reviewer',
      provider: 'google',
    };
    setUser(demoUser);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(demoUser));
    } catch {}
    return { error: null };
  };

  const signOut = async () => {
    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch {}
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isConfigured: isSupabaseConfigured,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
