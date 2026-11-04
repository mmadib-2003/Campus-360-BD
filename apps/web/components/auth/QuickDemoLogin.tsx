// apps/web/components/auth/QuickDemoLogin.tsx
// ============================================================================
// One-click, role-based demo accounts on /signin.
//
// Visitors should never have to guess a credential or wait for an OTP email to
// see the product. Each button fills the canonical demo identity and signs in
// immediately through /api/auth/demo-signin (GoTrue password grant when
// Supabase is configured, the offline demo store otherwise).
//
// The four addresses are provisioned by
// supabase/seed/seed_quick_demo_accounts.sql with a hardcoded bcrypt hash of
// Demo#1234, so this works on a fresh preview and on a live project alike.
// ============================================================================

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useUi } from '@/lib/i18n-client';
import {
  QUICK_DEMO_ACCOUNTS,
  setDemoSession,
  setDemoSignedOut,
  type DemoRole,
  type QuickDemoAccount,
  type QuickDemoRole,
} from '@/lib/modules/demo-data';

const TONES: Record<
  QuickDemoAccount['tone'],
  { card: string; icon: string; badge: string; spinner: string }
> = {
  emerald: {
    card: 'border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500/70 hover:bg-emerald-500/10',
    icon: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    spinner: 'border-emerald-700/30 border-t-emerald-700 dark:border-emerald-300/30 dark:border-t-emerald-300',
  },
  sky: {
    card: 'border-sky-500/40 bg-sky-500/5 hover:border-sky-500/70 hover:bg-sky-500/10',
    icon: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    badge: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    spinner: 'border-sky-700/30 border-t-sky-700 dark:border-sky-300/30 dark:border-t-sky-300',
  },
  amber: {
    card: 'border-amber-500/40 bg-amber-500/5 hover:border-amber-500/70 hover:bg-amber-500/10',
    icon: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    spinner: 'border-amber-700/30 border-t-amber-700 dark:border-amber-300/30 dark:border-t-amber-300',
  },
  violet: {
    card: 'border-violet-500/40 bg-violet-500/5 hover:border-violet-500/70 hover:bg-violet-500/10',
    icon: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
    badge: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
    spinner: 'border-violet-700/30 border-t-violet-700 dark:border-violet-300/30 dark:border-t-violet-300',
  },
};

export function QuickDemoLogin() {
  const router = useRouter();
  const { locale, t } = useUi();
  const [pending, setPending] = React.useState<QuickDemoRole | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function signIn(account: QuickDemoAccount) {
    if (pending) return;
    setError(null);
    setPending(account.role);
    try {
      const response = await fetch('/api/auth/demo-signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: account.email, password: account.password }),
      });
      const payload = await response.json().catch(() => null);
      if (!payload?.success) {
        setError(
          payload?.error?.message_en ??
            t('Could not start the demo session. Please try again.')
        );
        return;
      }

      // Offline/preview mode keeps the session in the local demo store. With
      // Supabase configured the route has already written the auth cookie.
      if (payload.data?.demo) {
        setDemoSignedOut(false);
        setDemoSession({
          universityId: payload.data?.account?.universityId ?? '',
          role: account.role as DemoRole,
          email: account.email,
          fullName: account.fullName,
        });
      }

      router.push(account.landing);
      router.refresh();
    } catch {
      setError(t('Could not start the demo session. Please try again.'));
    } finally {
      setPending(null);
    }
  }

  return (
    <section
      className="mt-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/40 p-4"
      data-testid="quick-demo-login"
      aria-labelledby="quick-demo-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="quick-demo-heading" className="text-sm font-bold flex items-center gap-1.5">
            <span aria-hidden>⚡</span> {t('Quick Demo Login')}
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {t('One click, no OTP. Pick a role to explore the full product instantly.')}
          </p>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          {t('Demo data only')}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {QUICK_DEMO_ACCOUNTS.map((account, index) => {
          const tone = TONES[account.tone];
          const isPending = pending === account.role;
          return (
            <motion.button
              key={account.email}
              type="button"
              onClick={() => void signIn(account)}
              disabled={pending !== null}
              aria-label={`${locale === 'bn' ? account.labelBn : account.label} — ${account.email}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + index * 0.06, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              whileHover={pending ? undefined : { scale: 1.02, y: -2 }}
              whileTap={pending ? undefined : { scale: 0.98 }}
              className={`group text-left rounded-xl border p-3 transition disabled:cursor-wait disabled:opacity-70 ${tone.card}`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-8 w-8 rounded-lg flex items-center justify-center text-base shrink-0 ${tone.icon}`} aria-hidden>
                  {account.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      {isPending ? t('Signing in…') : locale === 'bn' ? account.labelBn : account.label}
                    </span>
                    {isPending && (
                      <span
                        className={`h-3 w-3 rounded-full border-2 animate-spin ${tone.spinner}`}
                        aria-hidden
                      />
                    )}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                    {account.email}
                  </div>
                </div>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${tone.badge}`}>
                  {account.role}
                </span>
              </div>
              <p className="mt-1.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                {locale === 'bn' ? account.blurbBn : account.blurb}
              </p>
            </motion.button>
          );
        })}
      </div>

      {error && (
        <p className="mt-2 text-[11px] text-rose-600 dark:text-rose-400" role="alert">
          {error}
        </p>
      )}

      <p className="mt-2.5 text-[10px] text-slate-500 dark:text-slate-400">
        {t('All four demo accounts use the password')}{' '}
        <code className="px-1 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 font-mono text-[10px]">
          Demo#1234
        </code>
        . {t('No email or OTP is sent.')}
      </p>
    </section>
  );
}
