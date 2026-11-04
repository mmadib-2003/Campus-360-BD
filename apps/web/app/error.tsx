// apps/web/app/error.tsx
// ============================================================================
// The route-segment boundary. Before this file existed, a throw anywhere under
// the root layout produced Next's bare
//   "Application error: a client-side exception has occurred"
// overlay with no link back to the app -- the report this change answers. A
// segment error page keeps the shell, offers a retry, and gives the reader the
// digest that *does* appear in the server log, so a field report is actionable.
//
// Rendered from literals only: an error page that depends on the data layer,
// i18n provider or a hook can itself throw, and then there is nothing left.
// ============================================================================

'use client';

import React from 'react';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[Campus360] route render failed:', error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto my-16 px-6 py-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-4">
      <div className="text-3xl" aria-hidden>
        ⚠️
      </div>
      <h1 className="text-lg font-bold">This section could not be displayed</h1>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        এই অংশটি লোড করা যায়নি — বাকি সাইট ঠিক আছে। নিচের বোতামে আবার চেষ্টা করুন।
      </p>
      <p className="text-xs text-slate-500 max-w-md mx-auto break-words">
        Nothing you submitted was lost. If it keeps happening, send us this code:
        <span className="block mt-1 font-mono text-[11px] text-slate-400">
          {error?.digest || error?.message || 'unknown'}
        </span>
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
        <button
          type="button"
          onClick={reset}
          className="px-5 py-2 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-500"
        >
          Try again
        </button>
        <a
          href="/"
          className="px-5 py-2 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
        >
          Back to the campus home
        </a>
      </div>
    </div>
  );
}
