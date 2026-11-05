'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getDemoProfile, getDemoSession, isDemoSignedOut, subscribeDemoSession } from './demo-data';
import { isSupabaseConfigured, trySupabaseBrowser } from '@/lib/supabase-browser';
import { AUTH_CHANGED_EVENT, AUTH_CHANGED_STORAGE_KEY } from '@/lib/auth-events';

export interface SessionState {
  loading: boolean;
  authenticated: boolean;
  demo: boolean;
  userId: string | null;
  email: string | null;
  profile: {
    id: string;
    full_name: string;
    email?: string;
    trust_level: string;
    university_id?: string;
    universities?: { code: string; name_en: string; name_bn: string } | null;
  } | null;
  roles: string[];
  isAdmin: boolean;
  isGovernance: boolean;
  /** A failed session lookup is not evidence that the visitor is signed out. */
  error: boolean;
}

type SessionContextValue = SessionState & { refresh: () => void };
const initialState: SessionState = {
  loading: true, authenticated: false, demo: false, userId: null, email: null,
  profile: null, roles: [], isAdmin: false, isGovernance: false, error: false,
};
const SessionContext = createContext<SessionContextValue | null>(null);

/** One authoritative session for the shell and all pages beneath it. */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>(initialState);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;
    let sequence = 0;
    let controller: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribeDemo: (() => void) | undefined;
    let browserUserId: string | null = null;
    let serverSignedOut = false;
    let reconciledInitialUser = false;
    let authGeneration = 0;

    const load = async (reset = false, background = false) => {
      const request = ++sequence;
      controller?.abort();
      clearTimeout(timer);
      setState((previous) => reset
        ? { ...initialState }
        : { ...previous, loading: background && !previous.error ? previous.loading : true, error: false });

      if (!isSupabaseConfigured()) {
        if (isDemoSignedOut()) {
          if (!cancelled) setState({ ...initialState, loading: false, demo: true });
          return;
        }
        const session = getDemoSession();
        const profile = getDemoProfile(session);
        if (!cancelled) setState({
          loading: false, authenticated: true, demo: true,
          userId: profile.id, email: profile.email, profile,
          roles: profile.roles, isAdmin: session.role === 'admin',
          isGovernance: session.role === 'governance', error: false,
        });
        return;
      }

      controller = new AbortController();
      const signal = controller.signal;
      timer = setTimeout(() => controller?.abort(), 3000);
      try {
        // The route verifies the Supabase user and reads profiles and user_roles
        // by user.id. It also supports the signed HTTP-only quick-demo cookie.
        const response = await fetch('/api/auth/session', { cache: 'no-store', signal });
        if (!response.ok) throw new Error('Session request failed');
        const payload = await response.json();
        if (!payload?.success || !payload.data || typeof payload.data.authenticated !== 'boolean') {
          throw new Error('Invalid session response');
        }
        if (cancelled || request !== sequence) return;
        const data = payload.data;
        if (!data.authenticated) {
          serverSignedOut = true;
          // A browser user and server cookie can become visible at slightly
          // different times after login. Retry once, but never trust the browser
          // identity as authorization for server data.
          if (browserUserId && !reconciledInitialUser) {
            reconciledInitialUser = true;
            void load();
            return;
          }
          setState({ ...initialState, loading: false, demo: Boolean(data.demo) });
          return;
        }
        serverSignedOut = false;
        const roles: string[] = Array.isArray(data.roles)
          ? data.roles.map((row: { role?: unknown }) => String(row?.role ?? '').toUpperCase()).filter(Boolean)
          : [];
        setState({
          loading: false, authenticated: true, demo: Boolean(data.demo),
          userId: data.user?.id ? String(data.user.id) : data.profile?.id ? String(data.profile.id) : null,
          email: data.user?.email ?? data.profile?.email ?? null,
          profile: data.profile ?? null, roles,
          isAdmin: roles.some((role) => ['ADMIN', 'UNIVERSITY_ADMIN', 'SUPER_ADMIN'].includes(role)),
          isGovernance: roles.some((role) => ['GOVERNANCE', 'GOVERNING_BODY', 'UNIVERSITY_ADMIN', 'SUPER_ADMIN', 'ADMIN'].includes(role)),
          error: false,
        });
      } catch {
        if (!cancelled && request === sequence) {
          // Retain a previously verified session instead of falsely displaying
          // signed-out actions. Initial failures render a retry control.
          setState((previous) => ({ ...previous, loading: false, error: true }));
        }
      } finally {
        if (request === sequence) clearTimeout(timer);
      }
    };

    void load();
    if (!isSupabaseConfigured()) unsubscribeDemo = subscribeDemoSession(() => void load());

    // Supabase events cover browser sign-in/out, refresh and other tabs. Defer
    // the fetch: awaiting Supabase work inside onAuthStateChange can deadlock.
    const browser = trySupabaseBrowser();
    const subscription = browser?.auth.onAuthStateChange((event) => {
      if (event === 'INITIAL_SESSION') return;
      // Invalidate any in-flight request synchronously so an old signed-out
      // response cannot overwrite a newer sign-in (or vice versa).
      sequence += 1;
      controller?.abort();
      clearTimeout(timer);
      const identityChanged = event === 'SIGNED_IN' || event === 'SIGNED_OUT';
      if (identityChanged) {
        authGeneration += 1;
        if (event === 'SIGNED_OUT') browserUserId = null;
        setState({ ...initialState });
      }
      setTimeout(() => { if (!cancelled) void load(identityChanged, !identityChanged); }, 0);
    }).data.subscription;
    // Also verify the browser's Supabase identity on mount. The server session
    // endpoint remains authoritative and supports HTTP-only demo cookies.
    if (browser) {
      const generation = authGeneration;
      void browser.auth.getUser().then(({ data }) => {
        if (cancelled || generation !== authGeneration) return;
        browserUserId = data.user?.id ?? null;
        if (browserUserId && serverSignedOut && !reconciledInitialUser) {
          reconciledInitialUser = true;
          void load();
        }
      }).catch(() => undefined);
    }
    const onAuthChanged = () => { void load(true); };
    const onFocus = () => { void load(false, true); };
    const onStorage = (event: StorageEvent) => { if (event.key === AUTH_CHANGED_STORAGE_KEY) onAuthChanged(); };
    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onFocus);
    return () => {
      cancelled = true;
      sequence += 1;
      controller?.abort();
      clearTimeout(timer);
      unsubscribeDemo?.();
      subscription?.unsubscribe();
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onFocus);
    };
  }, [refreshKey]);

  return <SessionContext.Provider value={{ ...state, refresh }}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used within SessionProvider');
  return session;
}
