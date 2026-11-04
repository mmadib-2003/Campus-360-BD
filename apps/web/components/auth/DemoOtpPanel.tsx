'use client';

// apps/web/components/auth/DemoOtpPanel.tsx
// Track B — demo fallback panel.
//
// Renders ONLY when NEXT_PUBLIC_AUTH_MODE === 'demo' AND the server actually
// issued a demo code (`code` is returned by /api/auth/request-otp). The panel
// used to re-derive the code client-side from SHA-256(salt:email); that was
// dropped when real email OTP became the default, so the panel can never show
// a code the server refuses. Configure RESEND_API_KEY and the API stops
// returning a demoCode, which hides this panel on its own.

import React from 'react';
import { useUi } from '@/lib/i18n-client';
import { DEMO_OTP_TTL_MS } from '@/lib/demo-otp';

export function isDemoOtpPanelEnabled(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_MODE === 'demo';
}

export function DemoOtpPanel({ email, code }: { email: string; code?: string | null }) {
  const { t } = useUi();

  if (!isDemoOtpPanelEnabled() || !code) return null;

  const minutes = Math.max(1, Math.round(DEMO_OTP_TTL_MS / 60000));

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
        {email ? ` (${email})` : ''}
      </p>
      <div className="mt-2 flex items-center gap-3">
        <span
          data-testid="demo-otp-code"
          className="font-mono text-2xl font-bold tracking-[0.4em] text-amber-800 dark:text-amber-200 bg-white/70 dark:bg-slate-900/70 px-4 py-2 rounded-xl"
        >
          {code}
        </span>
        <span className="text-[10px] text-amber-700/80 dark:text-amber-200/80">
          {t('Valid for {minutes} minutes', { minutes })}
        </span>
      </div>
      <p className="mt-2 text-[10px] text-amber-700/70 dark:text-amber-200/70">
        {t('Set RESEND_API_KEY to switch this deployment to real email delivery with a 5-minute single-use OTP.')}
      </p>
    </div>
  );
}
