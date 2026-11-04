'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUi } from '@/lib/i18n-client';
import { IdVerificationCard, type IdVerificationOutcome } from '@/components/auth/IdVerificationCard';
import { DemoOtpPanel } from '@/components/auth/DemoOtpPanel';
import { getDemoUniversity, setDemoSession, setDemoSignedOut, type DemoRole } from '@/lib/modules/demo-data';

interface SignupContext {
  email: string;
  universityId: string;
  role: DemoRole;
  fullName: string;
  studentId: string;
  hallId?: string;
  departmentId?: string;
  programId?: string;
  demoCode?: string | null;
  demo?: boolean;
  /** ISO deadline of the emailed OTP (generation time + 5 minutes). */
  expiresAt?: string | null;
}

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function secondsUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return null;
  return Math.max(0, Math.round((time - Date.now()) / 1000));
}

function readContext(): SignupContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem('campus360.signup');
    return raw ? (JSON.parse(raw) as SignupContext) : null;
  } catch {
    return null;
  }
}

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useUi();
  const [context, setContext] = React.useState<SignupContext | null>(null);
  const [email, setEmail] = React.useState(searchParams.get('email') ?? '');
  const [otp, setOtp] = React.useState('');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [verified, setVerified] = React.useState(false);
  const [nextStep, setNextStep] = React.useState('/feed');
  const [outcome, setOutcome] = React.useState<IdVerificationOutcome | null>(null);
  const [demoCode, setDemoCode] = React.useState<string | null>(null);
  // Real email OTP: TTL countdown + resend cooldown, both driven by the
  // /api/auth/request-otp response (secondsRemaining / cooldownSeconds).
  const [expiresIn, setExpiresIn] = React.useState<number | null>(null);
  const [cooldown, setCooldown] = React.useState(0);

  React.useEffect(() => {
    const stored = readContext();
    if (stored) {
      setContext(stored);
      setEmail(stored.email);
      setDemoCode(stored.demoCode ?? null);
      setExpiresIn(secondsUntil(stored.expiresAt));
    }
  }, []);

  const countdownActive = expiresIn !== null || cooldown > 0;
  React.useEffect(() => {
    if (!countdownActive) return;
    const timer = window.setInterval(() => {
      setExpiresIn((value) => (value === null ? value : Math.max(0, value - 1)));
      setCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [countdownActive]);

  const university = getDemoUniversity(context?.universityId ?? '');
  const role = context?.role ?? 'student';

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const payload = await response.json();
      if (!payload.success) {
        setErrorMsg(payload?.error?.message_en ?? t('Verification failed'));
        return;
      }
      setVerified(true);
      setNextStep(payload.data?.nextStep ?? '/feed');
      if (payload.data?.demo && context) {
        setDemoSignedOut(false);
        setDemoSession({
          universityId: context.universityId,
          role: context.role,
          email: context.email,
          fullName: context.fullName,
        });
      }
      router.refresh();
    } catch {
      setErrorMsg(t('Verification failed'));
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    const targetEmail = context?.email ?? email;
    if (!targetEmail) return;
    setLoading(true);
    try {
      const response = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          universityId: context?.universityId,
          role: context?.role,
          signupPayload: {
            fullName: context?.fullName,
            studentId: context?.studentId,
            role: context?.role ?? 'student',
            // The profile row is created from the *latest* challenge payload,
            // so a resend that drops these silently loses them for good.
            hallId: context?.hallId,
            departmentId: context?.departmentId,
            programId: context?.programId,
          },
        }),
      });
      const payload = await response.json();
      if (payload?.success) {
        // Demo mode only: the server hands back the code to show in the panel.
        setDemoCode(payload?.data?.demoCode ?? null);
        const fromSeconds = Number(payload?.data?.secondsRemaining);
        setExpiresIn(
          Number.isFinite(fromSeconds) && fromSeconds > 0
            ? fromSeconds
            : secondsUntil(payload?.data?.expiresAt)
        );
        setCooldown(Number(payload?.data?.cooldownSeconds) || 0);
        setErrorMsg(null);
      } else {
        setErrorMsg(payload?.error?.message_en ?? t('Verification failed'));
      }
    } catch {
      setErrorMsg(t('Verification failed'));
    } finally {
      setLoading(false);
    }
  }

  function finish() {
    if (outcome) {
      try {
        window.sessionStorage.setItem('campus360.idverification', JSON.stringify(outcome));
      } catch {
        /* ignore */
      }
    }
    router.push(nextStep);
  }

  if (!verified) {
    return (
      <div className="max-w-md mx-auto my-16 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <h1 className="text-xl font-bold">{t('Verify 6-Digit OTP')}</h1>
        <p className="text-xs text-slate-500 mt-1">{t('Enter the 6-digit code sent to your university email.')}</p>
        {email && (
          <p className="text-xs text-slate-500 mt-1">
            {t('Email')}: <strong>{email}</strong>
          </p>
        )}
        {/* Track B — Demo OTP panel. Renders only when the server issued a demo code. */}
        <DemoOtpPanel email={email} code={demoCode} />

        {!demoCode && (
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {t('A 6-digit code has been emailed to your university address. It expires 5 minutes after it is sent.')}
          </p>
        )}
        {expiresIn !== null && (
          <p
            className={`mt-2 text-[11px] font-semibold ${
              expiresIn === 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'
            }`}
            data-testid="otp-countdown"
          >
            {expiresIn === 0
              ? t('Session expired')
              : t('Code expires in {time}', { time: formatClock(expiresIn) })}
          </p>
        )}

        <form onSubmit={handleVerify} className="mt-5 space-y-4">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl p-2.5 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
          />
          <input
            required
            maxLength={6}
            pattern="\d{6}"
            inputMode="numeric"
            placeholder={t('e.g. 482910')}
            value={otp}
            onChange={(event) => setOtp(event.target.value)}
            className="w-full rounded-xl p-3 text-center text-2xl tracking-[0.5em] font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
          />
          {errorMsg && <p className="text-xs text-rose-500">{errorMsg}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm disabled:opacity-60"
          >
            {loading ? t('Verifying…') : t('Verify & Continue')}
          </button>
          <button
            type="button"
            onClick={resend}
            disabled={loading || cooldown > 0}
            className="w-full text-xs text-emerald-600 dark:text-emerald-400 hover:underline disabled:text-slate-400 disabled:no-underline dark:disabled:text-slate-500"
          >
            {cooldown > 0 ? t('Resend code in {seconds}s', { seconds: cooldown }) : t('Resend code')}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto my-10 space-y-4">
      <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
        <h1 className="text-lg font-bold text-emerald-700 dark:text-emerald-300">✓ {t('Email verified')}</h1>
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
          {t('Signed in as')} {context?.fullName ?? email} • {t('Your role')}: {t(role === 'admin' ? 'University Admin' : role === 'faculty' ? 'Faculty / Staff' : role === 'alumni' ? 'Alumni' : 'Student')}
          {university ? ` • ${university.code}` : ''}
        </p>
      </div>

      {!outcome && (
        <IdVerificationCard
          studentId={context?.studentId ?? ''}
          fullName={context?.fullName ?? ''}
          universityCode={university?.code ?? 'BD'}
          onComplete={(result) => setOutcome(result)}
          onSkip={finish}
        />
      )}

      {outcome && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                outcome.status === 'VERIFIED'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
              }`}
            >
              {outcome.status === 'VERIFIED' ? t('ID verified') : t('Manual review')}
            </span>
            <span className="text-xs text-slate-500">{t('OCR confidence')}: {outcome.confidence}%</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {outcome.status === 'VERIFIED' ? t('verified') : t('manualReview')}
          </p>
          <button
            type="button"
            onClick={finish}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 text-white"
          >
            {t('Continue to dashboard')}
          </button>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <React.Suspense fallback={<div className="text-center mt-20 text-sm">{/* Loading */}…</div>}>
      <VerifyEmailForm />
    </React.Suspense>
  );
}
