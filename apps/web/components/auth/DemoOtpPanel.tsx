'use client';

// apps/web/components/auth/DemoOtpPanel.tsx
// Track B — Demo OTP fallback panel (success criterion 1).
//
// Renders ONLY when process.env.NEXT_PUBLIC_AUTH_MODE === 'demo'. Shows the
// unique deterministic 6-digit code (SHA-256(email + salt)) for the email
// awaiting verification, with its 10-minute TTL, so the flow completes without
// a real inbox when custom SMTP (Track A) is not configured.

import React from 'react';
import { useUi } from '@/lib/i18n-client';
import { computeDemoOtp, DEMO_OTP_TTL_MS } from '@/lib/demo-otp';

export function isDemoOtpPanelEnabled(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_MODE === 'demo';
}

export function DemoOtpPanel({ email, code }: { email: string; code?: string | null }) {
  const { t } = useUi();
  const [derived, setDerived] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    if (!code && email) {
      void computeDemoOtp(email).then((value) => {
        if (!cancelled) setDerived(value);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [code, email]);

  if (!isDemoOtpPanelEnabled()) return null;

  const displayCode = code ?? derived;
  const minutes = Math.round(DEMO_OTP_TTL_MS / 60000);

  return (
    <div
      role="status"
      className="mt-4 p-4 rounded-2xl border-2 border-dashed border-amber-500/50 bg-amber-500/10"
      data-testid="demo-otp-panel"
    >
      <div className="flex items-center gap-2">
        <span className="text-base" aria-hidden>
          🧪
        </span>
        <span className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          {t('Demo OTP')}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-amber-700/90 dark:text-amber-200/90">
        {t('Demo mode is on — no email is sent. Use this unique code for this email address.')}
      </p>
      <div className="mt-2 flex items-center gap-3">
        <span
          data-testid="demo-otp-code"
          className="font-mono text-2xl font-bold tracking-[0.4em] text-amber-800 dark:text-amber-200 bg-white/70 dark:bg-slate-900/70 px-4 py-2 rounded-xl"
        >
          {displayCode ?? '······'}
        </span>
        <span className="text-[10px] text-amber-700/80 dark:text-amber-200/80">
          {t('Valid for {minutes} minutes', { minutes })}
        </span>
      </div>
      <p className="mt-2 text-[10px] text-amber-700/70 dark:text-amber-200/70">
        {t('The code is a deterministic SHA-256 hash of the email address and is stored in profiles.demo_otp with a 10-minute TTL.')}
      </p>
    </div>
  );
}
