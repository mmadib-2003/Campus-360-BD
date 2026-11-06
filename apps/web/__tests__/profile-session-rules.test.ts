import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mock = vi.hoisted(() => ({
  user: { id: 'user-1' } as null | { id: string },
  profile: { id: 'user-1', university_id: 'univ-1', role: 'faculty', hall_id: null, program_session: null } as Record<string, unknown>,
  roles: [{ role: 'FACULTY' }] as Array<{ role: string }>,
  update: vi.fn(),
  updateError: null as null | { message: string },
  hallFound: true,
}));

vi.mock('@/lib/request-context', () => ({ isSupabaseServerConfigured: () => true }));
vi.mock('@/lib/supabase-server', () => ({
  createSupabaseRouteClient: () => ({
    auth: { getUser: async () => ({ data: { user: mock.user }, error: null }) },
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const builder = {
        select: () => builder,
        eq: (key: string, value: unknown) => { filters[key] = value; return builder; },
        single: async () => ({ data: mock.profile, error: null }),
        maybeSingle: async () => ({ data: table === 'university_halls' && mock.hallFound && filters.university_id === mock.profile.university_id ? { id: filters.id } : null, error: null }),
        then: (resolve: (value: unknown) => unknown) => resolve({ data: mock.roles, error: null }),
      };
      return {
        ...builder,
        update: (payload: Record<string, unknown>) => {
          mock.update(payload);
          return { eq: () => ({ select: () => ({ single: async () => ({ data: { ...mock.profile, ...payload }, error: mock.updateError }) }) }) };
        },
      };
    },
  }),
}));

import { PATCH } from '@/app/api/profile/route';

const HALL = '9b0f2a6e-0000-4000-8000-000000000002';
function patch(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/profile', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mock.user = { id: 'user-1' };
  mock.profile = { id: 'user-1', university_id: 'univ-1', role: 'faculty', hall_id: null, program_session: null };
  mock.roles = [{ role: 'FACULTY' }];
  mock.update.mockReset(); mock.updateError = null; mock.hallFound = true;
});

describe('profile onboarding persistence', () => {
  it('saves faculty session with a null hall and completes onboarding', async () => {
    const response = await PATCH(patch({ program_session: ' 2023-24 ', hall_id: null, onboarding_completed: true }));
    expect(response.status).toBe(200);
    expect(mock.update).toHaveBeenCalledWith({ program_session: '2023-24', hall_id: null, onboarding_completed: true });
  });

  it('requires a valid session before completing onboarding', async () => {
    for (const program_session of [undefined, '', '2023-25']) {
      const response = await PATCH(patch({ program_session, onboarding_completed: true }));
      expect(response.status).toBe(400);
    }
    expect(mock.update).not.toHaveBeenCalled();
  });

  it('requires students to keep a hall belonging to their university', async () => {
    mock.profile.role = 'student'; mock.roles = [{ role: 'STUDENT' }];
    const missing = await PATCH(patch({ program_session: '2023-24', hall_id: null, onboarding_completed: true }));
    expect(missing.status).toBe(400);
    mock.hallFound = false;
    const wrongCampus = await PATCH(patch({ program_session: '2023-24', hall_id: HALL, onboarding_completed: true }));
    expect(wrongCampus.status).toBe(400);
    mock.hallFound = true;
    const valid = await PATCH(patch({ program_session: '2023-24', hall_id: HALL, onboarding_completed: true }));
    expect(valid.status).toBe(200);
    expect(mock.update).toHaveBeenCalledWith(expect.objectContaining({ hall_id: HALL, program_session: '2023-24' }));
  });

  it('rejects a hall for alumni and never lets the body change role, email or tenant', async () => {
    mock.profile.role = 'alumni'; mock.roles = [{ role: 'ALUMNI' }];
    const forbidden = await PATCH(patch({ hall_id: HALL }));
    expect(forbidden.status).toBe(400);
    const response = await PATCH(patch({ bio: 'Hello', role: 'admin', email: 'evil@example.com', university_id: 'other', trust_level: 'TRUSTED' }));
    expect(response.status).toBe(200);
    expect(mock.update).toHaveBeenCalledWith({ bio: 'Hello' });
  });

  it('preserves omitted fields and surfaces database failures to the form', async () => {
    const partial = await PATCH(patch({ bio: 'Updated bio' }));
    expect(partial.status).toBe(200);
    expect(mock.update).toHaveBeenCalledWith({ bio: 'Updated bio' });
    mock.updateError = { message: 'database unavailable' };
    const failed = await PATCH(patch({ program_session: '2023-24', onboarding_completed: true }));
    expect(failed.status).toBe(400);
    expect((await failed.json()).error.code).toBe('UPDATE_FAILED');
  });
});
