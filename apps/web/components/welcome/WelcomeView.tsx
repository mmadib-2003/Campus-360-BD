'use client';

// apps/web/components/welcome/WelcomeView.tsx
// The one-page Welcome experience for unauthenticated visitors (Phase 2).
// Exactly three sections, nothing else:
//   A. Minimal sticky header + interactive hero (Launch Workspace / Instant Demo)
//   B. Interactive 4-pillar segmented overview (progressive disclosure)
//   C. Interactive supported-universities showcase (live /api/universities registry)
//
// The demo modal reuses the existing QuickDemoLogin component, so the
// one-click role-based demo flow is byte-for-byte the same as on /signin.
// "Explore Campus" pre-selects the university via setDemoSession (the same
// demo-session store the shell's campus switcher uses) and lands on /demo.

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useUi } from '@/lib/i18n-client';
import { ThemeToggle } from '@/components/ThemeToggle';
import { QuickDemoLogin } from '@/components/auth/QuickDemoLogin';
import { DEMO_UNIVERSITY_HALLS, getDemoUniversity, setDemoSession } from '@/lib/modules/demo-data';
import { StaggerGroup, StaggerItem, cardHover } from '@/components/motion/Stagger';
import { PILLARS } from './pillars';

interface RegistryUniversity {
  id: string;
  code: string;
  name_en: string;
  name_bn: string;
  city?: string;
  category?: string;
  logo_url?: string | null;
  cover_image_url?: string | null;
  university_email_domains?: Array<{ domain: string; is_primary?: boolean }>;
}

const CATEGORY_FILTERS: Array<{ value: string; key: string }> = [
  { value: 'ALL', key: 'All' },
  { value: 'GENERAL', key: 'General & Autonomous' },
  { value: 'ENGINEERING', key: 'Engineering & Tech' },
  { value: 'SCIENCE_AND_TECH', key: 'Science & Tech' },
  { value: 'AGRICULTURAL', key: 'Agricultural' },
];

/** Hall count from the same registry /api/halls serves (DEMO_UNIVERSITY_HALLS). */
function hallCountFor(code: string): number {
  return DEMO_UNIVERSITY_HALLS.filter((hall) => hall.universityCode === code).length;
}

function hideOnBrokenImage(event: React.SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.style.visibility = 'hidden';
}

function WelcomeHeader() {
  const { t, toggleLocale, locale } = useUi();
  return (
    <header className="sticky top-0 inset-x-0 z-40 w-full bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5 min-w-0">
          <img
            src="/logos/campus360-logo.jpg"
            alt="Campus360 BD"
            className="h-9 w-9 rounded-full object-cover bg-white p-0.5 shadow-sm shrink-0"
          />
          <span className="font-bold text-base tracking-tight truncate">{t('Campus360 BD')}</span>
        </Link>
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          <button
            type="button"
            onClick={toggleLocale}
            className="inline-flex h-9 min-h-[36px] items-center px-2.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"
            aria-label={locale === 'en' ? 'বাংলা' : 'English'}
          >
            {locale === 'en' ? 'বাংলা' : 'EN'}
          </button>
          <Link
            href="/signin"
            className="inline-flex min-h-[36px] items-center px-4 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:opacity-90 transition"
          >
            {t('Enter Platform')}
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero({ onDemo }: { onDemo: () => void }) {
  const { t } = useUi();
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden p-6 sm:p-10 rounded-2xl bg-gradient-to-br from-emerald-900/60 via-slate-900 to-teal-950 border border-emerald-500/30 shadow-xl text-center"
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-emerald-500/25 blur-3xl"
        animate={{ scale: [1, 1.18, 1], opacity: [0.45, 0.75, 0.45] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-teal-400/20 blur-3xl"
        animate={{ scale: [1, 1.12, 1], opacity: [0.35, 0.65, 0.35] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />
      <div className="relative max-w-2xl mx-auto">
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300">
          🇧🇩 {t('The Unified Digital Ecosystem for Public Universities in Bangladesh')}
        </span>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mt-5 leading-tight">
          {t('One verified super-app for every public university campus in Bangladesh')}
        </h1>
        <p className="text-sm sm:text-base text-slate-300 mt-3 max-w-xl mx-auto">
          {t('Study, trade, get help and be heard — verified by your institutional email, across every public university in the country.')}
        </p>
        <div className="flex flex-col sm:flex-row sm:flex-wrap justify-center gap-3 mt-7">
          <Link
            href="/signin"
            className="min-h-[48px] inline-flex items-center justify-center px-6 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow transition hover:scale-[1.03] hover:shadow-emerald-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          >
            {t('Launch Workspace')} →
          </Link>
          <button
            type="button"
            onClick={onDemo}
            className="min-h-[48px] inline-flex items-center justify-center px-6 py-3 rounded-xl font-semibold text-sm bg-white/10 hover:bg-white/15 text-white border border-white/20 transition hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          >
            ⚡ {t('Try Instant Demo')}
          </button>
        </div>
      </div>
    </motion.section>
  );
}

function PillarOverview() {
  const { locale, t } = useUi();
  const [activeId, setActiveId] = React.useState(PILLARS[0].id);
  const active = PILLARS.find((pillar) => pillar.id === activeId) ?? PILLARS[0];

  return (
    <section className="space-y-5">
      <div className="text-center max-w-xl mx-auto">
        <h2 className="text-xl sm:text-2xl font-extrabold">{t('Explore Campus360 BD')}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t('Four pillars, every module — tap a pillar to see what is inside.')}
        </p>
      </div>

      <div role="tablist" aria-label={t('Explore Campus360 BD')} className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {PILLARS.map((pillar) => {
          const selected = pillar.id === activeId;
          return (
            <button
              key={pillar.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onMouseEnter={() => setActiveId(pillar.id)}
              onFocus={() => setActiveId(pillar.id)}
              onClick={() => setActiveId(pillar.id)}
              className={`min-h-[56px] p-3 sm:p-4 rounded-2xl border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                selected
                  ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
                  : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-emerald-500/40'
              }`}
            >
              <span className="text-xl" aria-hidden>{pillar.icon}</span>
              <span className="block mt-1 text-xs sm:text-sm font-bold leading-snug">
                {locale === 'bn' ? pillar.titleBn : t(pillar.title)}
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={active.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm"
        >
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {locale === 'bn' ? active.taglineBn : t(active.tagline)}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
            {active.items.map((item) => (
              <Link
                key={`${item.href}-${item.title}`}
                href={item.href}
                className="group p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              >
                <div className="flex items-center gap-2.5">
                  <span className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-base shrink-0 transition-transform duration-200 group-hover:scale-110" aria-hidden>
                    {item.icon}
                  </span>
                  <span className="font-semibold text-sm group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">
                    {locale === 'bn' ? item.titleBn : t(item.title)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                  {locale === 'bn' ? item.blurbBn : t(item.blurb)}
                </p>
              </Link>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

function UniversityShowcase() {
  const { locale, t } = useUi();
  const router = useRouter();
  const [universities, setUniversities] = React.useState<RegistryUniversity[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [category, setCategory] = React.useState('ALL');
  const [query, setQuery] = React.useState('');
  const [selectedCode, setSelectedCode] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    fetch('/api/universities', { signal: controller.signal })
      .then((response) => response.json())
      .then((payload) => {
        if (!cancelled && payload?.success && Array.isArray(payload.data)) {
          setUniversities(payload.data as RegistryUniversity[]);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        clearTimeout(timeout);
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return universities.filter((university) => {
      if (category !== 'ALL' && university.category !== category) return false;
      if (!needle) return true;
      return [university.name_en, university.name_bn, university.code, university.city ?? '']
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [universities, category, query]);

  const selected = universities.find((university) => university.code === selectedCode) ?? null;

  function explore(university: RegistryUniversity) {
    // Pre-select into the demo flow (same store the shell campus switcher
    // uses), then land on the one-click demo roster for that campus. The
    // registry id is the demo id in demo mode; the code is the fallback for
    // live Supabase rows (UUID ids), so both modes preselect correctly.
    const demo = getDemoUniversity(university.id) ?? getDemoUniversity(university.code);
    if (demo) setDemoSession({ universityId: demo.id });
    router.push('/demo');
  }

  return (
    <section className="space-y-5">
      <div className="text-center max-w-xl mx-auto">
        <h2 className="text-xl sm:text-2xl font-extrabold">{t('Supported Public Universities')}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t('Tap a university to see its halls and verified email domain.')}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap justify-center gap-2">
          {CATEGORY_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setCategory(filter.value)}
              aria-pressed={category === filter.value}
              className={`min-h-[36px] px-3.5 rounded-full text-xs font-semibold border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                category === filter.value
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-emerald-500/40'
              }`}
            >
              {t(filter.key)}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('Search universities by name, code or city…')}
          aria-label={t('Search universities by name, code or city…')}
          className="w-full max-w-md mx-auto min-h-[44px] px-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-sm outline-none focus:border-emerald-500/60"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-36 rounded-2xl bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center space-y-1">
          <div className="text-2xl" aria-hidden>🏛️</div>
          <p className="font-semibold text-sm">{t('No university found')}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('Try a different name, code or category.')}</p>
        </div>
      ) : (
        <StaggerGroup className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((university) => {
            const isSelected = university.code === selectedCode;
            const domains = university.university_email_domains ?? [];
            return (
              <StaggerItem key={university.id} className="h-full">
                <motion.button
                  type="button"
                  {...cardHover}
                  onClick={() => setSelectedCode(isSelected ? null : university.code)}
                  aria-pressed={isSelected}
                  className={`w-full h-full text-left overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                    isSelected ? 'border-emerald-500/70 ring-1 ring-emerald-500/40' : 'border-slate-200/80 dark:border-slate-800'
                  }`}
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-emerald-900/70 via-slate-900 to-teal-950">
                    {university.cover_image_url ? (
                      <img
                        src={university.cover_image_url}
                        alt={`${university.name_en} campus`}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        onError={hideOnBrokenImage}
                        className="aspect-video w-full object-cover"
                      />
                    ) : null}
                    <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-slate-950/85 to-transparent" />
                    <div className="absolute bottom-2 left-3 right-3 flex items-center gap-2">
                      {university.logo_url ? (
                        <img
                          src={university.logo_url}
                          alt={`${university.name_en} logo`}
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          width={28}
                          height={28}
                          onError={hideOnBrokenImage}
                          className="h-7 w-7 rounded-lg bg-white/90 object-contain p-0.5 ring-1 ring-white/25"
                        />
                      ) : null}
                      <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-200 font-bold text-xs">
                        {university.code}
                      </span>
                      {university.city ? (
                        <span className="ml-auto text-[11px] text-slate-300">{university.city}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="p-4 space-y-1.5">
                    <div className="font-semibold text-sm">{locale === 'bn' ? university.name_bn : university.name_en}</div>
                    <div className="text-xs text-slate-400">{locale === 'bn' ? university.name_en : university.name_bn}</div>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[11px] text-slate-400 font-mono truncate">
                        {domains.map((domain) => `@${domain.domain}`).join(', ')}
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                        ✓ {t('Verified')}
                      </span>
                    </div>
                  </div>
                </motion.button>
              </StaggerItem>
            );
          })}
        </StaggerGroup>
      )}

      <AnimatePresence>
        {selected && (
          <motion.div
            key={selected.code}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-500/40 shadow-sm"
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                    {selected.code}
                  </span>
                  <span className="font-bold text-base">{locale === 'bn' ? selected.name_bn : selected.name_en}</span>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>🏢 {hallCountFor(selected.code)} {t('Residential halls')}</span>
                  <span className="font-mono">
                    ✓ {t('Verified email domain')}:{' '}
                    {(selected.university_email_domains ?? []).map((domain) => `name@${domain.domain}`).join(' · ') || '—'}
                  </span>
                  {selected.city ? <span>📍 {selected.city}</span> : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => explore(selected)}
                className="min-h-[44px] shrink-0 inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:opacity-90 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              >
                {t('Explore {code} Campus', { code: selected.code })} →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export function WelcomeView() {
  const { t } = useUi();
  const [demoOpen, setDemoOpen] = React.useState(false);

  React.useEffect(() => {
    if (!demoOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDemoOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [demoOpen]);

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <WelcomeHeader />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-10 sm:space-y-14">
        <Hero onDemo={() => setDemoOpen(true)} />
        <PillarOverview />
        <UniversityShowcase />
      </main>
      <footer className="border-t border-slate-200/80 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-semibold">{t('Campus360 BD')} — {t('Verified Multi-University Super-App')}</span>
          <span className="flex items-center gap-4">
            <Link href="/signin" className="hover:text-emerald-500">{t('Sign In')}</Link>
            <button type="button" onClick={() => setDemoOpen(true)} className="hover:text-emerald-500">
              ⚡ {t('Try Instant Demo')}
            </button>
            <Link href="/signup" className="hover:text-emerald-500">{t('Join Your Campus')}</Link>
          </span>
        </div>
      </footer>

      {demoOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto"
          onClick={() => setDemoOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={t('Try Instant Demo')}
        >
          <div
            className="w-full max-w-lg my-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-end mb-2">
              <button
                type="button"
                onClick={() => setDemoOpen(false)}
                aria-label={t('Close menu')}
                className="min-h-[44px] min-w-[44px] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-semibold"
              >
                ✕
              </button>
            </div>
            <QuickDemoLogin />
          </div>
        </div>
      )}
    </div>
  );
}
