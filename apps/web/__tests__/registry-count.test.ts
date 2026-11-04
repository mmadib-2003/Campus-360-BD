// apps/web/__tests__/registry-count.test.ts
// ============================================================================
// Behavioural guard for the one thing the static registry tests cannot see:
// what `registryRead` hands back when a query SUCCEEDS but carries its number
// outside `data`. The production symptom was /api/health/registry answering
// `{"ok":false,"rows":null,"error":null}` for four tables that were plainly
// readable — a head:true count query returns `data: null` with `count` beside
// it, and the probe was looking inside `data`. A report that says "failed, no
// error" is worse than a wrong number, because it points at the database.
// ============================================================================
import { describe, expect, it, vi } from 'vitest';

// Set before the import: resolveSupabaseUrl() memoises per module instance, and
// registryRead refuses to send anything when the endpoint looks unusable -- the ref
// below is deliberately 16 plain lowercase characters so it passes that shape check
// (a hyphenated or too-short ref is rejected before any query runs, which is the
// guard doing its job, not the behaviour under test).
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abcdefghijklmnop.supabase.co');

const { registryRead } = await import('@/lib/registry-cache');

describe('registryRead count passthrough', () => {
  it('carries count when data is null, i.e. a successful head:true count', async () => {
    const outcome = await registryRead<{ count: number | null }>('test.headcount', () =>
      Promise.resolve({ data: null, error: null, count: 51 })
    );
    expect(outcome.ok).toBe(true);
    expect(outcome.error).toBeNull();
    expect(outcome.data).toBeNull();
    expect(outcome.count).toBe(51);
  });

  it('reports a null count when PostgREST did not send one', async () => {
    const outcome = await registryRead('test.nocount', () =>
      Promise.resolve({ data: [{ id: 'u-1' }], error: null })
    );
    expect(outcome.ok).toBe(true);
    expect(outcome.count).toBeNull();
  });

  it('leaves count null on the failure path, so callers cannot read it as zero', async () => {
    const outcome = await registryRead('test.failure', () =>
      Promise.resolve({ data: null, error: { message: 'permission denied', code: '42501' } })
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.count).toBeNull();
  });
});
