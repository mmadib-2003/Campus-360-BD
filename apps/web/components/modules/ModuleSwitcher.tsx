'use client';

// apps/web/components/modules/ModuleSwitcher.tsx
// Quick module switcher (Phase 3): one search field at the top of the
// dashboard that jumps to any module in a single step.
//
// It filters the shared navigation registry (lib/modules/nav.ts) — the same
// array the sidebar, mobile drawer and ⌘K palette use — so nothing can be
// reachable in one surface and missing in another. Progressive disclosure:
// the results list only appears once the visitor types.

import React from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { NAV_MODULES } from '@/lib/modules/nav';
import { useCampusScope } from '@/lib/use-campus-scope';
import { withCampusScope } from '@/lib/campus-scope';
import { useUi } from '@/lib/i18n-client';

export function ModuleSwitcher() {
  const { t } = useUi();
  const { scope } = useCampusScope();
  const [query, setQuery] = React.useState('');

  const results = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return NAV_MODULES.filter((module) => {
      const label = t(module.key).toLowerCase();
      return label.includes(needle) || module.href.toLowerCase().includes(needle);
    }).slice(0, 8);
  }, [query, t]);

  return (
    <div className="relative">
      <div className="flex items-center gap-2.5 p-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <span aria-hidden className="text-sm pl-1.5 shrink-0">🔎</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('Jump to any module…')}
          aria-label={t('Jump to any module…')}
          className="w-full min-w-0 min-h-[40px] bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
        {!query && (
          <span className="hidden sm:inline text-[11px] text-slate-400 shrink-0 pr-1.5">
            {t('13 modules · 1 search')}
          </span>
        )}
      </div>

      <AnimatePresence>
        {query.trim() !== '' && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute z-20 mt-2 w-full p-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-lg space-y-0.5"
          >
            {results.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{t('No module found')}</p>
            ) : (
              results.map((module) => (
                <Link
                  key={module.href}
                  href={withCampusScope(module.href, scope)}
                  onClick={() => setQuery('')}
                  className="flex items-center gap-2.5 min-h-[42px] px-3 py-2 rounded-xl text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <span aria-hidden>{module.icon}</span>
                  <span className="font-medium truncate">{t(module.key)}</span>
                  <span className="ml-auto text-[11px] text-slate-400 truncate">{module.href}</span>
                </Link>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
