'use client';

// apps/web/components/auth/QuickDemoLogin.tsx
// ============================================================================
// One-click demo login cards on `/signin`:
//   - Log in as Student  (student@demo.campus360.bd)
//   - Log in as Faculty  (faculty@demo.campus360.bd)
//   - Log in as Admin    (admin@demo.campus360.bd)
//   - Log in as Alumni   (alumni@demo.campus360.bd)
//
// Posts to `/api/auth/demo-signin`, which establishes a verified Supabase
// session (or an HMAC-signed HTTP-only `campus360_demo_session` fallback cookie)
// without requiring email verification, OTP entry, or onboarding.
// ============================================================================

import React from 'react';
import { notifyAuthChanged } from '@/lib/auth-events';
import { useRouter } from 'next/navigation';
import { useUi } from '@/lib/i18n-client';
import {
  QUICK_DEMO_ACCOUNTS,
  setDemoSession,
  setDemoSignedOut,
  type QuickDemoAccount,
  type QuickDemoRole,
} from '@/lib/modules/demo-data';

const TONE_CLASSES: Record<QuickDemoAccount['tone'], string> = {
  emerald:
    'border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/15 hover:border-emerald-500 text-emerald-950 dark:text-emerald-100',
  sky: 'border-sky-500/40 bg-sky-500/5 hover:bg-sky-500/15 hover:border-sky-500 text-sky-950 dark:text-sky-100',
  amber:
    'border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/15 hover:border-amber-500 text-amber-950 dark:text-amber-100',
  violet:
    'border-violet-500/40 bg-violet-500/5 hover:bg-violet-500/15 hover:border-violet-500 text-violet-950 dark:text-violet-100',
};

export function QuickDemoLogin() {
  const router = useRouter();
  const { locale, t } = useUi();
  const [busyRole, setBusyRole] = React.useState<QuickDemoRole | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleClick(account: QuickDemoAccount) {
    if (busyRole) return;
    setError(null);
    setBusyRole(account.role);
    try {
      const response = await fetch('/api/auth/demo-signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: account.email,
          password: account.password,
          role: account.role,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || (!payload?.ok && !payload?.success)) {
        const err = payload?.error;
        setError(
          (locale === 'bn' ? err?.message_bn || err?.message_en : err?.message_en) ??
            t('Demo sign-in failed. Please try again.')
        );
        return;
      }

      const demoAccount = payload?.data?.account;
      setDemoSignedOut(false);
      setDemoSession({
        universityId: demoAccount?.universityId || 'demo-univ-ju',
        role: account.role,
        email: demoAccount?.email || account.email,
        fullName: demoAccount?.fullName || account.fullName,
      });

      notifyAuthChanged();

      const destination: string =
        payload?.redirectTo ||
        payload?.data?.redirectTo ||
        (account.role === 'admin' ? '/admin/console' : account.landing);

      router.push(destination);
      router.refresh();
    } catch {
      setError(t('Demo sign-in failed. Please try again.'));
    } finally {
      setBusyRole(null);
    }
  }

  return (
    <section
      aria-labelledby="quick-demo-login-heading"
      data-testid="quick-demo-login"
      className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold">
            ⚡ {locale === 'bn' ? 'এক ক্লিকে ডেমো অ্যাক্সেস' : 'Instant Demo Access'}
          </span>
          <h2 id="quick-demo-login-heading" className="text-lg font-bold mt-2">
            {locale === 'bn' ? 'দ্রুত ডেমো লগইন' : 'Quick Demo Login'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {locale === 'bn'
              ? 'কোনো ওটিপি বা ফর্ম ছাড়াই যেকোনো রোলের অভিজ্ঞতা নিন (জাহাঙ্গীরনগর বিশ্ববিদ্যালয় — JU)।'
              : 'Explore any role in one click — no OTP, email verification, or onboarding required.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {QUICK_DEMO_ACCOUNTS.map((account) => {
          const isBusy = busyRole === account.role;
          return (
            <button
              key={account.role}
              type="button"
              data-testid={`quick-demo-${account.role}`}
              disabled={busyRole !== null}
              onClick={() => void handleClick(account)}
              className={`group flex flex-col items-start justify-between text-left rounded-xl border p-3.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed min-w-0 ${TONE_CLASSES[account.tone]}`}
            >
              <div className="w-full min-w-0">
                <div className="flex items-center justify-between w-full gap-2">
                  <span className="text-xl shrink-0" aria-hidden>
                    {account.icon}
                  </span>
                  <span className="text-[11px] font-semibold opacity-75 group-hover:translate-x-0.5 transition-transform shrink-0">
                    {isBusy ? (locale === 'bn' ? 'লগইন হচ্ছে…' : 'Signing in…') : '→'}
                  </span>
                </div>
                <span className="mt-2 block text-sm font-bold leading-snug">
                  {locale === 'bn' ? account.labelBn : account.label}
                </span>
                <span className="mt-1 block text-[11px] opacity-80 leading-relaxed">
                  {locale === 'bn' ? account.blurbBn : account.blurb}
                </span>
              </div>
              <span
                title={account.email}
                className="mt-2.5 block w-full rounded-md bg-slate-900/5 dark:bg-white/5 px-2 py-1 font-mono text-[11px] leading-snug opacity-85 break-all"
              >
                {account.email}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <div
          role="alert"
          data-testid="quick-demo-error"
          className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs"
        >
          {error}
        </div>
      )}

      <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
        {locale === 'bn'
          ? 'ডেমো অ্যাকাউন্টগুলো জাহাঙ্গীরনগর বিশ্ববিদ্যালয় (JU • IIT) টেন্যান্টে সংযুক্ত — প্রতিটি ডেমো পাসওয়ার্ড Demo#1234।'
          : 'Demo accounts are pre-verified under Jahangirnagar University (JU • IIT) — password Demo#1234.'}
      </p>
    </section>
  );
}
