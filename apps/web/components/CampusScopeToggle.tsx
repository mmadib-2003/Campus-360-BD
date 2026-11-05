'use client';

import React from 'react';
import { useUi } from '@/lib/i18n-client';
import { useCampusScope } from '@/lib/use-campus-scope';
import type { CampusScope } from '@/lib/campus-scope';

/** Can be controlled by a page, or use the current URL directly. */
export function CampusScopeToggle({
  scope: controlledScope,
  onScopeChange,
  universityCode,
}: { scope?: CampusScope; onScopeChange?: (scope: CampusScope) => void; universityCode?: string | null } = {}) {
  const urlState = useCampusScope();
  const scope = controlledScope ?? urlState.scope;
  const setScope = onScopeChange ?? urlState.setScope;
  const { t } = useUi();
  return (
    <div className="mb-4 w-full max-w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
        <span className="text-xs font-semibold">{t('Campus scope')}</span>
        {/* Full-width 2-up grid on mobile so each option is a thumb target. */}
        <div role="group" aria-label={t('Campus scope')} className="w-full sm:w-auto grid grid-cols-2 sm:inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
          {(['my_campus', 'all'] as const).map((value) => (
            <button key={value} type="button" aria-pressed={scope === value} onClick={() => setScope(value)}
              className={`min-h-[44px] sm:min-h-0 min-w-0 truncate rounded-md px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold ${scope === value ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}>
              {value === 'all' ? `🌐 ${t('All Universities')}` : `🎓 ${t('My University Only')}${universityCode ? ` (${universityCode})` : ''}`}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">{t('Public listings only; private records remain protected.')}</p>
    </div>
  );
}
