'use client';

import React from 'react';
import { useUi } from '@/lib/i18n-client';
import { allowsPersonalEmail, matchesUniversityDomain, requiresHall } from '@/lib/auth-rules';

export function RoleEmailField({ value, onChange, role, domains, disabled, id = 'auth-email' }: {
  value: string;
  onChange: (value: string) => void;
  role: string;
  domains: string[];
  disabled?: boolean;
  id?: string;
}) {
  const { t } = useUi();
  const personal = allowsPersonalEmail(role);
  const invalid = requiresHall(role) && value.includes('@') && !matchesUniversityDomain(value, domains);
  const placeholder = personal ? 'name@gmail.com' : domains[0] ? `name@${domains[0]}` : 'name@university.edu';
  return (
    <div>
      <label htmlFor={id} className="block font-medium mb-1 text-sm">
        {t(personal ? 'Email Address' : 'University Email')} <span className="text-rose-500" aria-hidden>*</span>
      </label>
      <input
        id={id}
        type="email"
        required
        aria-required="true"
        aria-invalid={invalid}
        aria-describedby={`${id}-hint${invalid ? ` ${id}-error` : ''}`}
        autoComplete="email"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full min-h-[44px] rounded-xl p-2.5 text-base sm:text-sm bg-slate-100 dark:bg-slate-800 border ${invalid ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'} disabled:opacity-60`}
      />
      <p id={`${id}-hint`} className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
        {personal
          ? t('Use your personal email (Gmail, Yahoo, Outlook, Hotmail, iCloud, etc.) or university email. A 6-digit OTP will be sent to verify your address.')
          : t('Use an approved email domain for your selected university. We will send a 6-digit OTP to verify your address.')}
      </p>
      {invalid && <p id={`${id}-error`} role="alert" className="text-xs text-rose-500 mt-1">
        {domains.length
          ? `${t('Approved domains')}: ${domains.map((domain) => `@${domain}`).join(', ')}`
          : t('Select a university with an approved email domain first.')}
      </p>}
    </div>
  );
}
