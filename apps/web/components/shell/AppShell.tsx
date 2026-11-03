// apps/web/components/shell/AppShell.tsx
'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';

export interface ActiveSessionProfile {
  id: string;
  full_name: string;
  email: string;
  trust_level: 'UNVERIFIED' | 'EMAIL_VERIFIED' | 'ID_VERIFIED' | 'TRUSTED';
  universities?: { code: string; name_en: string; name_bn: string };
  departments?: { code: string; name_en: string; name_bn: string };
  halls?: { code: string; name_en: string; name_bn: string };
  roles?: string[];
}

const MODULES = [
  { href: '/', key: 'moduleFeed', icon: '🏠' },
  { href: '/archive', key: 'moduleArchive', icon: '📚' },
  { href: '/complaints', key: 'moduleComplaints', icon: '🛡️' },
  { href: '/events', key: 'moduleEvents', icon: '📅' },
  { href: '/events/map', key: 'moduleLiveMap', icon: '📍' },
  { href: '/reviews', key: 'moduleReviews', icon: '⭐' },
  { href: '/?module=marketplace', key: 'moduleMarketplace', icon: '🛍️' },
  { href: '/?module=blood', key: 'moduleBlood', icon: '🩸' },
  { href: '/?module=transport', key: 'moduleTransport', icon: '🚌' },
  { href: '/?module=dining', key: 'moduleDining', icon: '🍛' },
  { href: '/?module=library', key: 'moduleLibrary', icon: '📖' },
  { href: '/?module=tutoring', key: 'moduleTutoring', icon: '🎓' },
  { href: '/?module=housing', key: 'moduleHousing', icon: '🏢' },
  { href: '/?module=lostfound', key: 'moduleLostFound', icon: '🔍' },
  { href: '/?module=clubs', key: 'moduleClubs', icon: '🎭' },
];

export function AppShell({
  profile,
  children,
}: {
  profile: ActiveSessionProfile | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, setLocale, theme, toggleTheme, cmdKOpen, setCmdKOpen } = useAppStore();
  const [searchQuery, setSearchQuery] = React.useState('');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdKOpen(!cmdKOpen);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cmdKOpen, setCmdKOpen]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Top Sticky Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-extrabold text-sm shadow-sm">
              360
            </span>
            <div>
              <div className="font-bold text-base tracking-tight">{t(locale, 'brandTitle')}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {t(locale, 'brandSubtitle')}
              </div>
            </div>
          </Link>

          {/* Cmd+K Search Trigger */}
          <button
            type="button"
            onClick={() => setCmdKOpen(true)}
            className="hidden md:flex items-center justify-between w-96 px-3.5 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-xs text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
          >
            <span className="truncate">{t(locale, 'cmdKPlaceholder')}</span>
            <kbd className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 text-[11px] font-mono border border-slate-300 dark:border-slate-700">
              ⌘K
            </kbd>
          </button>

          {/* Language, Theme & Auth Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLocale(locale === 'en' ? 'bn' : 'en')}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"
              aria-label="Toggle language EN/বাংলা"
            >
              {locale === 'en' ? 'বাংলা' : 'EN'}
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs"
              aria-label="Toggle dark mode"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            {profile ? (
              <Link
                href="/onboarding"
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {profile.full_name}
              </Link>
            ) : (
              <Link
                href="/signup"
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 text-white"
              >
                {t(locale, 'signUp')}
              </Link>
            )}
          </div>
        </div>

        {/* Identity Bar (Locked to Verified University — No Public Role Switcher) */}
        {profile && (
          <div className="bg-emerald-950/40 border-t border-emerald-800/30 px-4 py-1.5">
            <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
                🏛️ {locale === 'bn' ? profile.universities?.name_bn : profile.universities?.name_en} (
                {profile.universities?.code})
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-medium">
                ✓ {profile.trust_level}
              </span>
              {profile.departments && (
                <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  🎓 {profile.departments.code}
                </span>
              )}
              {profile.halls && (
                <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  🏠 {profile.halls.name_en}
                </span>
              )}
              <span className="ml-auto px-2.5 py-0.5 rounded-full bg-slate-800 text-emerald-400 font-mono text-[11px]">
                ROLE: {(profile.roles && profile.roles[0]) || 'STUDENT'}
              </span>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Layout with Desktop Left Sidebar */}
      <div className="max-w-7xl w-full mx-auto flex-1 flex gap-6 px-4 py-6 pb-24 md:pb-8">
        <aside className="hidden md:block w-64 shrink-0">
          <nav className="sticky top-28 space-y-1 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            {MODULES.map((m) => {
              const active = pathname === m.href;
              return (
                <Link
                  key={m.href}
                  href={m.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                    active
                      ? 'bg-gradient-to-r from-emerald-500/15 to-teal-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span>{m.icon}</span>
                  <span>{t(locale, m.key)}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 min-w-0">{children}</main>
      </div>

      {/* Mobile Bottom Navigation Bar (5 Primary Tabs) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-around py-2">
        {[
          { href: '/', icon: '🏠', label: 'Feed' },
          { href: '/archive', icon: '📚', label: 'Archive' },
          { href: '/complaints', icon: '🛡️', label: 'Grievance' },
          { href: '/events/map', icon: '📍', label: 'Live Map' },
          { href: '/reviews', icon: '⭐', label: 'Reviews' },
        ].map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-col items-center text-xs ${
              pathname === tab.href ? 'text-emerald-500 font-semibold' : 'text-slate-500'
            }`}
          >
            <span className="text-base">{tab.icon}</span>
            <span>{tab.label}</span>
          </Link>
        ))}
      </nav>

      {/* ⌘K Command Palette Modal */}
      {cmdKOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-24 px-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
              <span>🔎</span>
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t(locale, 'cmdKPlaceholder')}
                className="w-full bg-transparent text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => setCmdKOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-200"
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
                    router.push(`/complaints/track?code=${encodeURIComponent(searchQuery.trim())}`);
                  }}
                  className="w-full text-left p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 font-medium"
                >
                  🛡️ Track Grievance Case: {searchQuery.toUpperCase()}
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
                📚 Search Academic Archive for &ldquo;{searchQuery || '...'}&rdquo;
              </button>
              <button
                type="button"
                onClick={() => {
                  setCmdKOpen(false);
                  router.push(`/events?q=${encodeURIComponent(searchQuery)}`);
                }}
                className="w-full text-left p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                📍 Search Live Campus Events for &ldquo;{searchQuery || '...'}&rdquo;
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
