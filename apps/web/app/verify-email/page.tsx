'use client';

import React from 'react';
import { notifyAuthChanged } from '@/lib/auth-events';
import { useSearchParams } from 'next/navigation';
import { useUi } from '@/lib/i18n-client';
import { DemoOtpPanel } from '@/components/auth/DemoOtpPanel';
import { setDemoSession, setDemoSignedOut, type DemoRole } from '@/lib/modules/demo-data';

interface SignupContext {
  email: string;
  universityId: string;
  role: DemoRole;
  fullName: string;
  studentId: string;
  hallId?: string | null;
  hallName?: string | null;
  programSession?: string | null;
  purpose?: string;
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

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const { t } = useUi();
  const nextUrl = searchParams.get('next');
  const [context, setContext] = React.useState<SignupContext | null>(null);
  const [email, setEmail] = React.useState(searchParams.get('email') ?? '');
  const [otp, setOtp] = React.useState('');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [isRedirecting, setIsRedirecting] = React.useState(false);
  // The form is not rendered until the session check resolves, so an already
  // verified user never sees the OTP form or a stale challenge error.
  const [sessionChecked, setSessionChecked] = React.useState(false);
  const [demoCode, setDemoCode] = React.useState<string | null>(null);
  // Real email OTP: TTL countdown + resend cooldown, both driven by the
  // /api/auth/request-otp response (secondsRemaining / cooldownSeconds).
  const [expiresIn, setExpiresIn] = React.useState<number | null>(null);
  const [cooldown, setCooldown] = React.useState(0);
  // Submission lock: auto-submit (6th digit) and the button can never fire two
  // concurrent or back-to-back POST /api/auth/verify-otp requests.
  const isSubmittingRef = React.useRef(false);

  // Already verified? Leave immediately — no OTP form, no error message.
  React.useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth/session', { cache: 'no-store', signal: controller.signal })
      .then((response) => response.json())
      .then((payload) => {
        if (isVerifiedSessionPayload(payload)) {
          window.location.replace(nextUrl || '/');
          return;
        }
        setSessionChecked(true);
      })
      .catch(() => {
        if (!controller.signal.aborted) setSessionChecked(true);
      });
    return () => controller.abort();
  }, [nextUrl]);

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

  async function submitOtp(codeOverride?: string) {
    const code = codeOverride ?? otp;
    if (isSubmittingRef.current) return;
    if (!/^\d{6}$/.test(code)) return;
    isSubmittingRef.current = true;
    setLoading(true);
    setErrorMsg(null);
    let redirecting = false;
    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp: code,
          // Admin uses the separate legacy challenge; public role metadata is
          // checked against the issued challenge, never used to replace a role.
          ...(context?.role && context.role !== 'admin' ? { role: context.role } : {}),
          ...(context?.role === 'student' && context.hallId ? { hallId: context.hallId } : {}),
          ...(context?.programSession ? { programSession: context.programSession } : {}),
          // The rest of the stored selection travels with the code so the
          // account can be provisioned even if the challenge row is unreadable.
          // The server still treats the issued challenge as authoritative.
          ...(context?.universityId ? { universityId: context.universityId } : {}),
          ...(context?.departmentId ? { departmentId: context.departmentId } : {}),
          ...(context?.programId ? { programId: context.programId } : {}),
          ...(context?.fullName ? { fullName: context.fullName } : {}),
          ...(context?.studentId ? { studentId: context.studentId } : {}),
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setErrorMsg(payload?.error?.message_en ?? t('Verification failed'));
        return;
      }
      if (payload.data?.demo && context) {
        setDemoSignedOut(false);
        setDemoSession({
          universityId: context.universityId,
          role: context.role,
          email: context.email,
          fullName: context.fullName,
          hallId: context.hallId ?? null,
          hallName: context.hallName ?? null,
          programSession: context.programSession ?? null,
        });
      }
      notifyAuthChanged();
      // Hard navigation: the session cookie is fresh, so the dashboard (and the
      // middleware) see the verified user on the very next request. Staying on
      // this page and calling router.refresh() is what left verified users
      // staring at a consumed challenge.
      redirecting = true;
      setIsRedirecting(true);
      window.location.replace(payload.data?.redirectTo || payload.data?.nextStep || '/');
    } catch {
      setErrorMsg(t('Verification failed'));
    } finally {
      setLoading(false);
      // Keep the lock held while the redirect is in flight.
      if (!redirecting) isSubmittingRef.current = false;
    }
  }

  function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    void submitOtp();
  }

  async function resend() {
    const targetEmail = context?.email ?? email;
    if (!targetEmail || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setLoading(true);
    try {
      const response = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          universityId: context?.universityId,
          role: context?.role,
          programSession: context?.programSession ?? undefined,
          purpose: context?.purpose,
          signupPayload: {
            fullName: context?.fullName,
            studentId: context?.studentId,
            role: context?.role ?? 'student',
            // The profile row is created from the *latest* challenge payload,
            // so a resend that drops these silently loses them for good.
            hallId: context?.role === 'student' ? context?.hallId : null,
            programSession: context?.programSession ?? undefined,
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
      isSubmittingRef.current = false;
    }
  }

  if (isRedirecting) {
    return (
      <div
        role="status"
        className="max-w-md mx-auto my-16 p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center"
      >
        <h1 className="text-lg font-bold text-emerald-700 dark:text-emerald-300">✓ {t('Email verified')}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
          {t('Verified! Redirecting to your campus dashboard...')}
        </p>
      </div>
    );
  }

  if (!sessionChecked) {
    return (
      <div role="status" className="max-w-md mx-auto my-16 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
        {t('Checking your session…')}
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto my-16 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <h1 className="text-xl font-bold">{t('Verify 6-Digit OTP')}</h1>
      <p className="text-xs text-slate-500 mt-1">{t('Enter the 6-digit code sent to your email address.')}</p>
      {email && (
        <p className="text-xs text-slate-500 mt-1">
          {t('Email')}: <strong>{email}</strong>
        </p>
      )}
      {/* Track B — Demo OTP panel. Renders only when the server issued a demo code. */}
      <DemoOtpPanel email={email} code={demoCode} />

      {!demoCode && (
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          {t('A 6-digit code has been emailed to your address. It expires 5 minutes after it is sent.')}
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
          className="w-full rounded-xl p-2.5 text-base sm:text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
        />
        <input
          required
          maxLength={6}
          pattern="\d{6}"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder={t('e.g. 482910')}
          value={otp}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, '').slice(0, 6);
            setOtp(digits);
            // Auto-submit the moment the 6th digit lands; the ref lock makes
            // this safe even if the user also clicks "Verify & Continue".
            if (digits.length === 6) void submitOtp(digits);
          }}
          className="w-full rounded-xl p-3 text-center text-2xl tracking-[0.5em] font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
        />
        {errorMsg && <p className="text-xs text-rose-500">{errorMsg}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[44px] py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm disabled:opacity-60"
        >
          {loading ? t('Verifying…') : t('Verify & Continue')}
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={loading || cooldown > 0}
          className="w-full min-h-[44px] text-xs text-emerald-600 dark:text-emerald-400 hover:underline disabled:text-slate-400 disabled:no-underline dark:disabled:text-slate-500"
        >
          {cooldown > 0 ? t('Resend code in {seconds}s', { seconds: cooldown }) : t('Resend code')}
        </button>
      </form>
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
