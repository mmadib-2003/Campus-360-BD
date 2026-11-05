'use client';

// apps/web/components/auth/DevSignInPanel.tsx
// Password-based demo sign-in (success criterion 1) — appears only when
// NEXT_PUBLIC_AUTH_MODE === 'demo'. Authenticates against the seeded demo
// accounts (student / admin / governance per university, password Demo#1234)
// via signInWithPassword, bypassing the Supabase OTP email limits entirely.

import React from 'react';
import { notifyAuthChanged } from '@/lib/auth-events';
import { useRouter } from 'next/navigation';
import { useUi } from '@/lib/i18n-client';
import {
  DEMO_ACCOUNTS,
  setDemoSession,
  setDemoSignedOut,
  type DemoRole,
} from '@/lib/modules/demo-data';

export function isDevSignInEnabled(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_MODE === 'demo';
}

function landingFor(role: DemoRole): string {
  if (role === 'admin') return '/admin/console';
  if (role === 'governance') return '/governance/dashboard';
  return '/feed';
}

export function DevSignInPanel({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { t } = useUi();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('Demo#1234');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  if (!isDevSignInEnabled()) return null;

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch('/api/auth/demo-signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json();
      if (!payload?.success) {
        setError(payload?.error?.message_en ?? t('Verification failed'));
        return;
      }
      const account = payload.data?.account;
      if (payload.data?.demo && account) {
        setDemoSignedOut(false);
        setDemoSession({
          universityId: account.universityId,
          role: account.role as DemoRole,
          email: account.email,
          fullName: account.fullName,
        });
      }
      notifyAuthChanged();
      router.push(payload?.redirectTo ?? landingFor((account?.role as DemoRole) ?? 'student'));
      router.refresh();
    } catch {
      setError(t('Verification failed'));
    } finally {
      setLoading(false);
    }
  }

  const suggestions = DEMO_ACCOUNTS.filter((account) =>
    ['student', 'admin', 'governance'].includes(account.role)
  ).slice(0, compact ? 3 : 6);

  return (
    <div
      className="mt-5 p-4 rounded-2xl border border-amber-500/40 bg-amber-500/5"
      data-testid="dev-signin-panel"
    >
      <div className="flex items-center gap-2">
        <span aria-hidden>🧪</span>
        <span className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          {t('Demo accounts (Dev sign-in)')}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
        {t('Password sign-in with pre-seeded accounts — bypasses OTP email limits. Every demo password is Demo#1234.')}
      </p>

      <form onSubmit={signIn} className="mt-3 space-y-2.5">
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t('Email')}
          aria-label={t('Email')}
          className="w-full rounded-xl p-2.5 text-sm bg-white dark:bg-slate-900 border border-amber-500/40"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={t('Password')}
          aria-label={t('Password')}
          className="w-full rounded-xl p-2.5 text-sm bg-white dark:bg-slate-900 border border-amber-500/40"
        />
        {error && <p className="text-xs text-rose-500">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-amber-950 text-sm font-semibold disabled:opacity-60"
        >
          {loading ? t('Signing in…') : t('Sign in with demo account')}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {suggestions.map((account) => (
          <button
            key={account.email}
            type="button"
            onClick={() => {
              setEmail(account.email);
              setPassword(account.password);
            }}
            className="px-2 py-1 rounded-lg text-[10px] font-mono bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/30"
          >
            {account.email}
          </button>
        ))}
        <a href="/demo" className="px-2 py-1 rounded-lg text-[10px] font-semibold text-amber-800 dark:text-amber-200 underline">
          {t('See all demo accounts')} →
        </a>
      </div>
    </div>
  );
}
