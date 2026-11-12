'use client';

import React from 'react';
import { notifyAuthChanged } from '@/lib/auth-events';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUi } from '@/lib/i18n-client';
import { useSession } from '@/lib/modules/client';
import {
  DEMO_UNIVERSITIES,
  getDemoSession,
  setDemoSession,
  setDemoSignedOut,
  subscribeDemoSession,
  type DemoRole,
} from '@/lib/modules/demo-data';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { ThemeToggle } from '@/components/ThemeToggle';
import { asArray, asRow, asText } from '@/lib/render-safe';
import { CampusScopeToggle } from '@/components/CampusScopeToggle';
import { useCampusScope } from '@/lib/use-campus-scope';
import { withCampusScope } from '@/lib/campus-scope';

const MODULES = [
  { href: '/', key: 'moduleFeed', icon: '🏠' },
  { href: '/marketplace', key: 'moduleMarketplace2', icon: '🛍️' },
  { href: '/skills', key: 'moduleSkills', icon: '🎓' },
  { href: '/civic', key: 'moduleCivic', icon: '🛡️' },
  { href: '/events', key: 'moduleEvents', icon: '📅' },
  { href: '/events/map', key: 'moduleLiveMap', icon: '📍' },
  { href: '/health', key: 'moduleHealth', icon: '🩸' },
  { href: '/archive', key: 'moduleArchive', icon: '📚' },
  { href: '/mentorship', key: 'moduleMentorship', icon: '📖' },
  { href: '/housing', key: 'moduleHousing2', icon: '🏢' },
  { href: '/careers', key: 'moduleCareers', icon: '💼' },
  { href: '/dining', key: 'moduleDining2', icon: '🍛' },
  { href: '/lost-found', key: 'moduleLostFound2', icon: '🔍' },
  { href: '/sports', key: 'moduleSports', icon: '🏆' },
  { href: '/trust', key: 'moduleTrust', icon: '✅' },
  { href: '/reviews', key: 'moduleReviews', icon: '⭐' },
  { href: '/admin/console', key: 'moduleAdmin', icon: '🏛️' },
];

const ROLE_OPTIONS: Array<{ value: DemoRole; key: string }> = [
  { value: 'student', key: 'Student' },
  { value: 'faculty', key: 'Faculty / Staff' },
  { value: 'alumni', key: 'Alumni' },
  { value: 'admin', key: 'Platform Admin' },
  { value: 'governance', key: 'University Governance' },
];

export function AppShell({ children }: { profile?: unknown; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { scope } = useCampusScope();
  const { t, toggleLocale, locale } = useUi();
  const session = useSession();
  const profile = session.profile as
    | {
        full_name?: string;
        program_session?: string | null;
        universities?: { code: string; name_en: string; name_bn: string };
        departments?: { code: string };
        halls?: { name?: string; name_en?: string };
        trust_level?: string;
      }
    | null;
  const [searchQuery, setSearchQuery] = React.useState('');
  const [cmdKOpen, setCmdKOpen] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [demoSession, setDemoSessionState] = React.useState(() => getDemoSession());

  React.useEffect(() => subscribeDemoSession(setDemoSessionState), []);

  // Any navigation (drawer link, bottom tab, browser back) closes the drawer.
  React.useEffect(() => {
    setMobileNavOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  // Lock body scroll while the slide-over drawer is open so the page behind
  // it does not scroll on touch. Guarded for non-DOM renderers (tests).
  React.useEffect(() => {
    if (!mobileNavOpen || typeof document === 'undefined') return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileNavOpen]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCmdKOpen((open) => !open);
      } else if (event.key === 'Escape') {
        setMobileNavOpen(false);
        setCmdKOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function switchCampus(universityId: string) {
    setDemoSession({ universityId });
    setDemoSessionState(getDemoSession());
    router.refresh();
  }

  function switchRole(role: DemoRole) {
    setDemoSession({ role });
    setDemoSessionState(getDemoSession());
    router.refresh();
  }

  async function signOut() {
    try {
      await fetch('/api/auth/sign-out', { method: 'POST' });
    } catch {
      /* ignore */
    }
    setDemoSignedOut(true);
    notifyAuthChanged();
    setMobileNavOpen(false);
    router.push('/signin');
    router.refresh();
  }

  const trustLabel = profile?.trust_level
    ? profile.trust_level === 'ID_VERIFIED' || profile.trust_level === 'TRUSTED'
      ? t('ID verified')
      : profile.trust_level === 'EMAIL_VERIFIED'
        ? t('Email verified')
        : t('Unverified')
    : '';

  const univ = asRow(profile?.universities);
  const dept = asRow(profile?.departments);
  const hall = asRow(profile?.halls);
  const roles = asArray(session.roles);
  const dashboardHref = session.isAdmin ? '/admin/console' : '/feed';
  const roleLabel = session.isAdmin ? t('Admin')
    : roles.includes('FACULTY') ? t('Faculty / Staff')
    : roles.includes('ALUMNI') ? t('Alumni')
    : session.isGovernance ? t('University Governance')
    : roles.includes('STUDENT') ? t('Student') : t('Account');
  const displayName = profile?.full_name?.trim() || session.email || t('Your account');
  const scopePaths = ['/marketplace', '/skills', '/civic', '/complaints', '/events', '/health', '/archive', '/mentorship', '/housing', '/careers', '/dining', '/lost-found', '/sports', '/reviews'];
  // The map renders its own toggle inside the page.
  const showScope = session.authenticated && pathname !== '/events/map' && scopePaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const scopedHref = (href: string) => withCampusScope(href, scope);
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-screen w-full max-w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <header className="campus360-top-navbar sticky top-0 inset-x-0 z-40 w-full shrink-0 !mt-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 py-2.5 sm:px-6 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Hamburger: the only way into the module list below lg. */}
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label={t('Open main menu')}
              aria-expanded={mobileNavOpen}
              className="lg:hidden inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-base shrink-0"
            >
              ☰
            </button>
            <Link href="/" className="flex items-center gap-2.5 min-w-0">
              {/* Official Campus360 BD mark (user-supplied brand asset, see
                  docs/IMAGE_ATTRIBUTION.md). */}
              <img
                src="/logos/campus360-logo.jpg"
                alt="Campus360 BD"
                className="h-10 w-10 rounded-full object-cover bg-white p-0.5 shadow-sm shrink-0"
              />
              {/* Wordmark yields to the controls on the narrowest phones. */}
              <div className="hidden sm:block min-w-0">
                <div className="font-bold text-base tracking-tight truncate">{t('Campus360 BD')}</div>
                <div className="hidden md:block text-xs text-slate-500 dark:text-slate-400 truncate">
                  {t('Verified Multi-University Super-App')}
                </div>
              </div>
            </Link>
          </div>

          {/* Desktop command palette trigger. */}
          <button
            type="button"
            onClick={() => setCmdKOpen(true)}
            className="hidden lg:flex items-center justify-between w-96 max-w-md px-3.5 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-xs text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
          >
            <span className="truncate">{t('Search complaints (JU-CASE-...), courses (CSE-301), events, universities...')}</span>
            <kbd className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 text-[11px] font-mono border border-slate-300 dark:border-slate-700 shrink-0 ml-2">
              ⌘K
            </kbd>
          </button>

          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
            {/* Compact search: opens the same palette as a full-width modal. */}
            <button
              type="button"
              onClick={() => setCmdKOpen(true)}
              aria-label={t('Search')}
              className="lg:hidden inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-base"
            >
              🔍
            </button>
            {/* Theme toggle stays in the bar from 375px up; on the narrowest
                320px phones it lives in the drawer so nothing wraps. */}
            <span className="hidden min-[375px]:inline-flex">
              <ThemeToggle />
            </span>
            <button
              type="button"
              onClick={toggleLocale}
              className="inline-flex h-11 min-h-[44px] items-center px-2.5 sm:px-3 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"
              aria-label={locale === 'en' ? 'বাংলা' : 'English'}
            >
              {locale === 'en' ? 'বাংলা' : 'EN'}
            </button>
            <NotificationBell />
            {session.loading ? (
              <div role="status" aria-label={t('Loading account')} className="h-11 w-20 sm:w-28 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
            ) : session.authenticated ? (
              <>
                <Link
                  href={dashboardHref}
                  aria-label={`${displayName} — ${roleLabel}`}
                  className="max-w-[88px] min-[375px]:max-w-[110px] sm:max-w-[180px] min-w-0 min-h-[44px] flex flex-col justify-center rounded-xl px-2 sm:px-2.5 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white shrink"
                >
                  <span className="block truncate font-semibold">{displayName}</span>
                  <span className="block truncate text-[10px] text-emerald-100">{roleLabel}</span>
                </Link>
                <button
                  type="button"
                  onClick={signOut}
                  className="hidden sm:inline-flex min-h-[44px] items-center px-2.5 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {t('Sign Out')}
                </button>
              </>
            ) : session.error ? (
              <button type="button" onClick={session.refresh} className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700">
                {t('Retry account')}
              </button>
            ) : (
              <>
                <Link
                  href="/signin"
                  className="inline-flex min-h-[44px] min-w-0 items-center px-2.5 sm:px-3 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap overflow-hidden"
                >
                  {t('Sign In')}
                </Link>
                <Link
                  href="/signup"
                  className="hidden sm:inline-flex min-h-[44px] items-center px-3.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 text-white whitespace-nowrap"
                >
                  {t('Join Your Campus')}
                </Link>
              </>
            )}
          </div>
        </div>

        {session.authenticated && profile && (
          <div className="bg-slate-900 dark:bg-emerald-950/95 border-t border-slate-800 dark:border-emerald-800/40 px-3 sm:px-6 py-1.5 text-slate-100">
            <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
                🏛️ {asText(locale === 'bn' ? univ.name_bn : univ.name_en, 'CAMPUS')} ({asText(univ.code, '—')})
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-medium">✓ {trustLabel}</span>
              {asText(dept.code) && (
                <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-200">🎓 {asText(dept.code)}</span>
              )}
              {asText(profile.program_session) && (
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 font-medium">
                  📅 {asText(profile.program_session)}
                </span>
              )}
              {(asText(hall.name) || asText(hall.name_en)) && (
                <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-200">
                  🏠 {asText(hall.name) || asText(hall.name_en)}
                </span>
              )}
              <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-emerald-400 font-mono text-[11px]">
                ROLE: {asText(roles[0], 'STUDENT')}
              </span>

              {session.demo && (
                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wide text-emerald-300/80">{t('Campus switcher (preview)')}</span>
                  <select
                    aria-label={t('Switch campus')}
                    value={demoSession.universityId}
                    onChange={(event) => switchCampus(event.target.value)}
                    className="max-w-[46vw] sm:max-w-none px-2 py-1 rounded-lg bg-slate-950 text-emerald-300 border border-emerald-700/50 text-[11px]"
                  >
                    {DEMO_UNIVERSITIES.map((university) => (
                      <option key={university.id} value={university.id}>
                        {university.code} — {locale === 'bn' ? university.name_bn : university.name_en}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={t('Your role')}
                    value={demoSession.role}
                    onChange={(event) => switchRole(event.target.value as DemoRole)}
                    className="px-2 py-1 rounded-lg bg-slate-950 text-emerald-300 border border-emerald-700/50 text-[11px]"
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.key)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Slide-over navigation drawer (<lg). Backdrop tap, Escape and any
          route change all close it; body scroll is locked while it is open. */}
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={t('Navigation menu')}>
          <div
            className="campus360-backdrop absolute inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <nav
            aria-label="Mobile navigation"
            className="campus360-drawer fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-slate-950 border-r border-slate-800 overflow-y-auto overscroll-contain p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
          >
            <div className="flex items-center justify-between gap-2 mb-4">
              <Link href="/" className="flex items-center gap-2 min-w-0" onClick={() => setMobileNavOpen(false)}>
                <img
                  src="/logos/campus360-logo.jpg"
                  alt="Campus360 BD"
                  className="h-9 w-9 rounded-full object-cover bg-white p-0.5 shrink-0"
                />
                <span className="font-bold text-sm text-white truncate">{t('Campus360 BD')}</span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label={t('Close menu')}
                className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300 shrink-0"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1">
              {MODULES.map((module) => {
                const active = isActive(module.href);
                return (
                  <Link
                    key={module.href}
                    href={scopedHref(module.href)}
                    onClick={() => setMobileNavOpen(false)}
                    className={`flex items-center gap-3 min-h-[44px] px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                      active
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    <span aria-hidden>{module.icon}</span>
                    <span className="min-w-0 truncate">{t(module.key)}</span>
                  </Link>
                );
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
              {/* The theme toggle relocates here on the narrowest phones. */}
              <div className="flex min-[375px]:hidden items-center justify-between gap-2 px-1">
                <span className="text-xs text-slate-400">{t('Theme')}</span>
                <ThemeToggle />
              </div>
              {session.authenticated ? (
                <button
                  type="button"
                  onClick={signOut}
                  className="sm:hidden w-full min-h-[44px] px-3 rounded-xl text-sm font-semibold border border-slate-700 text-slate-200 hover:bg-slate-800"
                >
                  {t('Sign Out')}
                </button>
              ) : (
                <Link
                  href="/signup"
                  onClick={() => setMobileNavOpen(false)}
                  className="flex w-full min-h-[44px] items-center justify-center px-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 text-white"
                >
                  {t('Join Your Campus')}
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}

      <div className="relative z-0 max-w-7xl w-full mx-auto flex-1 flex items-start gap-6 px-3 sm:px-6 pt-6">
        {/* Persistent sidebar only on lg+; smaller screens use the drawer. */}
        <aside className="hidden lg:flex lg:w-64 lg:shrink-0">
          <nav className="sticky top-28 w-full max-h-[calc(100vh-8rem)] overflow-y-auto space-y-1 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            {MODULES.map((module) => {
              const active = isActive(module.href);
              return (
                <Link
                  key={module.href}
                  href={scopedHref(module.href)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                    active
                      ? 'bg-gradient-to-r from-emerald-500/15 to-teal-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span>{module.icon}</span>
                  <span>{t(module.key)}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* pb-20 keeps content clear of the fixed bottom quick-nav on mobile. */}
        <main className="flex-1 min-w-0 max-w-full pb-20 lg:pb-8">{showScope && <CampusScopeToggle universityCode={session.profile?.universities?.code} />}{children}</main>
      </div>

      {/* Mobile bottom quick-nav: five thumb-reachable tabs, safe-area aware. */}
      <nav
        aria-label="Quick navigation"
        className="fixed bottom-0 inset-x-0 z-40 flex lg:hidden bg-slate-950/95 backdrop-blur border-t border-slate-800 pb-[env(safe-area-inset-bottom)]"
      >
        {[
          { href: '/', icon: '🏠', label: t('Home') },
          { href: '/feed', icon: '📰', label: t('Feed') },
          { href: '/marketplace', icon: '🛍️', label: t('Market') },
          { href: '/events', icon: '📅', label: t('Events') },
        ].map((tab) => (
          <Link
            key={tab.href}
            href={scopedHref(tab.href)}
            aria-current={isActive(tab.href) ? 'page' : undefined}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-1.5 text-[10px] font-medium ${
              isActive(tab.href) ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            <span className="text-base leading-none" aria-hidden>{tab.icon}</span>
            <span className="max-w-[68px] truncate">{tab.label}</span>
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          aria-label={t('More')}
          aria-expanded={mobileNavOpen}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-1.5 text-[10px] font-medium text-slate-400"
        >
          <span className="text-base leading-none" aria-hidden>☰</span>
          <span>{t('More')}</span>
        </button>
      </nav>

      {cmdKOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-20 sm:pt-24 px-3 sm:px-4"
          onClick={() => setCmdKOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 sm:gap-3">
              <span>🔎</span>
              <input
                autoFocus
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t('Search complaints (JU-CASE-...), courses (CSE-301), events, universities...')}
                className="w-full min-w-0 min-h-[44px] bg-transparent text-base sm:text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => setCmdKOpen(false)}
                aria-label={t('Close menu')}
                className="min-h-[44px] min-w-[44px] rounded-xl text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ESC
              </button>
            </div>
            <div className="p-3 space-y-2 text-xs">
              {searchQuery.toUpperCase().includes('-CASE-') && (
                <button
                  type="button"
                  onClick={() => {
                    setCmdKOpen(false);
                    router.push(`/track/${encodeURIComponent(searchQuery.trim().toUpperCase())}`);
                  }}
                  className="w-full min-h-[44px] text-left p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 font-medium"
                >
                  🛡️ {t('Track Grievance Case')}: {searchQuery.toUpperCase()}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setCmdKOpen(false);
                  router.push(`/archive?q=${encodeURIComponent(searchQuery)}`);
                }}
                className="w-full min-h-[44px] text-left p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                📚 {t('Search Academic Archive for')} “{searchQuery || '...'}”
              </button>
              <button
                type="button"
                onClick={() => {
                  setCmdKOpen(false);
                  router.push(`/events?q=${encodeURIComponent(searchQuery)}`);
                }}
                className="w-full min-h-[44px] text-left p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                📍 {t('Search Live Campus Events for')} “{searchQuery || '...'}”
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
