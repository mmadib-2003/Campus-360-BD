'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUi } from '@/lib/i18n-client';
import { DevSignInPanel } from '@/components/auth/DevSignInPanel';
import { QuickDemoLogin } from '@/components/auth/QuickDemoLogin';

function inferRole(email: string): 'student' | 'faculty' | 'alumni' | 'admin' | 'governance' {
  const local = email.split('@')[0]?.toLowerCase() ?? '';
  if (local.startsWith('governance') || local.includes('governance')) return 'governance';
  if (local.startsWith('admin') || local.includes('admin')) return 'admin';
  if (local.startsWith('faculty') || local.startsWith('teacher')) return 'faculty';
  if (local.startsWith('alumni')) return 'alumni';
  return 'student';
}

export default function SignInPage() {
  const router = useRouter();
  const { t } = useUi();
  const [email, setEmail] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function handleOtpSignIn(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const role = inferRole(email);
      const response = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role, signupPayload: { role } }),
      });
      const payload = await response.json();
      if (!payload.success) {
        setError(payload?.error?.message_en ?? t('Verification failed'));
        return;
      }
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(
          'campus360.signup',
          JSON.stringify({
            email,
            universityId: payload.data?.universityId ?? '',
            role: payload.data?.role ?? role,
            fullName: email.split('@')[0] ?? 'Demo Student',
            studentId: '',
            demoCode: payload.data?.demoCode ?? null,
            demo: Boolean(payload.data?.demo),
            expiresAt: payload.data?.expiresAt ?? null,
          })
        );
      }
      router.push(`/verify-email?email=${encodeURIComponent(email)}&role=${role}`);
    } catch {
      setError(t('Verification failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto my-8 px-4">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)] gap-6 items-start">
      <section className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <h1 className="text-xl font-bold">{t('Sign In')}</h1>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('University email OTP is required for every account.')}</p>

      <div className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-800">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {t('Or sign in with your university email')}
        </p>
        <form onSubmit={handleOtpSignIn} className="mt-3 max-w-md space-y-4 text-sm">
        <div>
          <label className="block font-medium mb-1" htmlFor="signin-email">
            {t('University Email')}
          </label>
          <input
            id="signin-email"
            required
            type="email"
            placeholder="student@du.ac.bd"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
          />
        </div>
        {error && <p className="text-xs text-rose-500">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-60"
        >
          {loading ? t('Sending OTP…') : t('Send 6-Digit Verification OTP')}
        </button>
      </form>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
        <Link href="/signup" className="text-emerald-600 dark:text-emerald-400 hover:underline">
          {t('New here? Create an account')}
        </Link>
        <Link href="/admin/login" className="text-slate-500 hover:underline">
          {t('Admin Login')}
        </Link>
      </div>
      {/* Password-based demo accounts — only in demo mode (NEXT_PUBLIC_AUTH_MODE === 'demo'). */}
      <DevSignInPanel />
      </div>
      </section>
      <aside className="lg:sticky lg:top-6">
        <QuickDemoLogin />
      </aside>
      </div>
    </div>
  );
}
