import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ params: '', user: 'user-a' }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/marketplace',
  useSearchParams: () => new URLSearchParams(state.params),
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock('@/lib/supabase-browser', () => ({ isSupabaseConfigured: () => true, trySupabaseBrowser: () => null }));
vi.mock('@/lib/modules/session', () => ({ useSession: () => ({
  authenticated: true, loading: false, demo: false, userId: state.user,
  profile: { university_id: 'campus-a' },
}) }));
import { useModuleList } from '@/lib/modules/client';
function deferred() {
  let resolve!: (value: any) => void;
  const promise = new Promise<any>((r) => { resolve = r; });
  return { promise, resolve };
}
function Viewer() {
  const list = useModuleList('marketplace');
  return React.createElement('div', null, list.data.map((row) => row.id).join(','));
}
afterEach(() => { vi.unstubAllGlobals(); state.params = ''; state.user = 'user-a'; });
describe('campus-scoped requests', () => {
  it('discards an older response after switching scope', async () => {
    const first = deferred();
    const second = deferred();
    const fetchMock = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    vi.stubGlobal('fetch', fetchMock);
    let view!: ReturnType<typeof create>;
    await act(async () => { view = create(React.createElement(Viewer)); });
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('scope=all');
    state.params = 'scope=all';
    await act(async () => { view.update(React.createElement(Viewer)); });
    expect(String(fetchMock.mock.calls[1][0])).toContain('scope=all');
    await act(async () => { second.resolve({ json: async () => ({ success: true, data: [{ id: 'new' }] }) }); await second.promise; });
    expect(view.toJSON()).toMatchObject({ children: ['new'] });
    await act(async () => { first.resolve({ json: async () => ({ success: true, data: [{ id: 'old' }] }) }); await first.promise; });
    expect(view.toJSON()).toMatchObject({ children: ['new'] });
    view.unmount();
  });
});
