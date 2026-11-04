// apps/web/lib/realtime.ts
// ============================================================================
// Supabase Realtime, hardened against the one failure mode that used to take
// whole sections down:
//
//   cannot add postgres_changes callbacks for realtime:campus360:<table>:
//   after subscribe()
//
// Why it happened: supabase-js keeps one channel per *topic* and `channel()`
// returns the existing instance. Two components watching the same table (or
// React 18 StrictMode mounting, cleaning up and re-running an effect before
// `removeChannel()` has finished) therefore received the *same* channel object.
// The second caller then ran `.on('postgres_changes', ...)` on a channel that
// was already subscribed — which supabase-js rejects synchronously. The throw
// happened inside a `useEffect` commit, so React routed it to the nearest
// error boundary and the SafeSection replaced the module with a crash card.
//
// The rules this module enforces:
//   1. every subscription gets a unique topic, so `channel()` always returns a
//      fresh, unsubscribed channel;
//   2. `.on('postgres_changes', ...)` is chained BEFORE `.subscribe()` — the
//      helper has no other order available;
//   3. cleanup always calls `supabase.removeChannel(channel)`;
//   4. a realtime fault is reported through `onError` and never re-thrown into
//      React's render/commit phase.
// ============================================================================

'use client';

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export type RealtimeRow = Record<string, any>;

export type RealtimeEvent = '*' | 'INSERT' | 'UPDATE' | 'DELETE';

export interface RealtimeTableHandlers {
  onInsert?: (row: RealtimeRow) => void;
  onUpdate?: (row: RealtimeRow) => void;
  onDelete?: (row: RealtimeRow) => void;
  /** Called for subscribe-timeout / channel errors and for local failures. */
  onError?: (error: unknown) => void;
}

export interface RealtimeTableOptions {
  /** e.g. `target_id=eq.123` — passed straight to postgres_changes. */
  filter?: string;
  event?: RealtimeEvent;
  /** Stable, human-readable topic prefix. A unique suffix is always appended. */
  topicBase?: string;
}

let topicSequence = 0;

/**
 * A topic that no other live subscription can be using. The random suffix also
 * protects against a hot-reload resetting the counter while an old channel is
 * still in the client's channel map.
 */
export function createRealtimeTopic(base: string): string {
  topicSequence += 1;
  const random = Math.random().toString(36).slice(2, 8);
  return `${base}:${topicSequence.toString(36)}${random}`;
}

type Payload = { eventType?: string; new?: RealtimeRow; old?: RealtimeRow };

/**
 * Subscribe to a `public` table and get a cleanup function back.
 *
 * The returned function is idempotent and calls `supabase.removeChannel`, which
 * is the documented way to release a channel (and the only way that also
 * removes it from the client's internal channel map).
 */
export function subscribeToTable(
  supabase: SupabaseClient,
  table: string,
  handlers: RealtimeTableHandlers,
  options: RealtimeTableOptions = {}
): () => void {
  const topic = createRealtimeTopic(options.topicBase ?? `campus360:${table}`);
  let channel: RealtimeChannel | null = null;
  let disposed = false;

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    const active = channel;
    channel = null;
    if (!active) return;
    try {
      const result = supabase.removeChannel(active) as unknown;
      if (result && typeof (result as Promise<unknown>).catch === 'function') {
        (result as Promise<unknown>).catch(() => undefined);
      }
    } catch (error) {
      handlers.onError?.(error);
    }
  };

  try {
    channel = supabase.channel(topic);

    // IMPORTANT: register the postgres_changes callback BEFORE subscribe().
    // This is the exact order supabase-js requires; reversing it is what
    // produced the crash this helper exists to prevent.
    channel = channel.on(
      'postgres_changes',
      {
        event: options.event ?? '*',
        schema: 'public',
        table,
        ...(options.filter ? { filter: options.filter } : {}),
      },
      (payload: Payload) => {
        const eventType = payload?.eventType;
        if (eventType === 'INSERT') handlers.onInsert?.(payload.new ?? {});
        else if (eventType === 'UPDATE') handlers.onUpdate?.(payload.new ?? {});
        else if (eventType === 'DELETE') handlers.onDelete?.(payload.old ?? {});
      }
    );

    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        handlers.onError?.(new Error(`Realtime channel "${topic}" reported ${status}`));
      }
    });
  } catch (error) {
    // Never let a realtime fault escape into React's commit phase.
    handlers.onError?.(error);
    cleanup();
  }

  return cleanup;
}
