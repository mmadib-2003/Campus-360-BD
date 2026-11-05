import React from 'react';
import { useAppStore } from '@/lib/store';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  query: '', replace: vi.fn(), authenticated: true, loading: false,
  calls: [] as Array<{ endpoint: string; scope: string | null }>,
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/events/map',
  useSearchParams: () => new URLSearchParams(state.query),
  useRouter: () => ({ replace: state.replace }),
}));
vi.mock('next/link', () => ({ default: ({ children, href }: any) => React.createElement('a', { href }, children) }));
vi.mock('@/lib/i18n-client', () => ({ useUi: () => ({ t: (s: string) => s }) }));
vi.mock('@/lib/modules/client', () => ({
  useSession: () => ({ authenticated: state.authenticated, loading: state.loading, error: false, userId: state.authenticated ? 'student' : null }),
  useApiList: (endpoint: string, options: { query: { scope: string } }) => {
    state.calls.push({ endpoint, scope: options.query.scope });
    return { loading: false, error: null, data: [{ id: 'event-1', title_en: 'Campus event' }] };
  },
}));
vi.mock('@/components/maps/CampusGoogleMap', () => ({ CampusGoogleMap: ({ events }: any) => React.createElement('div', { 'data-map': true }, events.map((e: any) => e.title_en).join(',')) }));
vi.mock('@/components/modules/ui', () => ({ SkeletonList: () => React.createElement('span', null, 'Loading') }));
import LiveEventsMapPage from '@/app/events/map/page';

beforeEach(() => { useAppStore.setState({ listingScope: 'my_campus' }); state.query = ''; state.replace.mockReset(); state.authenticated = true; state.loading = false; state.calls = []; });
describe('events map campus toggle', () => {
  it('renders a My Campus toggle above the event map and replaces the URL on click', () => {
    const view = create(React.createElement(LiveEventsMapPage));
    const buttons = view.root.findAllByType('button');
    expect(buttons.map((b) => b.children.join(''))).toEqual(['🎓 My University Only', '🌐 All Universities']);
    expect(buttons[0].props['aria-pressed']).toBe(true);
    const root = view.toJSON() as any;
    expect(JSON.stringify(root.children[0])).toContain('Campus scope');
    expect(JSON.stringify(root.children[1])).toContain('Campus event');
    expect(state.calls).toContainEqual({ endpoint: '/api/events', scope: 'my_campus' });
    act(() => buttons[1].props.onClick());
    expect(state.replace).toHaveBeenCalledWith('/events/map?scope=all_campuses', { scroll: false });
    act(() => view.unmount());
  });
  it('reads all-campus scope on refresh and sends it to the events list', () => {
    state.query = 'q=music&scope=all';
    const view = create(React.createElement(LiveEventsMapPage));
    expect(view.root.findAllByType('button')[1].props['aria-pressed']).toBe(true);
    expect(state.calls).toContainEqual({ endpoint: '/api/events', scope: 'all_campuses' });
    act(() => view.root.findAllByType('button')[0].props.onClick());
    expect(state.replace).toHaveBeenCalledWith('/events/map?q=music&scope=my_campus', { scroll: false });
    act(() => view.unmount());
  });
  it('does not fetch a campus-local list without a signed-in profile', () => {
    state.authenticated = false;
    const view = create(React.createElement(LiveEventsMapPage));
    expect(JSON.stringify(view.toJSON())).toContain('Sign in');
    expect(view.root.findAllByType('button')).toHaveLength(2);
    expect(state.calls).toEqual([]);
  });
});
