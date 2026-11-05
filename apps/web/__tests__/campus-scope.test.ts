import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { MODULES } from '@/lib/modules/registry';
import { useAppStore } from '@/lib/store';
import { parseCampusScope, SHARED_MODULES, isSharedDemoRowVisible, withCampusScope } from '@/lib/campus-scope';

const mocks = vi.hoisted(() => ({
  params: '', replace: vi.fn(), authenticated: true, authStatus: 401,
  ops: [] as Array<[string, ...unknown[]]>, parent: null as unknown,
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/marketplace',
  useSearchParams: () => new URLSearchParams(mocks.params),
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock('@/lib/i18n-client', () => ({ useUi: () => ({ t: (s: string) => s }) }));
vi.mock('@/lib/request-context', () => ({
  isSupabaseServerConfigured: () => true,
  requireAuth: async () => mocks.authenticated ? { auth: {
    profile: { university_id: 'campus-a', trust_level: 'TRUSTED' },
    user: { id: 'user-a' }, supabase: client, admin: client, isAdmin: false,
  } } : { response: new Response('unauthorized', { status: mocks.authStatus }) },
}));
vi.mock('@/lib/supabase-server', () => ({ createSupabaseRouteClient: () => client, createSupabasePublicClient: () => client }));
vi.mock('@/lib/demo-auth', () => ({ readSignedDemoSession: () => null, isDemoEmail: () => false }));
vi.mock('@/lib/modules/side-effects', () => ({ runModuleSideEffects: vi.fn() }));

// Minimal chainable PostgREST fake, records the actual filters applied by routes.
const client = { from(table: string) { mocks.ops.push(['from', table]); return new Query(); } };
class Query {
  select(...a: unknown[]) { mocks.ops.push(['select', ...a]); return this; }
  eq(...a: unknown[]) { mocks.ops.push(['eq', ...a]); return this; }
  neq(...a: unknown[]) { mocks.ops.push(['neq', ...a]); return this; }
  in(...a: unknown[]) { mocks.ops.push(['in', ...a]); return this; }
  is(...a: unknown[]) { mocks.ops.push(['is', ...a]); return this; }
  or(...a: unknown[]) { mocks.ops.push(['or', ...a]); return this; }
  order(...a: unknown[]) { mocks.ops.push(['order', ...a]); return this; }
  range(...a: unknown[]) { mocks.ops.push(['range', ...a]); return this; }
  limit(...a: unknown[]) { mocks.ops.push(['limit', ...a]); return this; }
  insert(...a: unknown[]) { mocks.ops.push(['insert', ...a]); return this; }
  maybeSingle() { return Promise.resolve({ data: mocks.parent, error: null }); }
  single() { return Promise.resolve({ data: { id: 'new' }, error: null }); }
  then(resolve: (value: unknown) => void) { return Promise.resolve({ data: [], count: 0, error: null }).then(resolve); }
}
import { CampusScopeToggle } from '@/components/CampusScopeToggle';
import { GET as getModule, POST as postModule } from '@/app/api/modules/[module]/route';
import { GET as getEvents } from '@/app/api/events/route';
import { GET as getCivic } from '@/app/api/civic/tickets/route';
import { GET as getReviews } from '@/app/api/reviews/route';
import { GET as getArchive } from '@/app/api/archive/route';
const request = (url: string) => new NextRequest(`https://example.org${url}`);

beforeEach(() => { useAppStore.setState({ listingScope: 'my_campus' }); mocks.params = ''; mocks.replace.mockReset(); mocks.authenticated = true; mocks.authStatus = 401; mocks.ops = []; mocks.parent = null; });

describe('campus scope', () => {
  it('defaults unknown and missing scope to My Campus', () => {
    expect(parseCampusScope(null)).toBe('my_campus');
    expect(parseCampusScope('ALL')).toBe('my_campus');
    expect(parseCampusScope('all')).toBe('all');
  });
  it('writes a shareable URL without dropping other filters, and reflects URL on refresh', () => {
    mocks.params = 'q=books&category=BOOKS';
    const view = create(React.createElement(CampusScopeToggle));
    const buttons = view.root.findAllByType('button');
    expect(buttons[0].props['aria-pressed']).toBe(true);
    act(() => buttons[1].props.onClick());
    expect(mocks.replace).toHaveBeenCalledWith('/marketplace?q=books&category=BOOKS&scope=all_campuses', { scroll: false });
    mocks.params = 'q=books&scope=all';
    act(() => view.update(React.createElement(CampusScopeToggle)));
    expect(view.root.findAllByType('button')[1].props['aria-pressed']).toBe(true);
    act(() => view.root.findAllByType('button')[0].props.onClick());
    expect(mocks.replace).toHaveBeenLastCalledWith('/marketplace?q=books&scope=my_campus', { scroll: false });
  });
  it('preserves scope and existing parameters across internal navigation', () => {
    expect(withCampusScope('/health?tab=donors#top', 'all')).toBe('/health?tab=donors&scope=all_campuses#top');
    expect(withCampusScope('/marketplace?scope=my_campus', 'all')).toBe('/marketplace?scope=all_campuses');
    expect(withCampusScope('/civic?scope=admin', 'all')).toBe('/civic?scope=admin');
    expect(withCampusScope('https://example.org/', 'all')).toBe('https://example.org/');
    expect(withCampusScope('/events', 'my_campus')).toBe('/events');
  });
  it('keeps the standalone review widget campus-local despite broader listing RLS', async () => {
    await getReviews(request('/api/reviews?targetType=LIBRARY&targetId=test'));
    expect(mocks.ops.filter((op) => op[0] === 'eq' && op[1] === 'university_id')).toEqual([
      ['eq', 'university_id', 'campus-a'], ['eq', 'university_id', 'campus-a'],
    ]);
  });
  it('limits cross-campus archive metadata to public files and never returns storage paths', async () => {
    await getArchive(request('/api/archive?scope=all_campuses'));
    expect(mocks.ops).toContainEqual(['eq', 'visibility', 'PUBLIC']);
    expect(mocks.ops).not.toContainEqual(['eq', 'university_id', 'campus-a']);
    const projection = String(mocks.ops.find(([op]) => op === 'select')?.[1]);
    expect(projection).not.toContain('storage_path');
    expect(projection).not.toContain('checksum_sha256');
    mocks.ops = [];
    await getArchive(request('/api/archive?scope=my_campus'));
    expect(mocks.ops).toContainEqual(['eq', 'university_id', 'campus-a']);
  });
  it('uses the public review projection when browsing across campuses', async () => {
    await getReviews(request('/api/reviews?scope=all_campuses'));
    expect(mocks.ops).not.toContainEqual(['eq', 'university_id', 'campus-a']);
    expect(mocks.ops).toContainEqual(['eq', 'is_hidden', false]);
    expect(String(mocks.ops.find(([op]) => op === 'select')?.[1])).not.toContain('*');
  });
  it('keeps private modules out of the shared allowlist', () => {
    for (const key of ['marketplace-orders', 'marketplace-messages', 'blood-requests', 'complaint-upvotes', 'donations'])
      expect(SHARED_MODULES.has(key)).toBe(false);
  });
  it('uses anonymous listing policies and restrictive campus write guards, without broad base-table read policies', () => {
    const sql = readFileSync(path.resolve(process.cwd(), 'supabase/migrations/0023_ju_image_and_cross_campus_scope.sql'), 'utf8');
    for (const key of SHARED_MODULES) expect(MODULES[key].publicRead).toBe(true);
    expect(sql).not.toMatch(/FOR SELECT TO authenticated USING \(true\)/i);
    expect(sql).toContain('AS RESTRICTIVE FOR INSERT');
    expect(sql).toContain('AS RESTRICTIVE FOR UPDATE');
    expect(sql).toContain('AS RESTRICTIVE FOR DELETE');
    expect(sql).toContain("('event_rsvps','event_id','events')");
    expect(sql).toContain("('marketplace_orders','listing_id','marketplace_listings')");
  });
  it('uses the listing visibility rules in demo mode', () => {
    expect(isSharedDemoRowVisible('marketplace', { status: 'AVAILABLE' })).toBe(true);
    expect(isSharedDemoRowVisible('marketplace', { status: 'SOLD' })).toBe(false);
    expect(isSharedDemoRowVisible('housing', { status: 'FILLED' })).toBe(false);
    expect(isSharedDemoRowVisible('lost-found', { status: 'OPEN' })).toBe(true);
  });
  it('scopes marketplace to the authenticated campus by default', async () => {
    const response = await getModule(request('/api/modules/marketplace'), { params: { module: 'marketplace' } });
    expect(response.status).toBe(200);
    expect(mocks.ops).toContainEqual(['eq', 'university_id', 'campus-a']);
  });
  it('omits the campus filter for shared marketplace listings but keeps public state constraints', async () => {
    await getModule(request('/api/modules/marketplace?scope=all'), { params: { module: 'marketplace' } });
    expect(mocks.ops).not.toContainEqual(['eq', 'university_id', 'campus-a']);
    expect(mocks.ops).toContainEqual(['in', 'status', ['AVAILABLE', 'RESERVED']]);
    expect(mocks.ops).toContainEqual(['is', 'deleted_at', null]);
  });
  it('never widens private modules or mine queries', async () => {
    await getModule(request('/api/modules/marketplace-orders?scope=all'), { params: { module: 'marketplace-orders' } });
    expect(mocks.ops).toContainEqual(['eq', 'university_id', 'campus-a']);
    mocks.ops = [];
    await getModule(request('/api/modules/marketplace?scope=all&mine=true'), { params: { module: 'marketplace' } });
    expect(mocks.ops).toContainEqual(['eq', 'university_id', 'campus-a']);
    expect(mocks.ops).toContainEqual(['eq', 'seller_id', 'user-a']);
  });
  it('retains anonymous public access without granting private endpoints', async () => {
    mocks.authenticated = false;
    expect((await getModule(request('/api/modules/marketplace?scope=all'), { params: { module: 'marketplace' } })).status).toBe(200);
    expect((await getModule(request('/api/modules/marketplace-orders?scope=all'), { params: { module: 'marketplace-orders' } })).status).toBe(401);
  });
  it('rejects actions on foreign-campus listings before inserting', async () => {
    const req = new NextRequest('https://example.org/api/modules/marketplace-orders', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ listing_id: '11111111-1111-4111-8111-111111111111', seller_id: '22222222-2222-4222-8222-222222222222' }),
    });
    const response = await postModule(req, { params: { module: 'marketplace-orders' } });
    expect(response.status).toBe(403);
    expect(mocks.ops).toContainEqual(['eq', 'university_id', 'campus-a']);
    expect(mocks.ops.some(([op]) => op === 'insert')).toBe(false);
  });
  it('reads own events and public events across campuses for authenticated users', async () => {
    await getEvents(request('/api/events?scope=all'));
    expect(mocks.ops).not.toContainEqual(['eq', 'university_id', 'campus-a']);
    expect(mocks.ops).toContainEqual(['or', 'is_public.eq.true,university_id.eq.campus-a']);
    expect(mocks.ops).toContainEqual(['is', 'deleted_at', null]);
    mocks.ops = [];
    await getEvents(request('/api/events'));
    expect(mocks.ops).toContainEqual(['eq', 'university_id', 'campus-a']);
  });
  it('requires a campus profile for default events and permits only explicit public guest browsing', async () => {
    mocks.authenticated = false;
    expect((await getEvents(request('/api/events'))).status).toBe(401);
    expect(mocks.ops).toEqual([]);
    expect((await getEvents(request('/api/events?scope=all'))).status).toBe(200);
    expect(mocks.ops).toContainEqual(['eq', 'is_public', true]);
  });
  it('does not fall back to a public feed for an incomplete profile', async () => {
    mocks.authenticated = false;
    mocks.authStatus = 403;
    expect((await getEvents(request('/api/events?scope=all'))).status).toBe(403);
    expect(mocks.ops).toEqual([]);
  });
  it('keeps civic All Campuses limited to opted-in non-sensitive public tickets', async () => {
    await getCivic(request('/api/civic/tickets?scope=all'));
    expect(mocks.ops).toContainEqual(['eq', 'is_public_issue', true]);
    for (const category of ['SEXUAL_HARASSMENT', 'RAGGING_BULLYING', 'HARASSMENT', 'DISCRIMINATION', 'FINANCIAL'])
      expect(mocks.ops).toContainEqual(['neq', 'category', category]);
    expect(mocks.ops).not.toContainEqual(['eq', 'university_id', 'campus-a']);
    mocks.ops = [];
    await getCivic(request('/api/civic/tickets'));
    expect(mocks.ops).toContainEqual(['eq', 'university_id', 'campus-a']);
  });
});
