// apps/web/lib/modules/client.ts
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getModule } from './registry';
import { demoTickets } from '@/lib/demo-tickets';
import { SHARED_MODULES, isSharedDemoRowVisible, LOCAL_ACTION_PARENTS } from '@/lib/campus-scope';
import { useCampusScope } from '@/lib/use-campus-scope';
import {
  demoDelete,
  demoInsert,
  demoList,
  demoTable,
  demoUpdate,
  getActiveDemoUniversity,
  getDemoProfile,
  subscribeDemoRealtime,
} from './demo-data';
import { trySupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase-browser';
import { subscribeToTable } from '@/lib/realtime';

export type Row = Record<string, any>;

export interface ListOptions {
  filters?: Record<string, string | undefined>;
  search?: string;
  limit?: number;
  mine?: boolean;
  /** Keep supporting pickers campus-local even when the main listing is global. */
  campusLocal?: boolean;
  enabled?: boolean;
}

export { useSession } from './session';
export type { SessionState } from './session';
import { useSession } from './session';

/**
 * Every list assignment in this file goes through here.
 *
 * A collection state that is `null`, `{}` or a string instead of an array is
 * enough to take a whole page down — the first `.map()` after it throws
 * `is not a function`, and React renders the global error instead of the module.
 * That is reachable from outside our control: a degraded API envelope, a
 * fallback branch that answers `{ success: true }` without rows, or a demo store
 * entry that has not been seeded. So anything that is not an array becomes `[]`,
 * which the pages already know how to render as an empty state.
 */
function toList<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

interface FetchState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  demo: boolean;
  total: number;
  refresh: () => void;
  setData: (updater: (prev: T) => T) => void;
}

/**
 * Reads a module collection. Live Supabase data is preferred; if the deployment
 * has no Supabase environment yet, the local demo store is used so the UI stays
 * fully interactive.
 */
export function useModuleList<T extends Row = Row>(moduleKey: string, options: ListOptions = {}): FetchState<T[]> {
  const spec = useMemo(() => getModule(moduleKey), [moduleKey]);
  const session = useSession();
  const { scope } = useCampusScope();
  const allCampuses = session.authenticated && scope === 'all' && SHARED_MODULES.has(moduleKey) && !options.mine && !options.campusLocal;
  const [data, setDataState] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(!isSupabaseConfigured());
  const [total, setTotal] = useState(0);
  const [tick, setTick] = useState(0);

  const filtersKey = JSON.stringify(options.filters ?? {});
  // `enabled: false` is a hard stop, so that a collapsed tab can still say "do not
  // fetch". The old auth gate lived in this option -- pages passed
  // `enabled: session.authenticated`, which is how a signed-out visitor ended up with
  // no request at all -- and the publicRead modules have had that gate removed at the
  // call sites. The clause below is what keeps it removed: the session is no longer a
  // reason to skip a list the database is willing to answer. __tests__/anon-listing-reads
  // .test.ts fails if a publicRead page puts the gate back.
  const enabled =
    options.enabled !== false &&
    (session.authenticated || session.demo || spec?.publicRead === true);

  useEffect(() => {
    if (!spec) { setLoading(false); return; }
    if (session.loading) return;
    if (!enabled) {
      // `enabled: false` means "this list belongs to a session", not "still loading".
      // Without this the guest view of a mixed page (careers, dining, sports) would
      // sit on a skeleton in every member-only section forever.
      setDataState([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    const activeSpec = spec;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setDataState([]);
      setTotal(0);
      setError(null);

      if (session.demo || !isSupabaseConfigured()) {
        const rows = toList<T>(
          demoList(activeSpec.table, {
            allCampuses,
            rowFilter: allCampuses ? (row) => isSharedDemoRowVisible(moduleKey, row) : undefined,
            filters: options.filters as Record<string, string>,
            search: options.search,
            searchColumns: activeSpec.searchColumns,
            orderBy: activeSpec.orderBy,
            limit: options.limit,
          }).filter((row) => !options.mine || String(row[activeSpec.ownerColumn ?? ''] ?? '') === getDemoProfile().id)
        );
        if (!cancelled) {
          setDataState(rows);
          setTotal(rows.length);
          setDemo(true);
          setLoading(false);
        }
        return;
      }

      try {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(options.filters ?? {})) {
          if (value) params.set(key, value);
        }
        if (options.search) params.set('q', options.search);
        if (options.limit) params.set('limit', String(options.limit));
        if (options.mine) params.set('mine', 'true');
        if (allCampuses) params.set('scope', 'all_campuses');

        const res = await fetch(`/api/modules/${moduleKey}?${params.toString()}`, { cache: 'no-store', signal: AbortSignal.timeout(3000) });
        const payload = await res.json();
        if (cancelled) return;

        if (!payload.success) {
          setError(payload?.error?.message_en ?? 'Could not load data.');
          setDataState([]);
        } else {
          const rows = toList<T>(payload.data);
          setDataState(rows);
          setTotal(Number(payload.meta?.total ?? rows.length));
          setDemo(false);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Network error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleKey, filtersKey, options.search, options.limit, options.mine, enabled, tick, session.loading, session.demo, session.userId, session.profile?.university_id, allCampuses]);

  // Preview mode: any write in another tab refreshes this list within ~1s.
  useEffect(() => {
    if (isSupabaseConfigured()) return;
    return subscribeDemoRealtime((event) => {
      if (event.type === 'store') setTick((value) => value + 1);
    });
  }, []);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((updater: (prev: T[]) => T[]) => setDataState((prev) => updater(prev)), []);

  return { data, loading, error, demo, total, refresh, setData };
}

export function useRealtimeTable(
  table: string | null,
  handlers: { onInsert?: (row: Row) => void; onUpdate?: (row: Row) => void; onDelete?: (row: Row) => void },
  options: { filter?: string; enabled?: boolean } = {}
) {
  const handlerRef = useRef(handlers);
  handlerRef.current = handlers;
  const filterKey = options.filter ?? '';
  const enabled = options.enabled !== false;

  useEffect(() => {
    if (!table || !enabled) return;
    const supabase = trySupabaseBrowser();
    if (!supabase) {
      // Preview mode: BroadcastChannel + storage events stand in for Supabase Realtime.
      return subscribeDemoRealtime((event) => {
        if (event.table !== table && event.type !== 'store') return;
        if (event.type === 'insert' && event.row) handlerRef.current.onInsert?.(event.row);
        if (event.type === 'update' && event.row) handlerRef.current.onUpdate?.(event.row);
        if (event.type === 'delete' && event.id) handlerRef.current.onDelete?.({ id: event.id });
      });
    }

    // `subscribeToTable` guarantees `.on('postgres_changes', ...)` runs before
    // `.subscribe()`, gives every effect run its own topic (so a StrictMode
    // remount or two components on one table can never collide), and releases
    // the channel with `removeChannel` on cleanup. See lib/realtime.ts.
    return subscribeToTable(
      supabase,
      table,
      {
        onInsert: (row) => handlerRef.current.onInsert?.(row),
        onUpdate: (row) => handlerRef.current.onUpdate?.(row),
        onDelete: (row) => handlerRef.current.onDelete?.(row),
        onError: (error) => {
          // A realtime outage must degrade to polling, never to a crash card.
          console.warn('[campus360:realtime] subscription failed', error);
        },
      },
      { filter: filterKey || undefined, topicBase: `campus360:${table}${filterKey ? `:${filterKey}` : ''}` }
    );
  }, [table, filterKey, enabled]);
}

export interface MutateResult {
  ok: boolean;
  data?: Row;
  error?: string;
  errorBn?: string;
  demo?: boolean;
}

function demoParentIsLocal(moduleKey: string, values: Row) {
  const parent = LOCAL_ACTION_PARENTS[moduleKey];
  if (!parent || !(parent[0] in values)) return true;
  // The preview store calls the public civic projection complaints_public.
  const table = parent[1] === 'complaints' ? 'complaints_public' : parent[1];
  return demoTable(table).some((row) => row.id === values[parent[0]] && row.university_id === getActiveDemoUniversity().id);
}
function demoRowIsLocal(table: string, id: string) {
  return demoTable(table).some((row) => row.id === id && row.university_id === getActiveDemoUniversity().id);
}

/** Create/update a module row through the tenant-isolated API (demo fallback aware). */
export function useModuleMutation(moduleKey: string) {
  const session = useSession();
  const [pending, setPending] = useState(false);

  const create = useCallback(
    async (values: Row): Promise<MutateResult> => {
      const spec = getModule(moduleKey);
      if (!spec) return { ok: false, error: 'Unknown module' };
      setPending(true);
      try {
        if (session.demo || !isSupabaseConfigured()) {
          if (!demoParentIsLocal(moduleKey, values)) return { ok: false, error: 'Actions are limited to items from your campus.' };
          const systemDefaults: Record<string, Row> = {
            'marketplace-orders': {
              buyer_id: getDemoProfile().id,
              order_code: `ORD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
            },
            'food-orders': {
              buyer_id: getDemoProfile().id,
              order_code: `FOOD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
            },
            conversations: {
              user_a: getDemoProfile().id,
              last_message_at: new Date().toISOString(),
              ...(values.user_b === getDemoProfile().id ? { user_b: 'demo-user-0003' } : {}),
            },
            disputes: {
              opened_by: getDemoProfile().id,
              reference_code: `DSP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
            },
            donations: {
              donor_id: getDemoProfile().id,
              status: 'CONFIRMED',
              donor_name: values.is_anonymous ? 'Anonymous' : values.donor_name || getDemoProfile().full_name,
            },
            'career-applications': { applicant_id: getDemoProfile().id },
            'mentorship-bookings': { mentee_id: getDemoProfile().id },
            'skill-applications': { applicant_id: getDemoProfile().id },
          };
          const created = demoInsert(spec.table, {
            ...(systemDefaults[moduleKey] ?? {}),
            ...(spec.ownerColumn ? { [spec.ownerColumn]: getDemoProfile().id } : {}),
            profiles: { full_name: getDemoProfile().full_name, trust_level: getDemoProfile().trust_level },
            ...values,
            university_id: getActiveDemoUniversity().id,
          });
          return { ok: true, data: created, demo: true };
        }

        const res = await fetch(`/api/modules/${moduleKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        });
        const payload = await res.json();
        if (!payload.success) {
          return {
            ok: false,
            error: payload?.error?.message_en ?? 'Could not save.',
            errorBn: payload?.error?.message_bn,
          };
        }
        return { ok: true, data: payload.data as Row };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
      } finally {
        setPending(false);
      }
    },
    [moduleKey, session.demo]
  );

  const update = useCallback(
    async (id: string, values: Row): Promise<MutateResult> => {
      const spec = getModule(moduleKey);
      if (!spec) return { ok: false, error: 'Unknown module' };
      setPending(true);
      try {
        if (session.demo || !isSupabaseConfigured()) {
          if (!demoRowIsLocal(spec.table, id) || !demoParentIsLocal(moduleKey, values)) return { ok: false, error: 'Actions are limited to items from your campus.' };
          const { university_id: _ignoredUniversity, ...safeValues } = values;
          const updated = demoUpdate(spec.table, id, safeValues);
          return updated ? { ok: true, data: updated, demo: true } : { ok: false, error: 'Not found in demo store' };
        }
        const res = await fetch(`/api/modules/${moduleKey}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...values }),
        });
        const payload = await res.json();
        if (!payload.success) {
          return { ok: false, error: payload?.error?.message_en ?? 'Could not update.' };
        }
        return { ok: true, data: payload.data as Row };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
      } finally {
        setPending(false);
      }
    },
    [moduleKey, session.demo]
  );

  const remove = useCallback(
    async (id: string): Promise<MutateResult> => {
      const spec = getModule(moduleKey);
      if (!spec) return { ok: false, error: 'Unknown module' };
      setPending(true);
      try {
        if (session.demo || !isSupabaseConfigured()) {
          if (!demoRowIsLocal(spec.table, id)) return { ok: false, error: 'Actions are limited to items from your campus.' };
          demoDelete(spec.table, id);
          return { ok: true, demo: true };
        }
        const res = await fetch(`/api/modules/${moduleKey}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        const payload = await res.json();
        if (!payload.success) return { ok: false, error: payload?.error?.message_en ?? 'Could not delete.' };
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
      } finally {
        setPending(false);
      }
    },
    [moduleKey, session.demo]
  );

  return { create, update, remove, pending };
}

/** Local demo rows for a table (used by bespoke widgets that need joins). */
export function readDemoRows(table: string): Row[] {
  // Private demo data follows the active campus, even when public scope is global.
  return demoList(table);
}

export function demoInsertRow(table: string, row: Row) {
  return demoInsert(table, row);
}

export function demoUpdateRow(table: string, id: string, patch: Row) {
  return demoUpdate(table, id, patch);
}

export function useIsDemo() {
  return !isSupabaseConfigured();
}

/**
 * Combines a module list with a Supabase Realtime subscription so that new
 * rows, status changes and deletions appear instantly across browser sessions.
 */
export function useRealtimeModuleList<T extends Row = Row>(moduleKey: string, options: ListOptions = {}) {
  const spec = useMemo(() => getModule(moduleKey), [moduleKey]);
  const list = useModuleList<T>(moduleKey, options);
  // Never insert raw realtime payloads into a scoped/filtered result: re-query
  // through the API so campus, visibility, search, and owner rules all apply.
  useRealtimeTable(spec?.realtimeTable ?? null, {
    onInsert: list.refresh, onUpdate: list.refresh, onDelete: list.refresh,
  }, { enabled: options.enabled !== false });
  return list;
}

/**
 * Generic, resilient collection reader for tables that need a bespoke query
 * shape (for example the public civic board or the review feed).
 * Falls back to the local demo store when Supabase is not configured.
 */
export function useApiList<T extends Row = Row>(
  endpoint: string,
  options: { query?: Record<string, string | number | undefined>; table?: string; enabled?: boolean } = {}
): FetchState<T[]> {
  const session = useSession();
  const { scope } = useCampusScope();
  const allCampuses = scope === 'all' && options.query?.scope !== 'admin' &&
    (endpoint === '/api/events' || (session.authenticated && endpoint === '/api/civic/tickets'));
  const [data, setDataState] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(!isSupabaseConfigured());
  const [total, setTotal] = useState(0);
  const [tick, setTick] = useState(0);
  const queryKey = JSON.stringify(options.query ?? {});
  const enabled = options.enabled !== false;

  useEffect(() => {
    if (!enabled) { setDataState([]); setTotal(0); setLoading(false); return; }
    if (session.loading) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setDataState([]);
      setTotal(0);
      setError(null);
      if (!isSupabaseConfigured() || session.demo) {
        const campus = getActiveDemoUniversity();
        let rows = toList<T>(endpoint === '/api/complaints'
          ? demoTickets(campus.id, campus.code)
          : options.table ? demoList(options.table, {
              allCampuses,
              rowFilter: endpoint === '/api/civic/tickets'
                ? (row) => row.is_public_issue === true && !['HARASSMENT', 'RAGGING_BULLYING', 'SEXUAL_HARASSMENT', 'DISCRIMINATION', 'FINANCIAL'].includes(String(row.category))
                : allCampuses && endpoint === '/api/events'
                  ? (row) => row.is_public === true || (session.authenticated && row.university_id === campus.id)
                  : undefined,
            }) : []);
        if (endpoint === '/api/civic/tickets') {
          const publicColumns = ['id', 'university_id', 'tracking_code', 'title', 'category', 'severity', 'status', 'upvotes_count', 'is_public_issue', 'location_hint', 'evidence_urls', 'sla_due_at', 'sla_breached', 'created_at', 'last_activity_at', 'resolved_at', 'resolution_summary'];
          rows = rows.map((row) => Object.fromEntries(publicColumns.filter((key) => key in row).map((key) => [key, row[key]])) as T);
        }
        if (!cancelled) {
          setDataState(rows);
          setTotal(rows.length);
          setDemo(true);
          setLoading(false);
        }
        return;
      }
      try {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(options.query ?? {})) {
          if (value !== undefined && value !== '') params.set(key, String(value));
        }
        if (allCampuses) params.set('scope', 'all_campuses');
        const res = await fetch(`${endpoint}?${params.toString()}`, { cache: 'no-store', signal: AbortSignal.timeout(3000) });
        const payload = await res.json();
        if (cancelled) return;
        if (payload.success) {
          const rows = toList<T>(payload.data);
          setDataState(rows);
          setTotal(Number(payload.meta?.total ?? rows.length));
          setDemo(false);
        } else {
          setError(payload?.error?.message_en ?? 'Could not load data.');
          setDataState([]);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Network error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, queryKey, enabled, tick, session.loading, session.demo, session.userId, session.profile?.university_id, allCampuses]);

  useEffect(() => {
    if (isSupabaseConfigured()) return;
    return subscribeDemoRealtime((event) => {
      if (event.type === 'store') setTick((value) => value + 1);
    });
  }, []);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((updater: (prev: T[]) => T[]) => setDataState((prev) => updater(prev)), []);

  return { data, loading, error, demo, total, refresh, setData };
}
