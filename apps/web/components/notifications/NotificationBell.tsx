// apps/web/components/notifications/NotificationBell.tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useRealtimeTable, useSession, Row } from '@/lib/modules/client';
import { isSupabaseConfigured, trySupabaseBrowser } from '@/lib/supabase-browser';
import { timeAgo } from '@/lib/utils';

/**
 * Real-time notification centre: a bell in the persistent header with unread
 * count, live toasts for newly inserted rows (Supabase Realtime) and a dropdown
 * inbox backed by the `notifications` table.
 */
export function NotificationBell() {
  const session = useSession();
  const router = useRouter();
  const [items, setItems] = React.useState<Row[]>([]);
  const [open, setOpen] = React.useState(false);
  const [toast, setToast] = React.useState<Row | null>(null);
  const [loading, setLoading] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);

  const load = React.useCallback(async () => {
    if (!session.authenticated || session.demo || !isSupabaseConfigured()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      const payload = await res.json();
      if (payload.success) setItems(payload.data ?? []);
    } catch {
      /* offline — the bell simply stays empty */
    } finally {
      setLoading(false);
    }
  }, [session.authenticated, session.demo]);

  React.useEffect(() => {
    load();
  }, [load]);

  useRealtimeTable(
    'notifications',
    {
      onInsert: (row) => {
        if (session.userId && String(row.user_id) !== String(session.userId)) return;
        setItems((prev) => {
          if (prev.some((item) => String(item.id) === String(row.id))) return prev;
          return [row, ...prev].slice(0, 50);
        });
        setToast(row);
        setTimeout(() => setToast(null), 6000);
      },
      onUpdate: (row) => {
        setItems((prev) => prev.map((item) => (String(item.id) === String(row.id) ? { ...item, ...row } : item)));
      },
    },
    { enabled: session.authenticated && !session.demo, filter: session.userId ? `user_id=eq.${session.userId}` : undefined }
  );

  React.useEffect(() => {
    function onClickAway(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  const unread = items.filter((item) => !item.is_read).length;

  async function markAllRead() {
    setItems((prev) => prev.map((item) => ({ ...item, is_read: true })));
    const supabase = trySupabaseBrowser();
    if (!supabase || !session.userId) return;
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('user_id', session.userId).eq('is_read', false);
  }

  if (!session.authenticated) return null;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => !prev);
          if (!open) load();
        }}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
        className="relative p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[85vw] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden z-50">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold">Notifications</span>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="text-[11px] text-emerald-500 font-semibold">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {loading && <p className="p-3 text-[11px] text-slate-400">Loading…</p>}
            {!loading && items.length === 0 && (
              <p className="p-3 text-[11px] text-slate-400">
                {session.demo
                  ? 'Preview mode: connect Supabase to receive live campus notifications.'
                  : 'No notifications yet. New matches, ticket updates and messages will appear here instantly.'}
              </p>
            )}
            {items.map((item) => (
              <button
                key={String(item.id)}
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (item.action_url) router.push(String(item.action_url));
                }}
                className={`w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 ${item.is_read ? '' : 'bg-emerald-500/5'}`}
              >
                <div className="text-xs font-semibold flex items-center gap-1.5">
                  {!item.is_read && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                  <span className="truncate">{item.title_en}</span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">{item.body_en}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{timeAgo(item.created_at)}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-24 md:bottom-6 right-4 z-[70] w-72 p-3 rounded-2xl bg-slate-900 text-white border border-emerald-500/40 shadow-2xl"
        >
          <div className="text-[10px] uppercase tracking-wide text-emerald-400 font-bold">Live update</div>
          <div className="text-xs font-semibold mt-0.5">{toast.title_en}</div>
          <div className="text-[11px] text-slate-300 line-clamp-2">{toast.body_en}</div>
          {toast.action_url && (
            <button
              type="button"
              onClick={() => {
                router.push(String(toast.action_url));
                setToast(null);
              }}
              className="mt-1.5 text-[11px] font-semibold text-emerald-400"
            >
              Open →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
