// apps/web/__tests__/welcome-screen.test.ts
// Renders the Phase 2 Welcome experience and asserts the three promised
// sections (sticky header + hero, 4-pillar overview, university showcase)
// plus the demo entry point, without a DOM (react-test-renderer + mocks).

import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  pathname: '/',
  push: vi.fn(),
  universities: [] as Array<Record<string, unknown>>,
}));

vi.mock('framer-motion', () => {
  const ReactLib = require('react');
  const MOTION_PROPS = new Set([
    'variants', 'initial', 'animate', 'exit', 'transition', 'whileHover',
    'whileTap', 'whileInView', 'viewport', 'layout', 'layoutId', 'drag',
    'dragConstraints', 'onAnimationStart', 'onAnimationComplete', 'custom',
  ]);
  const tag = (name: string) => {
    const Component = ({ children, ...props }: any) => {
      const clean: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(props)) {
        if (!MOTION_PROPS.has(key) && typeof value !== 'function') clean[key] = value;
      }
      return ReactLib.createElement(name, clean, children);
    };
    Component.displayName = `motion.${name}`;
    return Component;
  };
  const motion = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => tag(String(key)),
  });
  return {
    motion,
    AnimatePresence: ({ children }: any) => children ?? null,
    useReducedMotion: () => false,
  };
});

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: mocks.push, refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => React.createElement('a', { href, ...props }, children),
}));
vi.mock('@/lib/i18n-client', () => ({
  useUi: () => ({ t: (text: string, vars?: Record<string, string>) => {
    let value = text;
    for (const [name, replacement] of Object.entries(vars ?? {})) value = value.split(`{${name}}`).join(replacement);
    return value;
  }, locale: 'en', toggleLocale: vi.fn() }),
}));
vi.mock('@/components/ThemeToggle', () => ({ ThemeToggle: () => null }));
vi.mock('@/components/notifications/NotificationBell', () => ({ NotificationBell: () => null }));
vi.mock('@/lib/supabase-browser', () => ({
  isSupabaseConfigured: () => true,
  trySupabaseBrowser: () => ({
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  }),
}));
vi.mock('@/components/auth/QuickDemoLogin', () => ({
  QuickDemoLogin: () => React.createElement('div', { 'data-testid': 'quick-demo' }, 'QuickDemoLogin'),
}));

import { WelcomeView } from '@/components/welcome/WelcomeView';
import { WelcomeGate } from '@/components/welcome/WelcomeGate';
import { MODULE_META } from '@/lib/modules/labels';
import PrivacyPage from '@/app/privacy/page';
import TermsPage from '@/app/terms/page';
import { SessionProvider } from '@/lib/modules/session';
import { AppShell } from '@/components/shell/AppShell';

let tree: ReactTestRenderer | undefined;
let fetchMock: ReturnType<typeof vi.fn>;

function response(data: unknown) {
  return { ok: true, json: async () => ({ success: true, data }) };
}

beforeEach(() => {
  const fakeWindow = Object.assign(new EventTarget(), { scrollTo: vi.fn() });
  vi.stubGlobal('window', fakeWindow);
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  mocks.push.mockClear();
});

afterEach(() => {
  if (tree) act(() => tree?.unmount());
  tree = undefined;
  vi.unstubAllGlobals();
});

function render() {
  act(() => {
    tree = create(React.createElement(WelcomeView));
  });
}

function text() {
  return JSON.stringify(tree?.toJSON());
}

/** Walks React children looking for a literal string, without serialising nodes. */
function containsText(children: unknown, needle: string): boolean {
  if (typeof children === 'string') return children.includes(needle);
  if (Array.isArray(children)) return children.some((child) => containsText(child, needle));
  return false;
}

describe('welcome screen', () => {
  it('renders the sticky header, the hero CTAs and the pillar overview', async () => {
    fetchMock.mockResolvedValue(response([]));
    render();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    const output = text();
    // A. header + hero
    expect(output).toContain('Enter Platform');
    expect(output).toContain('Launch Workspace');
    expect(output).toContain('Try Instant Demo');
    expect(output).toContain('The Unified Digital Ecosystem for Public Universities in Bangladesh');
    // B. four pillars
    expect(output).toContain('Academic & Career Hub');
    expect(output).toContain('Campus Life & Circular Economy');
    expect(output).toContain('Emergency & Health Network');
    expect(output).toContain('Hall & Campus Governance');
    // The first pillar's sub-modules are visible in the preview card.
    expect(output).toContain('Academic Archives');
    expect(output).toContain('Virus-scanned 50 MB document archive with course-wise search.');
  });

  it('loads the university registry from the shared API and renders the showcase', async () => {
    fetchMock.mockResolvedValue(response([
      {
        id: 'demo-univ-du',
        code: 'DU',
        name_en: 'University of Dhaka',
        name_bn: 'ঢাকা বিশ্ববিদ্যালয়',
        city: 'Dhaka',
        category: 'GENERAL',
        cover_image_url: null,
        logo_url: null,
        university_email_domains: [{ domain: 'du.ac.bd', is_primary: true }],
      },
    ]));
    render();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });

    expect(fetchMock).toHaveBeenCalledWith('/api/universities', expect.anything());
    const output = text();
    expect(output).toContain('Supported Public Universities');
    expect(output).toContain('University of Dhaka');
    expect(output).toContain('DU');
    expect(output).toContain('@du.ac.bd');
    // Category filter pills
    expect(output).toContain('General & Autonomous');
    expect(output).toContain('Engineering & Tech');
  });

  it('opens the one-click demo modal without leaving the welcome page', async () => {
    fetchMock.mockResolvedValue(response([]));
    render();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    const buttons = tree!.root.findAll(
      (node) => node.type === 'button' && containsText(node.props.children, 'Try Instant Demo')
    );
    expect(buttons.length).toBeGreaterThan(0);
    act(() => buttons[0].props.onClick());
    expect(tree!.root.findAllByProps({ 'data-testid': 'quick-demo' }).length).toBeGreaterThan(0);
  });
});

describe('welcome gate inside the app shell', () => {
  it('hides the dashboard chrome for a guest on the root entry', async () => {
    fetchMock.mockResolvedValue(response({ authenticated: false, demo: false, profile: null, roles: [] }));
    act(() => {
      tree = create(
        React.createElement(
          SessionProvider,
          null,
          React.createElement(
            AppShell,
            null,
            React.createElement('div', { 'data-testid': 'welcome-child' }, 'Welcome child')
          )
        )
      );
    });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });

    const output = text();
    // The welcome page is rendered ...
    expect(tree!.root.findAllByProps({ 'data-testid': 'welcome-child' }).length).toBeGreaterThan(0);
    // ... without the dashboard header, sidebar or bottom navigation.
    expect(output).not.toContain('Open main menu');
    expect(output).not.toContain('Join Your Campus');
    expect(output).not.toContain('All Modules');
  });

  it('keeps /, /welcome, /privacy and /terms chromeless during initial SSR before session resolves', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    for (const route of ['/', '/welcome', '/privacy', '/terms']) {
      mocks.pathname = route;
      act(() => {
        tree = create(
          React.createElement(
            SessionProvider,
            null,
            React.createElement(
              AppShell,
              null,
              React.createElement('div', { 'data-testid': `child-${route}` }, route)
            )
          )
        );
      });
      const output = text();
      expect(tree!.root.findAllByProps({ 'data-testid': `child-${route}` }).length).toBe(1);
      expect(output).not.toContain('Open main menu');
      expect(output).not.toContain('All Modules');
      act(() => tree?.unmount());
      tree = undefined;
    }
    mocks.pathname = '/';
  });

  it('renders WelcomeGate immediately with initialUniversities and no loading skeleton while unauthenticated', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    act(() => {
      tree = create(
        React.createElement(
          SessionProvider,
          null,
          React.createElement(WelcomeGate, {
            initialUniversities: [
              {
                id: 'demo-univ-du',
                code: 'DU',
                name_en: 'University of Dhaka',
                name_bn: 'ঢাকা বিশ্ববিদ্যালয়',
                city: 'Dhaka',
                category: 'GENERAL',
                logo_url: '/logos/du.png',
                cover_image_url: '/campuses/du.jpg',
                university_email_domains: [{ domain: 'du.ac.bd', is_primary: true }],
              },
            ],
          })
        )
      );
    });
    const output = text();
    expect(output).toContain('One verified super-app for every public university campus in Bangladesh');
    expect(output).toContain('University of Dhaka');
    expect(output).toContain('University of Dhaka logo');
    expect(output).not.toContain('"aria-busy":true');
    for (const meta of Object.values(MODULE_META)) {
      expect(output).toContain(meta.href);
    }
    expect(output).toContain('/archive');
    expect(output).toContain('/privacy');
    expect(output).toContain('/terms');
  });
});

describe('public legal pages (/privacy and /terms)', () => {
  it('renders PrivacyPage and TermsPage with exact data-stewardship and terms copy', () => {
    act(() => {
      tree = create(React.createElement(PrivacyPage));
    });
    const privacyOutput = text();
    expect(privacyOutput).toContain('Privacy & Data Retention');
    expect(privacyOutput).toContain(
      'Student ID card images uploaded for verification are scheduled for permanent deletion 7 days after upload and are purged after review.'
    );
    expect(privacyOutput).toContain(
      'Anonymous grievances store no student identity; they are tracked only through a keyed hash of your tracking secret.'
    );
    expect(privacyOutput).toContain('mailto:support@campus360bd.com');
    act(() => tree?.unmount());

    act(() => {
      tree = create(React.createElement(TermsPage));
    });
    const termsOutput = text();
    expect(termsOutput).toContain('Terms of Service');
    expect(termsOutput).toContain(
      'Accounts are for members of supported public universities and require a verified institutional email address.'
    );
    expect(termsOutput).toContain(
      'Use of your data is described in the Privacy & Data Retention summary.'
    );
  });
});
