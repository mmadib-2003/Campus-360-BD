'use client';

// apps/web/app/demo/page.tsx
// Demo credential roster (success criterion 1): one student, one admin and one
// governance account per university for DU, BUET, SUST, RU and CU — all with
// the password Demo#1234, signable through signInWithPassword (no OTP email
// limits), following the DevSignInPanel pattern.

import React from 'react';
import { useRouter } from 'next/navigation';
import { useUi } from '@/lib/i18n-client';
import {
  DEMO_ACCOUNTS,
  setDemoSession,
  setDemoSignedOut,
  type DemoRole,
} from '@/lib/modules/demo-data';

const ROLE_LABELS: Record<string, string> = {
  student: 'Student',
  admin: 'Platform Admin',
  governance: 'University Governance',
};

function landingFor(role: DemoRole): string {
  if (role === 'admin') return '/admin/panel';
  if (role === 'governance') return '/governance/dashboard';
  return '/feed';
}

export default function DemoPage() {
  const router = useRouter();
  const { t, locale } = useUi();
  const [status, setStatus] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  async function quickSignIn(email: string) {
    setBusy(email);
    setStatus(null);
    try {
      const response = await fetch('/api/auth/demo-signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'Demo#1234' }),
      });
      const payload = await response.json();
      if (!payload?.success) {
        setStatus(payload?.error?.message_en ?? t('Verification failed'));
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
      router.push(landingFor((account?.role as DemoRole) ?? 'student'));
      router.refresh();
    } catch {
      setStatus(t('Verification failed'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto my-8 space-y-5">
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <h1 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{t('Demo accounts')}</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {t('One student, one platform admin and one governance account per university — password sign-in, no OTP email limits.')}
        </p>
        <p className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-semibold text-amber-700 dark:text-amber-300">
          🔑 {t('Password for every account')}: <span className="font-mono">Demo#1234</span>
        </p>
      </div>

      {status && (
        <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs">
          {status}
        </div>
      )}

      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-300 text-left">
              <th className="px-4 py-2.5 font-semibold">{t('Role')}</th>
              <th className="px-4 py-2.5 font-semibold">{t('University')}</th>
              <th className="px-4 py-2.5 font-semibold">{t('Email')}</th>
              <th className="px-4 py-2.5 font-semibold">{t('Password')}</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {DEMO_ACCOUNTS.map((account) => (
              <tr key={account.email} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-4 py-2.5">
                  <span
                    className={`px-2 py-0.5 rounded-full font-semibold ${
                      account.role === 'admin'
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-300'
                        : account.role === 'governance'
                          ? 'bg-violet-500/10 text-violet-600 dark:text-violet-300'
                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                    }`}
                  >
                    {t(ROLE_LABELS[account.role] ?? account.role)}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-semibold">{account.universityCode}</td>
                <td className="px-4 py-2.5 font-mono">{account.email}</td>
                <td className="px-4 py-2.5 font-mono">{account.password}</td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => void quickSignIn(account.email)}
                    disabled={busy === account.email}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-60"
                  >
                    {busy === account.email ? t('Signing in…') : t('Sign In')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
        <p className="font-semibold text-slate-700 dark:text-slate-200">{t('How demo sign-in works')}</p>
        <p>
          {locale === 'bn'
            ? 'অ্যাকাউন্টগুলো supabase/seed/seed_users_demo_accounts.sql-তে bcrypt হ্যাশ সহ সিড করা থাকে এবং signInWithPassword দিয়ে যাচাই হয় — ওটিপি ইমেইলের সীমা এড়ানো হয়।'
            : 'Accounts are seeded in supabase/seed/seed_users_demo_accounts.sql with bcrypt hashes and verified through signInWithPassword — the OTP email caps never apply.'}
        </p>
        <p>
          {locale === 'bn'
            ? 'ডেমো মোডে (NEXT_PUBLIC_AUTH_MODE=demo) সাইন-ইন পাতার DevSignInPanel-ও একই অ্যাকাউন্ট ব্যবহার করে।'
            : 'In demo mode (NEXT_PUBLIC_AUTH_MODE=demo) the DevSignInPanel on /signin uses these same accounts.'}
        </p>
      </div>
    </div>
  );
}
