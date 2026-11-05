import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { AuthSessionMissingError } from '@supabase/supabase-js';

const mock = vi.hoisted(() => ({ getUser: vi.fn(), demo: null as any }));
vi.mock('@/lib/request-context', () => ({ isSupabaseServerConfigured: () => true }));
vi.mock('@/lib/supabase-server', () => ({
  createSupabaseRouteClient: () => ({ auth: { getUser: mock.getUser } }),
  createSupabaseAdminClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }),
}));
vi.mock('@/lib/demo-auth', () => ({
  readSignedDemoSession: () => mock.demo,
  isDemoEmail: () => false,
  DEMO_ROLE_DEFAULTS: {},
  buildDemoProfileFromSession: () => ({}),
}));
import { GET } from '@/app/api/auth/session/route';

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test');
  mock.demo = null;
  mock.getUser.mockReset();
});
afterEach(() => vi.unstubAllEnvs());
describe('verified session route', () => {
  it('returns signed out when there is genuinely no auth session', async () => {
    mock.getUser.mockResolvedValue({ data: { user: null }, error: new AuthSessionMissingError() });
    const response = await GET();
    expect(response.status).toBe(200);
    expect((await response.json()).data.authenticated).toBe(false);
  });
  it('does not report signed out when Supabase is unavailable', async () => {
    mock.getUser.mockRejectedValue(new Error('network down'));
    const response = await GET();
    expect(response.status).toBe(503);
    expect((await response.json()).success).toBe(false);
  });
  it('also treats returned upstream errors as failures rather than sign-outs', async () => {
    mock.getUser.mockResolvedValue({ data: { user: null }, error: { status: 503, message: 'unavailable' } });
    expect((await GET()).status).toBe(503);
  });
});
