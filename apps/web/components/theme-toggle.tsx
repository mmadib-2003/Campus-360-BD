'use client';

// apps/web/components/theme-toggle.tsx
// Sun/Moon toggle for the campus header. There is no shadcn Button in this
// codebase (components/ui was never adopted), so it renders a native
// <button> styled exactly like the navbar's locale toggle next to it —
// h-11 (44px) touch target, same border/surface tokens, emerald focus ring.

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Hydration fix: the server cannot know the stored theme, so the icon is
  // always wrong on one side. Render an inert placeholder until mounted.
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 opacity-0"
      />
    );
  }

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-pressed={isDark}
      className="relative inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
    >
      <Sun
        className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0"
        aria-hidden="true"
      />
      <Moon
        className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100"
        aria-hidden="true"
      />
      <span className="sr-only">{isDark ? 'Switch to light theme' : 'Switch to dark theme'}</span>
    </button>
  );
}
