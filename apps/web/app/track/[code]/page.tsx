'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useUi } from '@/lib/i18n-client';
import { demoTable, subscribeDemoRealtime } from '@/lib/modules/demo-data';
import { trySupabaseBrowser } from '@/lib/supabase-browser';

type Row = Record<string, any>;

const STAGES = ['SUBMITTED', 'IN_REVIEW', 'ACTION_TAKEN', 'RESOLVED'] as const;

function stageIndex(status: string): number {
  const normalized = String(status ?? '').toUpperCase();
  if (['RESOLVED', 'CLOSED'].includes(normalized)) return 3;
  if (normalized === 'ACTION_TAKEN') return 2;
  if (normalized === 'IN_REVIEW' || normalized === 'ACKNOWLEDGED') return 1;
  return 0;
}

function findDemoTicket(code: string): Row | undefined {
  const needle = code.trim().toUpperCase();
  // Complaints resolve by tracking_code; civic tickets also resolve by ticket ID.
  return demoTable('complaints_public').find(
    (ticket) =>
      String(ticket.tracking_code ?? '').toUpperCase() === needle ||
      String(ticket.id ?? '').toUpperCase() === needle
  );
}

export default function TrackCasePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const { t } = useUi();
  const code = decodeURIComponent(String(params?.code ?? ''));
  const [ticket, setTicket] = React.useState<Row | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const [secret, setSecret] = React.useState('');
  const [unlocked, setUnlocked] = React.useState(false);
  const [secretError, setSecretError] = React.useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = React.useState<number>(Date.now());

  const isFormal = ticket ? ticket.is_public_issue === false || Boolean(ticket.tracking_secret) : false;

  const load = React.useCallback(
    async (candidateSecret?: string, silent = false) => {
      if (!code) {
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      setNotFound(false);
      try {
        const local = findDemoTicket(code);
        if (local) {
          if (local.is_public_issue === false && local.tracking_secret) {
            const stored =
              candidateSecret ??
              (typeof window !== 'undefined' ? window.localStorage.getItem(`campus360_secret_${code.toUpperCase()}`) : null) ??
              '';
            if (!stored) {
              setTicket(local);
              setUnlocked(false);
              setLoading(false);
              return;
            }
            if (stored !== local.tracking_secret) {
              setTicket(local);
              setUnlocked(false);
              setSecretError(t('Incorrect device secret'));
              setLoading(false);
              return;
            }
          }
          setTicket(local);
          setUnlocked(true);
          setLastUpdate(Date.now());
          setLoading(false);
          return;
        }

        const response = await fetch('/api/complaints/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trackingCode: code, trackingSecret: candidateSecret ?? '' }),
        });
        const payload = await response.json();
        if (payload?.success && payload.data?.complaint) {
          setTicket(payload.data.complaint);
          setUnlocked(true);
          setLastUpdate(Date.now());
        } else {
          setNotFound(true);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    },
    [code, t]
  );

  React.useEffect(() => {
    void load();
  }, [load]);

  // Live updates: Supabase Realtime when configured, BroadcastChannel in preview.
  React.useEffect(() => {
    if (!code) return;
    const supabase = trySupabaseBrowser();
    let channel: any = null;
    if (supabase) {
      channel = supabase
        .channel(`campus360:complaints:track:${code}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'complaints', filter: `tracking_code=eq.${code}` },
          () => {
            void load(secret || undefined, true);
          }
        )
        .subscribe();
    }
    const unsubscribe = subscribeDemoRealtime((event) => {
      if (event.type === 'store' || (event.table === 'complaints_public' && event.row && String(event.row.tracking_code ?? '').toUpperCase() === code.toUpperCase())) {
        void load(secret || undefined, true);
      }
    });
    const interval = window.setInterval(() => {
      void load(secret || undefined, true);
    }, 4000);
    return () => {
      if (supabase && channel) supabase.removeChannel(channel);
      unsubscribe();
      window.clearInterval(interval);
    };
  }, [code, load, secret]);

  function unlock(event: React.FormEvent) {
    event.preventDefault();
    setSecretError(null);
    const normalized = code.toUpperCase();
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`campus360_secret_${normalized}`, secret.trim());
    }
    void load(secret.trim());
  }

  if (!code) {
    return (
      <div className="max-w-xl mx-auto my-12 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
        <h1 className="text-lg font-bold">{t('Track a case')}</h1>
        <p className="text-xs text-slate-500">{t('Paste your ticket ID to see the live status timeline.')}</p>
        <Link href="/complaints/track" className="inline-block px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold">
          {t('Track')}
        </Link>
      </div>
    );
  }

  if (loading) {
    return <div className="max-w-2xl mx-auto my-12 text-sm text-slate-500">{t('Loading…')}</div>;
  }

  if (notFound || !ticket) {
    return (
      <div className="max-w-xl mx-auto my-12 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
        <h1 className="text-lg font-bold text-rose-500">{t('Ticket not found')}</h1>
        <p className="text-xs text-slate-500">{t('Check the code and try again. Civic tickets look like')} JU-CASE-2026-482913.</p>
        <div className="flex gap-2">
          <Link href="/civic" className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold">
            {t('Back to civic board')}
          </Link>
          <Link href="/complaints/track" className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm">
            {t('Track a case')}
          </Link>
        </div>
      </div>
    );
  }

  if (isFormal && !unlocked) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
        <h1 className="text-lg font-bold">{t('Device secret required')}</h1>
        <p className="text-xs text-slate-500">{t('Enter the device secret issued when this grievance was filed.')}</p>
        <form onSubmit={unlock} className="space-y-3">
          <input
            type="password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            placeholder="••••••••"
            className="w-full rounded-xl p-2.5 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
          />
          {secretError && <p className="text-xs text-rose-500">{secretError}</p>}
          <button type="submit" className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold">
            {t('Unlock case')}
          </button>
        </form>
        <p className="text-[11px] text-slate-400">
          {t('Enter the device secret issued when this grievance was filed.')}
        </p>
        {String(ticket.tracking_code ?? '') === 'DU-CASE-2026-482913' && (
          <p className="text-[11px] text-amber-600 dark:text-amber-300">
            {t('Demo mode')}: DU-SECRET-482913
          </p>
        )}
      </div>
    );
  }

  const history: Array<{ status: string; at: string; note?: string; by?: string }> = Array.isArray(ticket.history)
    ? ticket.history
    : [{ status: ticket.status ?? 'SUBMITTED', at: ticket.created_at ?? new Date().toISOString(), note: '', by: '' }];
  const currentStage = stageIndex(String(ticket.status));
  const timeline = STAGES.map((stage, index) => {
    const entry = [...history].reverse().find((item) => String(item.status).toUpperCase() === stage);
    return {
      stage,
      index,
      entry,
      done: index <= currentStage,
      current: index === currentStage,
    };
  });

  return (
    <div className="max-w-2xl mx-auto my-8 space-y-4">
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold">{t('Track a case')}</h1>
            <p className="text-xs text-slate-500 font-mono">{String(ticket.tracking_code ?? code)}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 text-[11px] font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> {t('Live updates are on')}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 font-semibold">
            {String(ticket.status ?? 'SUBMITTED').replace(/_/g, ' ')}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">{String(ticket.category ?? '').replace(/_/g, ' ')}</span>
          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300">{String(ticket.severity ?? 'MEDIUM')}</span>
          <span className="text-slate-500">▲ {Number(ticket.upvotes_count ?? 0)} {t('Upvotes')}</span>
        </div>

        <h2 className="text-sm font-bold">{String(ticket.title ?? '')}</h2>
        {ticket.location_hint && <p className="text-[11px] text-slate-500">📍 {String(ticket.location_hint)}</p>}
        {ticket.description && <p className="text-xs text-slate-600 dark:text-slate-300">{String(ticket.description)}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-500">
          <div>
            <span className="block text-slate-400">{t('SLA deadline')}</span>
            <span className="font-medium">
              {ticket.sla_due_at ? new Date(String(ticket.sla_due_at)).toLocaleString() : '—'}
            </span>
          </div>
          <div>
            <span className="block text-slate-400">{t('Last activity')}</span>
            <span className="font-medium">
              {ticket.last_activity_at ? new Date(String(ticket.last_activity_at)).toLocaleString() : '—'}
            </span>
          </div>
        </div>
        {ticket.sla_breached && (
          <p className="text-[11px] text-rose-500 font-semibold">⚠ {t('SLA breached')}</p>
        )}
        {isFormal && <p className="text-[11px] text-emerald-600 dark:text-emerald-400">✓ {t('Secret accepted')}</p>}
      </div>

      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <h2 className="text-sm font-bold mb-4">{t('Status timeline')}</h2>
        <ol className="space-y-0">
          {timeline.map((item, index) => (
            <li key={item.stage} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    item.done
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                  }`}
                >
                  {item.done ? '✓' : index + 1}
                </span>
                {index < timeline.length - 1 && (
                  <span className={`w-0.5 flex-1 min-h-[28px] ${item.done ? 'bg-emerald-500/50' : 'bg-slate-200 dark:bg-slate-800'}`} />
                )}
              </div>
              <div className="pb-5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-xs font-semibold ${item.current ? 'text-emerald-600 dark:text-emerald-400' : item.done ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>
                    {t(
                      item.stage === 'SUBMITTED'
                        ? 'Submitted'
                        : item.stage === 'IN_REVIEW'
                          ? 'In Review'
                          : item.stage === 'ACTION_TAKEN'
                            ? 'Action Taken'
                            : 'Resolved'
                    )}
                  </span>
                  {item.entry?.at && (
                    <span className="text-[10px] text-slate-400">
                      {new Date(String(item.entry.at)).toLocaleString()}
                    </span>
                  )}
                </div>
                {item.entry?.note && <p className="text-[11px] text-slate-500 mt-0.5">{String(item.entry.note)}</p>}
                {item.entry?.by && <p className="text-[10px] text-slate-400">— {String(item.entry.by)}</p>}
              </div>
            </li>
          ))}
        </ol>
        <p className="text-[10px] text-slate-400">{t('Waiting for the next update…')}</p>
      </div>

      {history.length > 1 && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-bold mb-2">{t('Escalation history')}</h2>
          <ul className="space-y-1 text-[11px] text-slate-500">
            {history.map((entry, index) => (
              <li key={`${entry.status}-${index}`} className="flex flex-wrap gap-2">
                <span className="font-mono text-slate-400">{new Date(String(entry.at)).toLocaleString()}</span>
                <span className="font-semibold text-slate-600 dark:text-slate-300">{String(entry.status).replace(/_/g, ' ')}</span>
                <span>{String(entry.note ?? '')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href="/civic" className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold">
          {t('Back to civic board')}
        </Link>
        <Link href="/complaints" className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm">
          {t('Formal grievance (SLA tracked)')}
        </Link>
      </div>
    </div>
  );
}
