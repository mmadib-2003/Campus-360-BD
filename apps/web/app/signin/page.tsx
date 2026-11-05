'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUi } from '@/lib/i18n-client';
import { DevSignInPanel } from '@/components/auth/DevSignInPanel';
import { QuickDemoLogin } from '@/components/auth/QuickDemoLogin';
import { UniversityCombobox, type UniversityOption } from '@/components/auth/UniversityCombobox';
import { HallCombobox, type HallOption } from '@/components/auth/HallCombobox';

function inferRole(email: string): 'student' | 'faculty' | 'alumni' | 'admin' | 'governance' {
  const local = email.split('@')[0]?.toLowerCase() ?? '';
  if (local.startsWith('governance') || local.includes('governance')) return 'governance';
  if (local.startsWith('admin') || local.includes('admin')) return 'admin';
  if (local.startsWith('faculty') || local.startsWith('teacher')) return 'faculty';
  if (local.startsWith('alumni')) return 'alumni';
  return 'student';
}

/** True when /api/auth/session reports a signed-in, email-verified account. */
function isVerifiedSessionPayload(payload: unknown): boolean {
  const data = (payload as { data?: Record<string, unknown> })?.data;
  if (!data || data.authenticated !== true) return false;
  const profile = data.profile as Record<string, unknown> | null | undefined;
  return (
    profile?.email_verified === true ||
    profile?.is_verified === true ||
    data.email_verified === true ||
    ['EMAIL_VERIFIED', 'ID_VERIFIED', 'TRUSTED'].includes(String(profile?.trust_level ?? ''))
  );
}

export default function SignInPage() {
  const router = useRouter();
  const { t } = useUi();
  const [email, setEmail] = React.useState('');
  const [universities, setUniversities] = React.useState<UniversityOption[]>([]);
  const [universityId, setUniversityId] = React.useState('');
  const [halls, setHalls] = React.useState<HallOption[]>([]);
  const [hallId, setHallId] = React.useState('');
  const [sessionChecked, setSessionChecked] = React.useState(false);
  // Lock so a double-click can never fire two request-otp calls back-to-back.
  const isSubmittingRef = React.useRef(false);

  // Already signed in and verified? Go straight to the dashboard — never show
  // the sign-in form (or a stale OTP error) to a verified user.
  React.useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth/session', { cache: 'no-store', signal: controller.signal })
      .then((response) => response.json())
      .then((payload) => {
        if (isVerifiedSessionPayload(payload)) {
          const next = new URLSearchParams(window.location.search).get('next');
          window.location.replace(next || '/');
          return;
        }
        setSessionChecked(true);
      })
      .catch(() => {
        if (!controller.signal.aborted) setSessionChecked(true);
      });
    return () => controller.abort();
  }, []);
  React.useEffect(() => {
    const controller = new AbortController();
    fetch('/api/universities', { cache: 'no-store', signal: controller.signal })
      .then((r) => r.json()).then((p) => setUniversities(Array.isArray(p.data) ? p.data : []))
      .catch(() => { if (!controller.signal.aborted) setError('Could not load universities. Please try again.'); });
    return () => controller.abort();
  }, []);
  React.useEffect(() => {
    setHallId('');
    setHalls([]);
    if (!universityId) return;
    const controller = new AbortController();
    fetch(`/api/halls?universityId=${encodeURIComponent(universityId)}`, { cache: 'no-store', signal: controller.signal })
      .then((r) => r.json()).then((p) => setHalls(Array.isArray(p.data) ? p.data : []))
      .catch(() => { if (!controller.signal.aborted) setError('Could not load halls. Please try again.'); });
    return () => controller.abort();
  }, [universityId]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function handleOtpSignIn(event: React.FormEvent) {
    event.preventDefault();
    if (isSubmittingRef.current) return;
    setError(null);
    if (!universityId) { setError('Please select your university'); return; }
    if (!hallId || !halls.some((hall) => hall.id === hallId)) { setError('Please select your residential hall'); return; }
    isSubmittingRef.current = true;
    setLoading(true);
    try {
      const role = inferRole(email);
      const response = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, universityId, role, signupPayload: { role, hallId } }),
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
            universityId: payload.data?.universityId ?? universityId,
            hallId,
            hallName: halls.find((hall) => hall.id === hallId)?.name ?? '',
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
      isSubmittingRef.current = false;
    }
  }

  if (!sessionChecked) {
    return (
      <div role="status" className="w-full max-w-full mx-auto my-16 px-3 sm:px-6 text-center text-sm text-slate-500 dark:text-slate-400">
        {t('Checking your session…')}
      </div>
    );
  }

  return (
    <div className="w-full max-w-full lg:max-w-7xl mx-auto my-8 px-3 sm:px-6">
      {/* Single column on mobile: email sign-in first, quick demo below. */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <section className="lg:col-span-7 p-4 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-3">
        <img
          src="/logos/campus360-logo.jpg"
          alt="Campus360 BD"
          className="h-12 w-12 rounded-full object-cover bg-white p-0.5 shadow-sm shrink-0"
        />
        <div>
          <h1 className="text-xl font-bold">{t('Sign In')}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('University email OTP is required for every account.')}</p>
        </div>
      </div>

      <div className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-800">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {t('Or sign in with your university email')}
        </p>
        <form onSubmit={handleOtpSignIn} className="mt-3 max-w-md space-y-4 text-sm">
        <UniversityCombobox universities={universities} value={universityId} onChange={setUniversityId}
          label={t('Public University')} placeholder={t('Search university by name, code or city…')} />
        <HallCombobox halls={halls} value={hallId} onChange={setHallId}
          label={t('Residential Hall')} placeholder={t('Search your residential hall…')} disabled={!universityId} />
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
            className="w-full max-w-full min-h-[44px] rounded-xl p-2.5 text-base sm:text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
          />
        </div>
        {error && <p className="text-xs text-rose-500">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[44px] py-2.5 rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-60"
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
      <aside className="lg:col-span-5 lg:sticky lg:top-24 w-full max-w-full">
        <QuickDemoLogin />
      </aside>
      </div>
    </div>
  );
}
