// apps/web/components/SafeSection.tsx
// ============================================================================
// Why this file exists: until now the tree had no error boundary at all, so a
// single unread row -- `null.map`, `undefined.full_name`, a JSONB field that came
// back as a string -- unmounted everything above it. With `AppShell` rendered by
// the root layout, "one card is broken" was indistinguishable from "the site is
// down", which is exactly the report this answers.
//
// Two rules for a boundary, both honoured below:
//   1. the fallback renders from literals only -- no hooks, no imports from the
//      data layer, no `t()`. A fallback that can throw is worse than no fallback.
//   2. the failure is *named*. The generic
//      "Application error: a client-side exception has occurred" gives a reader
//      nothing to act on, so the label goes to the console with the real error
//      and into the card, and the event is re-broadcast for anything that wants
//      to aggregate it (the admin console's diagnostics strip).
// ============================================================================

'use client';

import React from 'react';

type Props = {
  /** What a reader should call this section, e.g. "Housing listings". */
  label: string;
  children: React.ReactNode;
  /** Rendered instead of the crash card when the boundary trips. */
  fallback?: React.ReactNode;
};

type State = { error: Error | null };

export class SafeSection extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    const detail = { label: this.props.label, message: error?.message ?? 'Render error', digest: (error as any)?.digest };
    // eslint-disable-next-line no-console
    console.error(`[Campus360] section "${this.props.label}" failed to render`, error, info?.componentStack ?? '');
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('campus360:render-error', { detail }));
      } catch {
        /* an environment without CustomEvent must not fail while reporting a failure */
      }
    }
  }

  private readonly retry = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return <SectionCrash label={this.props.label} message={error.message || 'Unknown error'} onRetry={this.retry} />;
  }
}

function SectionCrash({ label, message, onRetry }: { label: string; message: string; onRetry: () => void }) {
  return (
    <div className="p-6 rounded-2xl border border-dashed border-amber-400/60 bg-amber-50/60 dark:bg-amber-950/20 text-center space-y-2">
      <div className="text-2xl" aria-hidden>
        ⚠️
      </div>
      <div className="font-semibold text-sm text-slate-800 dark:text-slate-100">{label} could not be displayed</div>
      <div className="text-xs text-amber-800 dark:text-amber-300">
        {label} দেখানো যায়নি — বাকি পেজ ঠিক আছে।
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-md mx-auto break-words">
        The rest of the page is unaffected. The error is in your browser console, prefixed
        <code className="mx-1 px-1 rounded bg-slate-200/70 dark:bg-slate-800 text-[10px]">[Campus360]</code>.
        <span className="block mt-1 font-mono text-[10px] text-slate-400">{message}</span>
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-1 px-4 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900"
      >
        Try again / আবার চেষ্টা করুন
      </button>
    </div>
  );
}

/**
 * List-view sugar: the three states a module section can be in -- nothing yet,
 * nothing at all, or rows -- each rendered through the boundary. `loading` and
 * `error` come from useModuleList; passing them keeps pages from writing their own
 * `length === 0` branch differently every time.
 */
export function SafeList({
  label,
  items,
  loading,
  error,
  empty,
  skeleton,
  children,
}: {
  label: string;
  items: unknown;
  loading?: boolean;
  error?: string | null;
  empty?: React.ReactNode;
  skeleton?: React.ReactNode;
  children: (rows: any[]) => React.ReactNode;
}) {
  const rows = Array.isArray(items) ? (items as any[]) : [];
  if (loading && !rows.length) return <>{skeleton ?? null}</>;
  if (!rows.length) {
    return (
      <>
        {error ? (
          <div className="p-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-1">
            <div className="font-semibold text-sm">{label} is unavailable right now</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">{String(error)}</p>
          </div>
        ) : (
          (empty ?? null)
        )}
      </>
    );
  }
  return (
    <SafeSection label={label}>
      <>{children(rows)}</>
    </SafeSection>
  );
}
