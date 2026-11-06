'use client';

import React from 'react';
import { PROGRAM_SESSION_OPTIONS, ProgramSessionSchema } from '@campus360/shared';
import { useUi } from '@/lib/i18n-client';

/** A native searchable combobox: suggestions plus unrestricted custom entry. */
export function ProgramSessionCombobox({ value, onChange, disabled, id = 'program-session' }: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
}) {
  const { t } = useUi();
  const invalid = value.length > 0 && !ProgramSessionSchema.safeParse(value).success;
  return (
    <div>
      <label htmlFor={id} className="block font-medium mb-1 text-sm">
        {t('Program Session')} <span className="text-rose-500" aria-hidden>*</span>
      </label>
      <input
        id={id}
        type="text"
        list={`${id}-options`}
        required
        aria-required="true"
        aria-invalid={invalid}
        aria-describedby={`${id}-hint${invalid ? ` ${id}-error` : ''}`}
        autoComplete="off"
        maxLength={7}
        pattern="[0-9]{4}-[0-9]{2}"
        placeholder="2023-24"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full min-h-[44px] rounded-xl p-2.5 text-base sm:text-sm bg-slate-100 dark:bg-slate-800 border ${invalid ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'} disabled:opacity-60`}
      />
      <datalist id={`${id}-options`}>
        {PROGRAM_SESSION_OPTIONS.map((session) => <option key={session} value={session} />)}
      </datalist>
      <p id={`${id}-hint`} className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
        {t('Choose a session from 1995-96 to 2025-26, or enter another YYYY-YY session.')}
      </p>
      {invalid && <p id={`${id}-error`} role="alert" className="text-xs text-rose-500 mt-1">
        {t('Enter consecutive years in YYYY-YY format, for example 2023-24.')}
      </p>}
    </div>
  );
}
