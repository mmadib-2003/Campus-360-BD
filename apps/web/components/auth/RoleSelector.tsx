'use client';

import React from 'react';
import { useUi } from '@/lib/i18n-client';
import { AUTH_ROLES } from '@/lib/auth-rules';

export function RoleSelector({ value, onChange, disabled, id = 'auth-role' }: {
  value: string;
  onChange: (role: string) => void;
  disabled?: boolean;
  id?: string;
}) {
  const { t } = useUi();
  return (
    <div>
      <label htmlFor={id} className="block font-medium mb-1 text-sm">
        {t('Role')} <span className="text-rose-500" aria-hidden>*</span>
      </label>
      <select
        id={id}
        required
        aria-required="true"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full min-h-[44px] rounded-xl p-2.5 text-base sm:text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 disabled:opacity-70"
      >
        <option value="" disabled>{t('Select your role')}</option>
        {AUTH_ROLES.map((role) => <option key={role.value} value={role.value}>{t(role.label)}</option>)}
      </select>
    </div>
  );
}
