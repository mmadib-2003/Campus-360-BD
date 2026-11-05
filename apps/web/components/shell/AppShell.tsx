'use client';

import React from 'react';
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
  const { t, toggleLocale, locale } = useUi();
  const session = useSession();
  const profile = session.profile as
    | {
        full_name?: string;
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

  React.useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCmdKOpen((open) => !open);
      } else if (event.key === 'Escape') {
        setMobileNavOpen(false);
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('campus360:auth-changed'));
    }
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

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <header className="campus360-top-navbar sticky top-0 inset-x-0 z-50 w-full shrink-0 !mt-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen((open) => !open)}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileNavOpen}
              className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-sm shrink-0"
            >
              {mobileNavOpen ? '✕' : '☰'}
            </button>
            <Link href="/" className="flex items-center gap-2.5 min-w-0">
              <span className="h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-extrabold text-sm shadow-sm shrink-0">
                360
              </span>
              <div className="min-w-0">
                <div className="font-bold text-base tracking-tight truncate">{t('Campus360 BD')}</div>
                <div className="hidden sm:block text-xs text-slate-500 dark:text-slate-400 truncate">
                  {t('Verified Multi-University Super-App')}
                </div>
              </div>
            </Link>
          </div>

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

          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <button
              type="button"
              onClick={toggleLocale}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"
              aria-label={locale === 'en' ? 'বাংলা' : 'English'}
            >
              {locale === 'en' ? 'বাংলা' : 'EN'}
            </button>
            <NotificationBell />
            {profile ? (
              <>
                <Link
                  href={dashboardHref}
                  className="hidden sm:inline-block max-w-[160px] truncate px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {profile.full_name}
                </Link>
                <button
                  type="button"
                  onClick={signOut}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {t('Sign Out')}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/signin"
                  className="hidden sm:inline-block px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {t('Sign In')}
                </Link>
                <Link
                  href="/signup"
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 text-white whitespace-nowrap"
                >
                  {t('Join Your Campus')}
                </Link>
              </>
            )}
          </div>
        </div>

        {profile && (
          <div className="bg-slate-900 dark:bg-emerald-950/95 border-t border-slate-800 dark:border-emerald-800/40 px-4 py-1.5 text-slate-100">
            <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
                🏛️ {asText(locale === 'bn' ? univ.name_bn : univ.name_en, 'CAMPUS')} ({asText(univ.code, '—')})
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-medium">✓ {trustLabel}</span>
              {asText(dept.code) && (
                <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-200">🎓 {asText(dept.code)}</span>
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
                    className="px-2 py-1 rounded-lg bg-slate-950 text-emerald-300 border border-emerald-700/50 text-[11px]"
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

        {mobileNavOpen && (
          <nav
            aria-label="Mobile navigation"
            className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 max-h-[70vh] overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1"
          >
            {MODULES.map((module) => {
              const active =
                module.href === '/'
                  ? pathname === '/'
                  : pathname === module.href || pathname.startsWith(`${module.href}/`);
              return (
                <Link
                  key={module.href}
                  href={module.href}
                  onClick={() => setMobileNavOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition ${
                    active
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span>{module.icon}</span>
                  <span>{t(module.key)}</span>
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      <div className="relative z-0 max-w-7xl w-full mx-auto flex-1 flex items-start gap-6 px-4 pt-6 pb-24 md:pb-8">
        <aside className="hidden md:block w-64 shrink-0">
          <nav className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto space-y-1 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            {MODULES.map((module) => {
              const active =
                module.href === '/'
                  ? pathname === '/'
                  : pathname === module.href || pathname.startsWith(`${module.href}/`);
              return (
                <Link
                  key={module.href}
                  href={module.href}
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

        <main className="flex-1 min-w-0">{children}</main>
      </div>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex justify-around py-2">
        {[
          { href: '/', icon: '🏠', label: t('Campus Feed') },
          { href: '/marketplace', icon: '🛍️', label: t('Marketplace') },
          { href: '/skills', icon: '🎓', label: t('moduleSkills') },
          { href: '/mentorship', icon: '📖', label: t('moduleMentorship') },
          { href: '/health', icon: '🩸', label: t('Health') },
        ].map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-col items-center text-[10px] ${
              pathname === tab.href ? 'text-emerald-500 font-semibold' : 'text-slate-500'
            }`}
          >
            <span className="text-base">{tab.icon}</span>
            <span className="max-w-[68px] truncate">{tab.label}</span>
          </Link>
        ))}
      </nav>

      {cmdKOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-24 px-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
              <span>🔎</span>
              <input
                autoFocus
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t('Search complaints (JU-CASE-...), courses (CSE-301), events, universities...')}
                className="w-full bg-transparent text-sm outline-none"
              />
              <button type="button" onClick={() => setCmdKOpen(false)} className="text-xs text-slate-400 hover:text-slate-200">
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
                  className="w-full text-left p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 font-medium"
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
                className="w-full text-left p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                📚 {t('Search Academic Archive for')} “{searchQuery || '...'}”
              </button>
              <button
                type="button"
                onClick={() => {
                  setCmdKOpen(false);
                  router.push(`/events?q=${encodeURIComponent(searchQuery)}`);
                }}
                className="w-full text-left p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
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
