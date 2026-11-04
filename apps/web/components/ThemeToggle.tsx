'use client';

// apps/web/components/ThemeToggle.tsx
// Sun/moon toggle for the persistent identity bar (success criterion 3).
// Persists via next-themes (localStorage) and follows the system preference
// until the user picks a theme.

import React from 'react';
import { useTheme } from 'next-themes';
import { useUi } from '@/lib/i18n-client';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useUi();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <button
      type="button"
      data-testid="theme-toggle"
      aria-label={isDark ? t('Switch to light mode') : t('Switch to dark mode')}
      title={isDark ? t('Switch to light mode') : t('Switch to dark mode')}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="h-8 w-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
    >
      {isDark ? (
        /* Moon */
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        /* Sun */
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      )}
    </button>
  );
}
