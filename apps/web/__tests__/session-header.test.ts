import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authCallback: null as null | ((event: string) => void),
  pathname: '/feed',
  unsubscribe: vi.fn(),
  getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
}));
vi.mock('@/lib/supabase-browser', () => ({
  isSupabaseConfigured: () => true,
  trySupabaseBrowser: () => ({ auth: { getUser: mocks.getUser, onAuthStateChange: (callback: (event: string) => void) => {
    mocks.authCallback = callback;
    return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
  } } }),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('next/link', () => ({ default: ({ children, href, ...props }: any) => React.createElement('a', { href, ...props }, children) }));
vi.mock('@/lib/i18n-client', () => ({ useUi: () => ({ t: (text: string) => text, locale: 'en', toggleLocale: vi.fn() }) }));
vi.mock('@/components/notifications/NotificationBell', () => ({ NotificationBell: () => null }));
vi.mock('@/components/ThemeToggle', () => ({ ThemeToggle: () => null }));

import { SessionProvider, useSession } from '@/lib/modules/session';
import { AppShell } from '@/components/shell/AppShell';

function Page() {
  const session = useSession();
  return React.createElement('div', { 'data-page-session': true }, session.loading ? 'loading' : session.profile?.full_name ?? (session.authenticated ? 'authenticated' : 'guest'));
}
function response(data: unknown) {
  return { ok: true, json: async () => ({ success: true, data }) };
}
const signedOut = { authenticated: false, demo: false, profile: null, roles: [] };
const signedIn = { authenticated: true, demo: false, user: { id: '123', email: 'adib@example.edu' }, profile: { id: '123', full_name: 'Muntasir Adib', trust_level: 'ID_VERIFIED' }, roles: [{ role: 'STUDENT' }] };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
let tree: ReactTestRenderer | undefined;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  const fakeWindow = Object.assign(new EventTarget(), { scrollTo: vi.fn() });
  vi.stubGlobal('window', fakeWindow);
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  mocks.authCallback = null;
  mocks.pathname = '/feed';
  mocks.unsubscribe.mockClear();
  mocks.getUser.mockReset();
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
});
afterEach(() => {
  if (tree) act(() => tree?.unmount());
  tree = undefined;
  vi.unstubAllGlobals();
});
function render() {
  act(() => { tree = create(React.createElement(SessionProvider, null, React.createElement(AppShell, null, React.createElement(Page)))); });
}
function text() { return JSON.stringify(tree?.toJSON()); }

describe('shared header and page session', () => {
  it('shows a skeleton until resolved, then updates both shell and page after cookie sign-in and sign-out', async () => {
    const initial = deferred<ReturnType<typeof response>>();
    const login = deferred<ReturnType<typeof response>>();
    const logout = deferred<ReturnType<typeof response>>();
    fetchMock.mockReturnValueOnce(initial.promise).mockReturnValueOnce(login.promise).mockReturnValueOnce(logout.promise);
    render();
    expect(text()).toContain('Loading account');
    expect(text()).not.toContain('Join Your Campus');
    await act(async () => { initial.resolve(response(signedOut)); await initial.promise; });
    expect(text()).toContain('Join Your Campus');
    expect(text()).toContain('Sign In');
    await act(async () => { window.dispatchEvent(new Event('campus360:auth-changed')); });
    expect(text()).toContain('Loading account');
    expect(text()).not.toContain('Join Your Campus');
    await act(async () => { login.resolve(response(signedIn)); await login.promise; });
    expect(text()).toContain('Muntasir Adib');
    expect(text()).toContain('Student');
    expect(text()).toContain('Sign Out');
    expect(text()).not.toContain('Join Your Campus');
    expect(tree?.root.findByProps({ 'data-page-session': true }).children).toEqual(['Muntasir Adib']);
    await act(async () => { window.dispatchEvent(new Event('campus360:auth-changed')); });
    await act(async () => { logout.resolve(response(signedOut)); await logout.promise; });
    expect(text()).toContain('Join Your Campus');
    expect(tree?.root.findByProps({ 'data-page-session': true }).children).toEqual(['guest']);
  });

  it('does not render a second shell toggle on the events map', async () => {
    mocks.pathname = '/events/map';
    fetchMock.mockResolvedValueOnce(response(signedIn));
    render();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(text()).not.toContain('My Campus Only');
  });

  it('verifies the browser user on mount and reconciles a delayed server cookie', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: '123' } }, error: null } as any);
    fetchMock.mockResolvedValueOnce(response(signedOut)).mockResolvedValueOnce(response(signedIn));
    render();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(text()).toContain('Muntasir Adib');
    expect(text()).not.toContain('Join Your Campus');
  });

  it('listens for Supabase auth changes and discards stale responses', async () => {
    const initial = deferred<ReturnType<typeof response>>();
    const current = deferred<ReturnType<typeof response>>();
    fetchMock.mockReturnValueOnce(initial.promise).mockReturnValueOnce(current.promise);
    render();
    await act(async () => { mocks.authCallback?.('SIGNED_IN'); await new Promise((resolve) => setTimeout(resolve, 5)); });
    await act(async () => { current.resolve(response(signedIn)); await current.promise; });
    await act(async () => { initial.resolve(response(signedOut)); await initial.promise; });
    expect(text()).toContain('Muntasir Adib');
    expect(text()).not.toContain('Join Your Campus');
    act(() => tree?.unmount());
    tree = undefined;
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  });

  it('does not label a failed session lookup as signed out and offers retry', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(response(signedIn));
    render();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(text()).toContain('Retry account');
    expect(text()).not.toContain('Join Your Campus');
    await act(async () => { tree?.root.findByProps({ children: 'Retry account' }).props.onClick(); });
    expect(text()).toContain('Muntasir Adib');
  });

  it('refreshes cookie-backed sign-outs from another tab', async () => {
    fetchMock.mockResolvedValueOnce(response(signedIn)).mockResolvedValueOnce(response(signedOut));
    render();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(text()).toContain('Muntasir Adib');
    const storage = new Event('storage');
    Object.defineProperty(storage, 'key', { value: 'campus360.auth-changed' });
    await act(async () => { window.dispatchEvent(storage); });
    expect(text()).toContain('Join Your Campus');
    expect(text()).not.toContain('Muntasir Adib');
  });

  it('retains a verified account on a transient background error', async () => {
    fetchMock.mockResolvedValueOnce(response(signedIn)).mockRejectedValueOnce(new Error('network'));
    render();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(text()).toContain('Muntasir Adib');
    expect(text()).not.toContain('Join Your Campus');
  });

  it('shows an account for an authenticated user even if their profile is missing', async () => {
    fetchMock.mockResolvedValueOnce(response({ ...signedIn, profile: null }));
    render();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(text()).toContain('adib@example.edu');
    expect(text()).not.toContain('Join Your Campus');
  });
});
