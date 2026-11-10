import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: { loading: false, authenticated: false, email: null as string | null, isAdmin: false },
  replace: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace, push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('next/link', () => ({ default: ({ children, href, ...props }: any) => React.createElement('a', { href, ...props }, children) }));
vi.mock('@/lib/i18n-client', () => ({ useUi: () => ({ t: (text: string) => text, locale: 'en', toggleLocale: vi.fn() }) }));
vi.mock('@/lib/modules/session', () => ({ useSession: () => mocks.session }));
vi.mock('@/components/modules/ui', () => ({ SkeletonGrid: () => React.createElement('div', { 'data-skeleton': true }) }));
vi.mock('framer-motion', () => {
  const motion = new Proxy({}, {
    get: (_t, tag: string) => ({ children, className, id }: any) => React.createElement(tag, { className, id }, children),
  });
  return { motion, useInView: () => true, useReducedMotion: () => true };
});

import { DEMO_UNIVERSITIES } from '@/lib/modules/demo-data';
import { MODULE_META } from '@/lib/modules/labels';
import { hasSeenWelcome, markWelcomeSeen, welcomeSeenKey } from '@/lib/welcome';
import { WelcomeGate } from '@/components/welcome/WelcomeGate';
import { WelcomeView } from '@/components/welcome/WelcomeView';

function memoryStorage() {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
}
let tree: ReactTestRenderer | undefined;
const json = () => JSON.stringify(tree?.toJSON());

beforeEach(() => {
  vi.stubGlobal('window', Object.assign(new EventTarget(), { localStorage: memoryStorage() }));
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
  mocks.session = { loading: false, authenticated: false, email: null, isAdmin: false };
  mocks.replace.mockClear();
});
afterEach(() => {
  if (tree) act(() => tree?.unmount());
  tree = undefined;
  vi.unstubAllGlobals();
});

describe('welcome flag', () => {
  it('is per account, and guests share one key', () => {
    expect(welcomeSeenKey(null)).toBe(welcomeSeenKey(undefined));
    expect(welcomeSeenKey('A@x.edu')).toBe(welcomeSeenKey(' a@x.edu '));
    expect(welcomeSeenKey('a@x.edu')).not.toBe(welcomeSeenKey(null));
  });
  it('remembers once marked', () => {
    expect(hasSeenWelcome('a@x.edu')).toBe(false);
    markWelcomeSeen('a@x.edu');
    expect(hasSeenWelcome('a@x.edu')).toBe(true);
    expect(hasSeenWelcome(null)).toBe(false);
  });
  it('never loops the visitor when storage is unavailable', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => { throw new Error('blocked'); } } });
    expect(hasSeenWelcome(null)).toBe(true);
  });
});

describe('WelcomeGate on /', () => {
  const mount = () => act(() => { tree = create(React.createElement(WelcomeGate, null, React.createElement('div', null, 'DASHBOARD'))); });

  it('sends a first-time guest to /welcome and holds the dashboard back', () => {
    mount();
    expect(mocks.replace).toHaveBeenCalledWith('/welcome');
    expect(json()).not.toContain('DASHBOARD');
  });
  it('shows the dashboard once the welcome screen has been seen', () => {
    markWelcomeSeen(null);
    mount();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(json()).toContain('DASHBOARD');
  });
  it('waits for the session before deciding', () => {
    mocks.session = { loading: true, authenticated: false, email: null, isAdmin: false };
    mount();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
  it('shows a newly signed-in account the welcome screen once, even if the guest already saw it', () => {
    markWelcomeSeen(null);
    mocks.session = { loading: false, authenticated: true, email: 'new@du.ac.bd', isAdmin: false };
    mount();
    expect(mocks.replace).toHaveBeenCalledWith('/welcome');
  });
});

describe('WelcomeView', () => {
  const mount = () => act(() => { tree = create(React.createElement(WelcomeView)); });

  it('lists every one of the 13 universities from the registry constant', () => {
    expect(DEMO_UNIVERSITIES).toHaveLength(13);
    mount();
    for (const university of DEMO_UNIVERSITIES) expect(json()).toContain(university.name_en);
  });
  it('shows the 12 modules, both CTAs and the footer links', () => {
    mount();
    for (const key of ['marketplace', 'skills', 'civic', 'events', 'health', 'mentorship', 'housing', 'careers', 'dining', 'lostfound', 'sports', 'trust']) {
      expect(json()).toContain(`"href":"${MODULE_META[key].href}"`);
    }
    expect(json()).toContain('Get Started');
    expect(json()).toContain('"href":"#modules"');
    for (const href of ['/privacy', '/terms']) expect(json()).toContain(`"href":"${href}"`);
    expect(json()).toContain('mailto:');
  });
  it('offers signed-in users a way on to the dashboard instead of sign-up', () => {
    mocks.session = { loading: false, authenticated: true, email: 'a@du.ac.bd', isAdmin: false };
    mount();
    expect(json()).toContain('Continue to Dashboard');
    expect(json()).not.toContain('Get Started');
    expect(hasSeenWelcome('a@du.ac.bd')).toBe(true);
  });
});

describe('simplified navigation keeps every route', () => {
  it('still links every route of the old sidebar', () => {
    const shell = readFileSync(resolve(process.cwd(), 'apps/web/components/shell/AppShell.tsx'), 'utf8');
    for (const href of ['/', '/marketplace', '/skills', '/civic', '/events', '/events/map', '/health', '/archive', '/mentorship', '/housing', '/careers', '/dining', '/lost-found', '/sports', '/trust', '/reviews', '/admin/console']) {
      expect(shell).toContain(`href: '${href}'`);
    }
  });
});
