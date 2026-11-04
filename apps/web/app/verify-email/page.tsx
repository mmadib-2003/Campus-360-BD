'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUi } from '@/lib/i18n-client';
import { IdVerificationCard, type IdVerificationOutcome } from '@/components/auth/IdVerificationCard';
import { getDemoUniversity, setDemoSession, setDemoSignedOut, type DemoRole } from '@/lib/modules/demo-data';

interface SignupContext {
  email: string;
  universityId: string;
  role: DemoRole;
  fullName: string;
  studentId: string;
  demoCode?: string | null;
  demo?: boolean;
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

  React.useEffect(() => {
    const stored = readContext();
    if (stored) {
      setContext(stored);
      setEmail(stored.email);
      setDemoCode(stored.demoCode ?? null);
    }
  }, []);

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
    if (!context) return;
    setLoading(true);
    try {
      const response = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: context.email,
          universityId: context.universityId,
          role: context.role,
          signupPayload: { fullName: context.fullName, studentId: context.studentId, role: context.role },
        }),
      });
      const payload = await response.json();
      if (payload?.data?.demoCode) setDemoCode(payload.data.demoCode);
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
        {demoCode && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs">
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">{t('Demo code')}:</span>{' '}
            <span className="font-mono text-base font-bold tracking-[0.3em] text-emerald-700 dark:text-emerald-300">{demoCode}</span>
          </div>
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
          <button type="button" onClick={resend} className="w-full text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
            {t('Resend code')}
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
