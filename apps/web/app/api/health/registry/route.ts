// apps/web/app/api/health/registry/route.ts
// ============================================================================
// "Is the registry reachable *right now*, and from where?" — one curl, no
// deploy needed to answer it.
//
// Exists because the production symptom was `TypeError: fetch failed` above the
// Public University combobox, which reads like a broken client-side URL but was
// a route failing to reach Supabase. The two questions that distinguish those
// cases — what endpoint is this runtime actually pointed at, and does a live
// query against it succeed — were previously only answerable by redeploying with
// a log line. This route answers both from the same code path the signup page
// uses (`supabaseTarget()` + `registryRead()`), so it cannot drift from it.
//
// Safe to keep public: it returns counts and a hostname. The Supabase project
// URL and its host are already shipped to every browser in the client bundle;
// no key, token or row content is ever read into the response.
// ============================================================================
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseRouteClient, supabaseTarget } from '@/lib/supabase-server';
import { REGISTRY_NO_STORE, registryMessage, registryRead } from '@/lib/registry-cache';
import { describeSupabaseKey } from '@/lib/supabase-url';
import { isSupabaseServerConfigured } from '@/lib/request-context';

// Never cache a health probe — a cached answer is a false answer.
export const dynamic = 'force-dynamic';

interface TableProbe {
  table: string;
  ok: boolean;
  rows: number | null;
  ms: number;
  error: string | null;
  code: string | null;
}

const PROBES: Array<{ table: string; filter?: (query: any) => any }> = [
  { table: 'universities', filter: (q) => q.eq('is_active', true) },
  { table: 'departments' },
  { table: 'academic_programs', filter: (q) => q.eq('is_active', true) },
  { table: 'university_halls', filter: (q) => q.eq('is_active', true) },
];

export async function GET() {
  const startedAt = Date.now();
  const target = supabaseTarget();

  const body: {
    success: boolean;
    checkedAt: string;
    endpoint: { url: string | null; host: string | null; problem: string | null; repaired: string | null };
    env: {
      supabaseUrlPresent: boolean;
      serverSupabaseConfigured: boolean;
      serviceRolePresent: boolean;
      authMode: string;
      /**
       * Shape only — never a value. A placeholder or wrong-project key is the
       * next thing to go wrong after a placeholder URL, and `non-empty` was not
       * enough of a check for the URL either.
       */
      anonKey: ReturnType<typeof describeSupabaseKey>;
      serviceRoleKey: ReturnType<typeof describeSupabaseKey>;
    };
    tables: TableProbe[];
    allOk: boolean;
    hint: string | null;
  } = {
    success: false,
    checkedAt: new Date().toISOString(),
    endpoint: { url: target.url, host: target.host, problem: target.problem, repaired: target.repaired },
    env: {
      supabaseUrlPresent: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      serverSupabaseConfigured: isSupabaseServerConfigured(),
      serviceRolePresent: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      authMode: process.env.NEXT_PUBLIC_AUTH_MODE ?? 'unset',
      anonKey: describeSupabaseKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        role: 'anon',
        projectRef: target.projectRef ?? null,
      }),
      serviceRoleKey: describeSupabaseKey(process.env.SUPABASE_SERVICE_ROLE_KEY, {
        role: 'service_role',
        projectRef: target.projectRef ?? null,
      }),
    },
    tables: [],
    allOk: false,
    hint: null,
  };

  const keyProblems = [
    body.env.anonKey.problem ? `NEXT_PUBLIC_SUPABASE_ANON_KEY ${body.env.anonKey.problem}` : null,
    body.env.serviceRoleKey.problem ? `SUPABASE_SERVICE_ROLE_KEY ${body.env.serviceRoleKey.problem}` : null,
  ].filter(Boolean) as string[];

  if (target.problem) {
    // Don't even attempt the queries: say precisely what is wrong with the URL.
    body.hint = `Fix NEXT_PUBLIC_SUPABASE_URL. ${target.problem}`;
    return NextResponse.json(body, { status: 503, headers: { ...REGISTRY_NO_STORE } });
  }
  if (keyProblems.length) {
    // Same reasoning for the credentials: report it before PostgREST answers with
    // a 401 that mentions neither the variable name nor the project.
    body.hint = `Fix the Supabase credentials for this deployment: ${keyProblems.join(' | ')}`;
    return NextResponse.json(body, { status: 503, headers: { ...REGISTRY_NO_STORE } });
  }

  // The service-role client is the honest probe (it proves the table has rows);
  // without it, fall back to the same anon+cookies client the routes use.
  const useAdmin = body.env.serviceRolePresent;
  let client: ReturnType<typeof createSupabaseRouteClient>;
  try {
    client = useAdmin ? createSupabaseAdminClient() : createSupabaseRouteClient();
  } catch (error) {
    body.hint = `The Supabase client could not be built: ${(error as Error).message}`;
    return NextResponse.json(body, { status: 503, headers: { ...REGISTRY_NO_STORE } });
  }

  for (const probe of PROBES) {
    const tableStartedAt = Date.now();
    const read = await registryRead<{ count: number | null }>(
      `health.${probe.table}`,
      () => {
        let query = (client as any)
          .from(probe.table)
          .select('id', { count: 'exact', head: true });
        if (probe.filter) query = probe.filter(query);
        return query;
      },
      { client: useAdmin ? 'service-role' : 'anon' }
    );
    const rows = read.ok ? (read.data?.count ?? null) : null;
    body.tables.push({
      table: probe.table,
      ok: read.ok && rows !== null,
      rows,
      ms: Date.now() - tableStartedAt,
      error: read.ok ? null : registryMessage(read, 'no fault recorded'),
      code: read.fault?.code ?? read.error?.code ?? null,
    });
    if (!read.ok && read.fault?.transient) body.hint = read.fault.hint;
  }

  body.allOk = body.tables.length > 0 && body.tables.every((row) => row.ok);
  body.success = body.allOk;
  if (!body.allOk && !body.hint) {
    body.hint =
      'At least one registry table could not be counted from this runtime — the error text above carries the errno/host; `vercel logs --follow` shows the same under [campus360:registry].';
  }

  return NextResponse.json(body, {
    status: body.allOk ? 200 : 503,
    headers: {
      ...REGISTRY_NO_STORE,
      'X-Campus360-Registry-Check': body.allOk ? 'ok' : 'failed',
      'X-Campus360-Endpoint': target.host ?? 'unresolved',
    },
  });
}
