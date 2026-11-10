'use client';

import React from 'react';
import Link from 'next/link';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useUi } from '@/lib/i18n-client';
import { useSession } from '@/lib/modules/session';
import { DEMO_UNIVERSITIES } from '@/lib/modules/demo-data';
import { MODULE_META } from '@/lib/modules/labels';
import { markWelcomeSeen, SUPPORT_EMAIL } from '@/lib/welcome';

/**
 * The one-page welcome screen (/welcome).
 *
 * University data: the page asks the same registry endpoint the signup
 * combobox uses (`/api/universities` -> Supabase `universities`, active rows
 * only; the 13 launch campuses are fixed by migration 0022). Until that
 * answers -- or if it fails -- it renders `DEMO_UNIVERSITIES`, the very
 * constant that backs the endpoint's no-database fallback. So the list is
 * never invented here and never empty.
 */

interface WelcomeUniversity {
  id: string;
  code: string;
  name_en: string;
  name_bn: string;
  city?: string | null;
  domain?: string | null;
}

interface RegistryRow {
  id?: unknown;
  code?: unknown;
  name_en?: unknown;
  name_bn?: unknown;
  city?: unknown;
  university_email_domains?: Array<{ domain?: unknown; is_primary?: unknown }> | null;
}

const FALLBACK_UNIVERSITIES: WelcomeUniversity[] = DEMO_UNIVERSITIES.map((university) => ({
  id: university.id,
  code: university.code,
  name_en: university.name_en,
  name_bn: university.name_bn,
  city: university.city,
  domain: university.domains[0] ?? null,
}));

function normalizeRegistry(rows: unknown): WelcomeUniversity[] {
  if (!Array.isArray(rows)) return [];
  const out: WelcomeUniversity[] = [];
  for (const raw of rows as RegistryRow[]) {
    if (!raw || typeof raw.code !== 'string' || typeof raw.name_en !== 'string') continue;
    const domains = Array.isArray(raw.university_email_domains) ? raw.university_email_domains : [];
    const primary = domains.find((d) => d?.is_primary) ?? domains[0];
    out.push({
      id: typeof raw.id === 'string' ? raw.id : raw.code,
      code: raw.code,
      name_en: raw.name_en,
      name_bn: typeof raw.name_bn === 'string' && raw.name_bn ? raw.name_bn : raw.name_en,
      city: typeof raw.city === 'string' ? raw.city : null,
      domain: typeof primary?.domain === 'string' ? primary.domain : null,
    });
  }
  return out;
}

/** The twelve modules, in the order the dashboard shows them. */
const MODULES: Array<{ key: string; navKey: string }> = [
  { key: 'marketplace', navKey: 'moduleMarketplace2' },
  { key: 'skills', navKey: 'moduleSkills' },
  { key: 'civic', navKey: 'moduleCivic' },
  { key: 'events', navKey: 'moduleEvents' },
  { key: 'health', navKey: 'moduleHealth' },
  { key: 'mentorship', navKey: 'moduleMentorship' },
  { key: 'housing', navKey: 'moduleHousing2' },
  { key: 'careers', navKey: 'moduleCareers' },
  { key: 'dining', navKey: 'moduleDining2' },
  { key: 'lostfound', navKey: 'moduleLostFound2' },
  { key: 'sports', navKey: 'moduleSports' },
  { key: 'trust', navKey: 'moduleTrust' },
];

const ALSO_ON_CAMPUS = [
  { href: '/archive', navKey: 'moduleArchive', icon: '📚' },
  { href: '/events/map', navKey: 'moduleLiveMap', icon: '📍' },
  { href: '/reviews', navKey: 'moduleReviews', icon: '⭐' },
];

/** Fade + rise once, when the block scrolls into view. */
function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-8% 0px' }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Counts up from 0 the first time it is visible; jumps straight to the value under reduced motion. */
function AnimatedCounter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [value, setValue] = React.useState(0);

  React.useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setValue(to);
      return;
    }
    let frame = 0;
    const started = performance.now();
    const duration = 1100;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      setValue(Math.round(to * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, reduce, to]);

  return (
    <span ref={ref} aria-label={`${to}${suffix}`}>
      <span aria-hidden>
        {value}
        {suffix}
      </span>
    </span>
  );
}

/** Real logo from /public/logos; falls back to the university code when a file is missing. */
function UniversityLogo({ code, name }: { code: string; name: string }) {
  const [failed, setFailed] = React.useState(false);
  if (failed) {
    return (
      <span
        aria-hidden
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-xs font-bold text-emerald-600 dark:text-emerald-300"
      >
        {code.slice(0, 4)}
      </span>
    );
  }
  return (
    <img
      src={`/logos/${code.toLowerCase()}.png`}
      alt={`${name} logo`}
      width={48}
      height={48}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="h-12 w-12 shrink-0 rounded-xl bg-white object-contain p-1 ring-1 ring-slate-200 transition-transform duration-200 group-hover:scale-110 dark:ring-slate-700"
    />
  );
}

export function WelcomeView() {
  const { t, locale } = useUi();
  const session = useSession();
  const [universities, setUniversities] = React.useState<WelcomeUniversity[]>(FALLBACK_UNIVERSITIES);

  // Remember that this account has seen the welcome screen (see WelcomeGate).
  React.useEffect(() => {
    if (session.loading) return;
    markWelcomeSeen(session.authenticated ? session.email : null);
  }, [session.loading, session.authenticated, session.email]);

  React.useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    let cancelled = false;
    fetch('/api/universities', { signal: controller.signal })
      .then((response) => response.json())
      .then((payload) => {
        const rows = payload?.success ? normalizeRegistry(payload.data) : [];
        if (!cancelled && rows.length > 0) setUniversities(rows);
      })
      .catch(() => undefined)
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  const signedIn = session.authenticated;
  const continueHref = session.isAdmin ? '/admin/console' : '/';

  return (
    <div className="pb-10">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        aria-labelledby="welcome-title"
        className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-slate-950 to-teal-950 px-5 py-16 text-white sm:px-10 sm:py-24"
      >
        <div aria-hidden className="campus360-float pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-emerald-500/30 blur-3xl" />
        <div aria-hidden className="campus360-float pointer-events-none absolute -bottom-28 left-1/4 h-64 w-64 rounded-full bg-teal-400/20 blur-3xl [animation-delay:3s]" />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto max-w-3xl text-center"
        >
          <img
            src="/logos/campus360-logo.jpg"
            alt="Campus360 BD"
            width={64}
            height={64}
            className="mx-auto h-16 w-16 rounded-full bg-white object-cover p-0.5 shadow-lg"
          />
          <p className="mt-5 text-sm font-semibold text-emerald-300">
            🇧🇩 {t('Welcome to Campus360 BD')}
          </p>
          <h1 id="welcome-title" className="c360-h1 mt-3">
            {t('One Verified Super-App for Every Campus in Bangladesh')}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
            {t('Verified student access, 12 real-time modules and a trusted campus network — built for public universities across Bangladesh.')}
          </p>

          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            {signedIn ? (
              <Link href={continueHref} className="c360-btn-primary">
                {t('Continue to Dashboard')} →
              </Link>
            ) : (
              <Link href="/signup" className="c360-btn-primary">
                {t('Get Started — Sign Up')} →
              </Link>
            )}
            <a
              href="#modules"
              className="c360-btn border border-white/25 bg-white/10 text-white hover:-translate-y-0.5 hover:bg-white/20"
            >
              {t('Explore Modules')}
            </a>
          </div>
          {!signedIn && (
            <p className="mt-5 text-sm text-slate-400">
              {t('Already a member?')}{' '}
              <Link href="/signin" className="font-semibold text-emerald-300 underline-offset-4 hover:underline">
                {t('Sign In')}
              </Link>
            </p>
          )}
        </motion.div>
      </section>

      <div className="mx-auto max-w-6xl space-y-16 px-4 sm:px-6">
        {/* ── Stats ──────────────────────────────────────────────────────── */}
        <Reveal className="-mt-8 relative z-10">
          <dl className="c360-card grid grid-cols-3 divide-x divide-slate-200 p-4 text-center dark:divide-slate-800 sm:p-6">
            {[
              { value: universities.length, suffix: '', label: t('Universities') },
              { value: MODULES.length, suffix: '', label: t('Modules') },
              { value: 100, suffix: '%', label: t('Verified Students') },
            ].map((stat) => (
              <div key={stat.label} className="px-2">
                <dt className="sr-only">{stat.label}</dt>
                <dd className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 sm:text-4xl">
                  <AnimatedCounter to={stat.value} suffix={stat.suffix} />
                </dd>
                <p aria-hidden className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">
                  {stat.label}
                </p>
              </div>
            ))}
          </dl>
        </Reveal>

        {/* ── Modules ────────────────────────────────────────────────────── */}
        <section id="modules" aria-labelledby="modules-title" className="space-y-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 id="modules-title" className="c360-h2">{t('Everything your campus needs, in one place')}</h2>
            <p className="c360-muted mt-2">
              {t('Twelve real-time modules — every status change, RSVP, ticket and match updates live.')}
            </p>
          </Reveal>

          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map(({ key, navKey }, index) => {
              const meta = MODULE_META[key];
              if (!meta) return null;
              return (
                <li key={key}>
                  <Reveal delay={Math.min(index, 5) * 0.04} className="h-full">
                    <Link href={meta.href} className="group c360-card-interactive flex h-full items-start gap-4 p-5">
                      <span
                        aria-hidden
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-2xl transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3"
                      >
                        {meta.icon}
                      </span>
                      <span className="min-w-0">
                        <span className="c360-h3 block transition-colors group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                          {t(navKey)}
                        </span>
                        <span className="c360-muted mt-1 block leading-snug">
                          {locale === 'bn' ? meta.blurbBn : meta.blurb}
                        </span>
                      </span>
                    </Link>
                  </Reveal>
                </li>
              );
            })}
          </ul>

          <Reveal className="flex flex-wrap items-center justify-center gap-2">
            <span className="c360-muted">{t('Also on campus')}:</span>
            {ALSO_ON_CAMPUS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-medium transition hover:border-emerald-500/60 hover:text-emerald-600 dark:border-slate-700 dark:hover:text-emerald-400"
              >
                <span aria-hidden>{item.icon}</span>
                {t(item.navKey)}
              </Link>
            ))}
          </Reveal>
        </section>

        {/* ── Universities ───────────────────────────────────────────────── */}
        <section id="universities" aria-labelledby="universities-title" className="space-y-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 id="universities-title" className="c360-h2">{t('Supported Public Universities')}</h2>
            <p className="c360-muted mt-2">
              {t('Sign up with your official university email — each campus is its own verified, isolated community.')}
            </p>
          </Reveal>

          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label={t('Supported Public Universities')}>
            {universities.map((university, index) => {
              const primary = locale === 'bn' ? university.name_bn : university.name_en;
              const secondary = locale === 'bn' ? university.name_en : university.name_bn;
              return (
                <li key={university.id}>
                  <Reveal delay={Math.min(index % 4, 3) * 0.05} className="h-full">
                    <article className="group c360-card-interactive flex h-full items-center gap-4 p-4">
                      <UniversityLogo code={university.code} name={university.name_en} />
                      <div className="min-w-0">
                        <p className="text-xs font-bold tracking-wide text-emerald-600 dark:text-emerald-400">
                          {university.code}
                          {university.city ? <span className="font-medium text-slate-400"> · {university.city}</span> : null}
                        </p>
                        <h3 className="mt-0.5 text-sm font-semibold leading-snug">{primary}</h3>
                        {secondary && secondary !== primary ? (
                          <p className="mt-0.5 text-xs leading-snug text-slate-500 dark:text-slate-400">{secondary}</p>
                        ) : null}
                      </div>
                    </article>
                  </Reveal>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ── Closing CTA ────────────────────────────────────────────────── */}
        <Reveal>
          <section className="c360-card flex flex-col items-center gap-4 px-6 py-10 text-center">
            <h2 className="c360-h2">
              {signedIn ? t('Ready to dive in?') : t('Ready to join your campus?')}
            </h2>
            <p className="c360-muted max-w-xl">
              {t('Verified access takes a minute: pick your university, confirm your institutional email with a one-time code, and you are in.')}
            </p>
            <Link href={signedIn ? continueHref : '/signup'} className="c360-btn-primary">
              {signedIn ? t('Continue to Dashboard') : t('Get Started — Sign Up')} →
            </Link>
          </section>
        </Reveal>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="mx-auto mt-16 max-w-6xl border-t border-slate-200 px-4 pt-6 dark:border-slate-800 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-3 text-sm text-slate-500 dark:text-slate-400 sm:flex-row">
          <p>© {new Date().getFullYear()} Campus360 BD</p>
          <nav aria-label={t('Footer')} className="flex items-center gap-2">
            <Link href="/privacy" className="inline-flex min-h-[44px] items-center px-3 hover:text-emerald-600 dark:hover:text-emerald-400">
              {t('Privacy')}
            </Link>
            <Link href="/terms" className="inline-flex min-h-[44px] items-center px-3 hover:text-emerald-600 dark:hover:text-emerald-400">
              {t('Terms')}
            </Link>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex min-h-[44px] items-center px-3 hover:text-emerald-600 dark:hover:text-emerald-400">
              {t('Contact')}
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
