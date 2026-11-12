// apps/web/components/modules/ui.tsx
'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { asNum } from '@/lib/render-safe';
import { SafeSection } from '@/components/SafeSection';
import { useUi } from '@/lib/i18n-client';

export function Card({
  children,
  className,
  as: Tag = 'div',
  label,
}: {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
  /** Names this section in the crash card and the console. Worth passing. */
  label?: string;
}) {
  // Every module page composes its sections out of this one component, so the
  // boundary lives here: a card whose rows throw used to unmount the page (and
  // with the root layout rendering AppShell, the header and nav too). Now only
  // this card is replaced -- see components/SafeSection.tsx for the trade-off.
  return (
    <Tag
      className={cn(
        'rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm',
        className
      )}
    >
      <SafeSection label={label ?? 'This section'}>{children}</SafeSection>
    </Tag>
  );
}

export function SectionHeader({
  icon,
  title,
  subtitle,
  actions,
  right,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-bold flex items-center gap-2">
          {icon && <span aria-hidden>{icon}</span>}
          <span className="truncate">{title}</span>
        </h2>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
        {actions}
        {right}
      </div>
    </div>
  );
}

export function ModuleHeader({
  icon,
  title,
  titleBn,
  blurb,
  live,
  demo,
  children,
}: {
  icon: string;
  title: string;
  titleBn?: string;
  blurb?: string;
  live?: boolean;
  demo?: boolean;
  children?: React.ReactNode;
}) {
  const { locale, t } = useUi();
  const heading = locale === 'bn' && titleBn ? t(titleBn) : t(title);
  const body = blurb ? (locale === 'bn' ? t(blurb) : blurb) : undefined;
  return (
    <Card className="p-4 sm:p-5 md:p-6 bg-gradient-to-br from-emerald-900/50 via-slate-900 to-teal-950 border-emerald-500/30 !text-slate-100">
      {/* Title stacks above badges / scope toggle on mobile. */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xl" aria-hidden>
              {icon}
            </span>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-white">{heading}</h1>
            {live && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold">
                <LiveDot /> {t('LIVE')}
              </span>
            )}
            {demo && (
              <span
                title={t('Preview mode — data is scoped to the selected campus.')}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-semibold"
              >
                ● {t('Preview data')}
              </span>
            )}
          </div>
          {body && <p className="text-sm text-slate-300 mt-2 max-w-3xl">{body}</p>}
        </div>
        {children && <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:shrink-0">{children}</div>}
      </div>
    </Card>
  );
}

export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn('relative flex h-2 w-2', className)}>
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
    </span>
  );
}

const BADGE_TONES: Record<string, string> = {
  emerald: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
  teal: 'bg-teal-500/15 text-teal-600 dark:text-teal-300 border-teal-500/30',
  amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
  rose: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30',
  sky: 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30',
  violet: 'bg-violet-500/15 text-violet-600 dark:text-violet-300 border-violet-500/30',
  slate: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30',
  indigo: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/30',
};

export function Badge({
  children,
  tone = 'slate',
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof BADGE_TONES | string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border',
        BADGE_TONES[tone] ?? BADGE_TONES.slate,
        className
      )}
    >
      {children}
    </span>
  );
}

export function statusTone(status?: string | null): string {
  switch ((status ?? '').toUpperCase()) {
    case 'AVAILABLE':
    case 'OPEN':
    case 'GOING':
    case 'CONFIRMED':
    case 'APPROVED':
    case 'COMPLETED':
    case 'RESOLVED':
    case 'CLEAN':
    case 'ACTIVE':
      return 'emerald';
    case 'RESERVED':
    case 'PENDING':
    case 'REQUESTED':
    case 'INTERESTED':
    case 'IN_REVIEW':
    case 'PREPARING':
    case 'SHORTLISTED':
      return 'amber';
    case 'SOLD':
    case 'FULL':
    case 'CLOSED':
    case 'CANCELLED':
    case 'REJECTED':
    case 'WITHDRAWN':
      return 'slate';
    case 'CRITICAL':
    case 'ESCALATED':
    case 'REJECTED_WITH_REASON':
      return 'rose';
    case 'READY':
    case 'PLACED':
      return 'sky';
    default:
      return 'teal';
  }
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  loading,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md';
  loading?: boolean;
}) {
  const variants: Record<string, string> = {
    primary:
      'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-400 hover:to-teal-500 shadow-sm',
    secondary: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700',
    ghost: 'bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800',
    danger: 'bg-rose-600 text-white hover:bg-rose-500',
    outline:
      'bg-transparent border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800',
  };
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px] sm:min-h-0',
        size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
        variants[variant],
        className
      )}
    >
      {loading && (
        <span className="h-3 w-3 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden />
      )}
      {children}
    </button>
  );
}

// text-base (16px) on mobile prevents iOS Safari / Android Chrome auto-zoom
// on focus; sm:text-sm restores the compact desktop size.
const inputClass =
  'w-full max-w-full rounded-xl px-3 py-2 text-base sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputClass, 'min-h-[44px]', props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputClass, 'min-h-[90px]', props.className)} />;
}

export function Select({
  options,
  placeholder,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  return (
    <select {...props} className={cn(inputClass, 'min-h-[44px]', props.className)}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block space-y-1', className)}>
      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</span>
      {children}
      {hint && !error && <span className="block text-[11px] text-slate-400">{hint}</span>}
      {error && <span className="block text-[11px] text-rose-500">{error}</span>}
    </label>
  );
}

export function EmptyState({
  icon = '📭',
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="p-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2">
      <div className="text-3xl" aria-hidden>
        {icon}
      </div>
      <div className="font-semibold text-sm">{title}</div>
      {description && <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">{description}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800',
        className
      )}
      aria-hidden
    >
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl skeleton-shimmer shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-1/3 rounded skeleton-shimmer" />
          <div className="h-2.5 w-2/3 rounded skeleton-shimmer" />
        </div>
      </div>
      <div className="mt-3 h-2.5 w-full rounded skeleton-shimmer" />
      <div className="mt-2 h-2.5 w-5/6 rounded skeleton-shimmer" />
    </div>
  );
}

export function SkeletonList({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div
      className={cn('space-y-3', className)}
      aria-busy="true"
      aria-live="polite"
      data-testid="skeleton-list"
    >
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}

/** Card-grid skeleton for the home feed / module hub / directory. */
export function SkeletonGrid({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div
      className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3', className)}
      aria-busy="true"
      aria-live="polite"
      data-testid="skeleton-grid"
    >
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
          aria-hidden
        >
          <div className="h-24 skeleton-shimmer" />
          <div className="p-4 space-y-2">
            <div className="h-3 w-2/3 rounded skeleton-shimmer" />
            <div className="h-2.5 w-1/2 rounded skeleton-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Stat-tile skeleton for dashboard headers. */
export function SkeletonStat({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900',
        className
      )}
      aria-hidden
    >
      <div className="h-2.5 w-1/2 rounded skeleton-shimmer" />
      <div className="mt-2 h-5 w-1/3 rounded skeleton-shimmer" />
      <div className="mt-2 h-2 w-2/3 rounded skeleton-shimmer" />
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = 'emerald',
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: keyof typeof BADGE_TONES;
}) {
  return (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-xl font-extrabold mt-1 flex items-baseline gap-2">
        {value}
        <span className={cn('h-1.5 w-1.5 rounded-full', tone === 'rose' ? 'bg-rose-500' : 'bg-emerald-500')} />
      </div>
      {hint && <div className="text-[11px] text-slate-400 mt-0.5">{hint}</div>}
    </Card>
  );
}

export function FilterChips({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  options: Array<{ value: string; label: string }>;
  label?: string;
}) {
  const { t } = useUi();
  return (
    // Touch-scrollable pill row on mobile (edge-to-edge inside the card),
    // wrapping back to a normal row from sm upward.
    <div className="flex overflow-x-auto no-scrollbar gap-2 pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap sm:items-center">
      {label && <span className="text-[11px] uppercase tracking-wide text-slate-400 mr-1 shrink-0">{label}</span>}
      {[{ value: 'ALL', label: t('All') }, ...options].map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'shrink-0 whitespace-nowrap min-h-[44px] sm:min-h-0 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition',
            value === option.value
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/40'
              : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-3 sm:p-4 pt-14 sm:pt-16 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'w-full max-w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl',
          wide ? 'max-w-3xl' : 'max-w-xl'
        )}
      >
        <div className="flex items-center justify-between gap-2 p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-bold text-sm min-w-0 truncate">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="p-3 sm:p-4 max-h-[70vh] overflow-y-auto overscroll-contain">{children}</div>
        {footer && <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800">{footer}</div>}
      </div>
    </div>
  );
}

export function Toast({ message, tone = 'emerald' }: { message: string; tone?: 'emerald' | 'rose' | 'amber' }) {
  const tones = {
    emerald: 'bg-emerald-600 text-white',
    rose: 'bg-rose-600 text-white',
    amber: 'bg-amber-500 text-slate-900',
  };
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-[70] max-w-[90vw] px-4 py-2 rounded-xl text-xs font-semibold shadow-lg',
        tones[tone]
      )}
    >
      {message}
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = React.useState<{ message: string; tone: 'emerald' | 'rose' | 'amber' } | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = React.useCallback((message: string, tone: 'emerald' | 'rose' | 'amber' = 'emerald') => {
    setToast({ message, tone });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const node = toast ? <Toast message={toast.message} tone={toast.tone} /> : null;
  return { show, node };
}

export function Progress({ value, max, tone = 'emerald' }: { value: number; max: number; tone?: 'emerald' | 'amber' }) {
  // A JSONB counter can be NULL and a ratio divisor can be 0 -- both used to
  // render `NaN%` (and, before this file, sometimes throw).
  const v = asNum(value);
  const m = Math.max(asNum(max, 1), 1);
  const pct = Math.min(100, Math.round((v / m) * 100));
  return (
    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={cn('h-full rounded-full transition-all', tone === 'amber' ? 'bg-amber-500' : 'bg-gradient-to-r from-emerald-500 to-teal-500')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function SignInPrompt({ moduleName }: { moduleName: string }) {
  return (
    <Card className="p-5 space-y-3">
      <h3 className="font-bold text-sm">
        Browsing {moduleName} is open. Sign in to post, book and contact.
      </h3>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Anyone can read the listings. Posting, booking, messaging and the contact details students share with each
        other need a verified campus account — sign in with your verified email for those.
      </p>
      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        তালিকা দেখা সবার জন্য উন্মুক্ত। পোস্ট করতে, বুক করতে ও যোগাযোগের বিবরণ দেখতে যাচাইকৃত ইমেইলে সাইন-ইন করুন।
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <a
          href="/signin"
          className="min-h-[44px] inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 text-white"
        >
          Sign in
        </a>
        <a href="/signup" className="min-h-[44px] inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold border border-slate-300 dark:border-slate-700">
          Join your campus
        </a>
      </div>
    </Card>
  );
}
