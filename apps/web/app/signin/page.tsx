'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUi } from '@/lib/i18n-client';
import { DevSignInPanel } from '@/components/auth/DevSignInPanel';
import { QuickDemoLogin } from '@/components/auth/QuickDemoLogin';
import { UniversityCombobox, type UniversityOption } from '@/components/auth/UniversityCombobox';
import { HallCombobox, type HallOption } from '@/components/auth/HallCombobox';
import { RoleSelector } from '@/components/auth/RoleSelector';
import { RoleEmailField } from '@/components/auth/RoleEmailField';
import {
  approvedDomains,
  displayNameFromEmail,
  hallForRole,
  matchesUniversityDomain,
  normalizeAccountEmail,
  requiresHall,
} from '@/lib/auth-rules';
import { RequestOtpSchema } from '@campus360/shared';

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
  const [role, setRole] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [loadingHalls, setLoadingHalls] = React.useState(false);
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
    if (!universityId || !requiresHall(role)) return;
    setLoadingHalls(true);
    const controller = new AbortController();
    fetch(`/api/halls?universityId=${encodeURIComponent(universityId)}`, { cache: 'no-store', signal: controller.signal })
      .then((r) => r.json()).then((p) => setHalls(Array.isArray(p.data) ? p.data : []))
      .catch(() => { if (!controller.signal.aborted) setError(t('Could not load halls. Please try again.')); })
      .finally(() => { if (!controller.signal.aborted) setLoadingHalls(false); });
    return () => controller.abort();
  }, [universityId, role, t]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function handleOtpSignIn(event: React.FormEvent) {
    event.preventDefault();
    if (isSubmittingRef.current) return;
    setError(null);
    if (!role) { setError(t('Select your role')); return; }
    if (!universityId) { setError(t('Please select your university')); return; }
    if (requiresHall(role) && (loadingHalls || !hallId || !halls.some((hall) => hall.id === hallId))) {
      setError(t('Please select your residential hall')); return;
    }
    const selectedHallId = hallForRole(role, hallId);
    const normalizedEmail = normalizeAccountEmail(email);
    // First-time sign-ins create the account from this payload, so the display
    // name default and the tenant travel with the challenge.
    const fullName = displayNameFromEmail(normalizedEmail);
    const request = { email: normalizedEmail, universityId, role, purpose: 'signin', hallId: selectedHallId,
      signupPayload: { role, hallId: selectedHallId, fullName, email: normalizedEmail, universityId } };
    if (!RequestOtpSchema.safeParse(request).success) { setError(t('Check your email, role and university details')); return; }
    const domains = approvedDomains(universities.find((university) => university.id === universityId));
    if (requiresHall(role) && !matchesUniversityDomain(email, domains)) {
      setError(t('Students must use an approved email domain for the selected university')); return;
    }
    isSubmittingRef.current = true;
    setLoading(true);
    try {
      const response = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
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
            email: normalizedEmail,
            universityId: payload.data?.universityId ?? universityId,
            hallId: selectedHallId,
            hallName: selectedHallId ? halls.find((hall) => hall.id === selectedHallId)?.name ?? '' : null,
            purpose: 'signin',
            role: payload.data?.role ?? role,
            fullName,
            studentId: '',
            programSession: null,
            departmentId: null,
            programId: null,
            demoCode: payload.data?.demoCode ?? null,
            demo: Boolean(payload.data?.demo),
            expiresAt: payload.data?.expiresAt ?? null,
          })
        );
      }
      router.push(`/verify-email?email=${encodeURIComponent(normalizedEmail)}&role=${role}`);
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
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('Email OTP is required for every account.')}</p>
        </div>
      </div>

      <div className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-800">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {t('Sign in with email verification')}
        </p>
        <form onSubmit={handleOtpSignIn} className="mt-3 max-w-md space-y-4 text-sm">
        <RoleSelector value={role} onChange={(next) => { setRole(next); setHallId(''); setError(null); }} disabled={loading} />
        <UniversityCombobox universities={universities} value={universityId} onChange={setUniversityId}
          label={t('Public University')} placeholder={t('Search university by name, code or city…')} />
        {requiresHall(role) && <HallCombobox halls={halls} value={hallId} onChange={setHallId}
          label={t('Residential Hall')} placeholder={t('Search your residential hall…')} disabled={!universityId || loadingHalls} />}
        <RoleEmailField id="signin-email" value={email} onChange={setEmail} role={role}
          domains={approvedDomains(universities.find((university) => university.id === universityId))} disabled={loading} />
        {error && <p className="text-xs text-rose-500">{error}</p>}
        <button
          type="submit"
          disabled={loading || (requiresHall(role) && loadingHalls)}
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
