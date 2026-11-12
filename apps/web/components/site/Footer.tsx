'use client';

// apps/web/components/site/Footer.tsx
// Comprehensive site footer — the single footer used everywhere (dashboard
// shell via AppShell, and the Welcome experience via WelcomeView).
// Semantic landmarks: <footer> > <section> per column group + <nav> per link
// list so screen readers can jump straight to "Quick links" / "Policy links".
// True-dark design: pure #000 background, hairline white/10 borders, an
// emerald gradient hairline along the top edge, and whileInView reveal via
// framer-motion (reduced-motion aware through the app-wide MotionConfig).

import React from 'react';
import Link from 'next/link';
import { motion, type Variants } from 'framer-motion';
import { useUi } from '@/lib/i18n-client';

const QUICK_LINKS: Array<{ href: string; key: string }> = [
  { href: '/welcome#services', key: 'Our Service' },
  { href: '/welcome#universities', key: 'Where We Serve' },
  { href: '/about', key: 'About Us' },
  { href: '/contact', key: 'Contact' },
];

const POLICY_LINKS: Array<{ href: string; key: string }> = [
  { href: '/legal/terms', key: 'Terms & Conditions' },
  { href: '/legal/privacy', key: 'Privacy Policy' },
  { href: '/legal/return-refund', key: 'Return & Refund Policy' },
  { href: '/legal/cancellation', key: 'Cancellation Policy' },
];

const SOCIALS: Array<{ href: string; key: string; label: string; path: React.ReactNode }> = [
  {
    href: 'https://www.facebook.com/campus360bd',
    key: 'Facebook',
    label: 'Campus360 BD on Facebook',
    path: <path d="M13.5 21v-6.6h2.2l.33-2.6h-2.53V10.1c0-.75.21-1.27 1.28-1.27H16.2V6.56C15.9 6.52 14.9 6.43 13.73 6.43c-2.3 0-3.88 1.4-3.88 3.99v1.77H7.6v2.6h2.25V21h3.65z" />,
  },
  {
    href: 'https://www.linkedin.com/company/campus360bd',
    key: 'LinkedIn',
    label: 'Campus360 BD on LinkedIn',
    path: <path d="M6.94 8.5a1.94 1.94 0 1 0 0-3.88 1.94 1.94 0 0 0 0 3.88zM5.16 10.7h3.56V20H5.16v-9.3zm5.67 0h3.4v1.28h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.44V20h-3.56v-4.6c0-1.1-.02-2.52-1.53-2.52-1.53 0-1.77 1.2-1.77 2.44V20h-3.56v-9.3z" />,
  },
  {
    href: 'https://www.instagram.com/campus360bd',
    key: 'Instagram',
    label: 'Campus360 BD on Instagram',
    path: (
      <>
        <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="4.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="12" cy="12" r="3.9" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="17.3" cy="6.7" r="1.15" />
      </>
    ),
  },
  {
    href: 'https://www.youtube.com/@campus360bd',
    key: 'YouTube',
    label: 'Campus360 BD on YouTube',
    path: <path d="M21.6 7.2a2.5 2.5 0 0 0-1.76-1.77C18.28 5 12 5 12 5s-6.28 0-7.84.43A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.76 1.77C5.72 19 12 19 12 19s6.28 0 7.84-.43a2.5 2.5 0 0 0 1.76-1.77A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10.4 14.6V9.4l4.9 2.6-4.9 2.6z" />,
  },
];

// Text chips beat guessing at third-party logo files: each chip carries the
// partner's brand color on a true-black surface, which passes contrast.
const PAYMENT_PARTNERS = [
  { name: 'bKash', className: 'bg-[#E2136E] text-white' },
  { name: 'Nagad', className: 'bg-[#F6921E] text-[#231F20]' },
  { name: 'aamarpay', className: 'bg-[#00A651] text-white' },
];

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.05 },
  },
};

const column: Variants = {
  hidden: { opacity: 0, y: 26 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

function ColumnHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
      {children}
    </h2>
  );
}

export function SiteFooter({ className = '' }: { className?: string }) {
  const { t } = useUi();
  // Scroll-reveal needs a real IntersectionObserver (browsers). Under bare
  // react-test-renderer / SSR-less tests there is none — fall back to a plain
  // mount animation so the footer always ends fully visible.
  const canObserve =
    typeof window !== 'undefined' && typeof (window as { IntersectionObserver?: unknown }).IntersectionObserver !== 'undefined';

  return (
    <footer
      aria-label={t('Site footer')}
      className={`gradient-hairline border-t border-slate-200 dark:border-white/10 bg-white dark:bg-black text-slate-600 dark:text-slate-300 ${className}`}
    >
      {/* Faint emerald aura rising from the bottom of the footer (dark only). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 hidden dark:block"
        style={{
          background:
            'radial-gradient(60% 100% at 50% 100%, rgb(16 185 129 / 0.10) 0%, transparent 70%)',
        }}
      />
      <motion.div
        variants={container}
        initial="hidden"
        {...(canObserve
          ? { whileInView: 'show' as const, viewport: { once: true, amount: 0.15 as const } }
          : { animate: 'show' as const })}
        className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-6 lg:pt-16 lg:pb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8"
      >
        {/* Column 1 — Brand & description */}
        <motion.section variants={column} className="lg:col-span-4 space-y-5" aria-label={t('About Campus360BD')}>
          <Link href="/" className="inline-flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xl">
            {/* Official Campus360 BD mark (user-supplied brand asset, see
                docs/IMAGE_ATTRIBUTION.md). */}
            <img
              src="/logos/campus360-logo.jpg"
              alt="Campus360 BD"
              width={48}
              height={48}
              loading="lazy"
              className="h-12 w-12 rounded-2xl object-cover bg-white p-0.5 ring-1 ring-slate-200 dark:ring-white/15 shadow-lg shadow-emerald-500/10 transition-transform duration-300 group-hover:scale-105"
            />
            <span className="text-xl font-extrabold tracking-[0.08em] text-slate-900 dark:text-white">
              CAMPUS<span className="text-emerald-500">360</span>BD
            </span>
          </Link>
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-400 max-w-xs">
            {t('We Dream')}{' '}
            <strong className="font-bold text-slate-900 dark:text-white">
              {t('The Unified Digital Ecosystem for Public Universities in Bangladesh')}
            </strong>
            .
          </p>
          <div className="flex items-center gap-2.5">
            {SOCIALS.map((social) => (
              <motion.a
                key={social.key}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t(social.label)}
                title={t(social.label)}
                whileHover={{ scale: 1.18, y: -2 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 380, damping: 18 }}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:text-white hover:bg-emerald-600 hover:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                  {social.path}
                </svg>
              </motion.a>
            ))}
          </div>
        </motion.section>

        {/* Column 2 — Quick links */}
        <motion.nav variants={column} className="lg:col-span-2" aria-label={t('Quick Links')}>
          <ColumnHeading>{t('Quick Links')}</ColumnHeading>
          <ul className="mt-4 space-y-2.5 text-sm">
            {QUICK_LINKS.map((link) => (
              <li key={link.key}>
                <Link href={link.href} className="nav-link py-1">
                  {t(link.key)}
                </Link>
              </li>
            ))}
          </ul>
        </motion.nav>

        {/* Column 3 — Policy links */}
        <motion.nav variants={column} className="lg:col-span-3" aria-label={t('Policy Links')}>
          <ColumnHeading>{t('Policy Links')}</ColumnHeading>
          <ul className="mt-4 space-y-2.5 text-sm">
            {POLICY_LINKS.map((link) => (
              <li key={link.key}>
                <Link href={link.href} className="nav-link py-1">
                  {t(link.key)}
                </Link>
              </li>
            ))}
          </ul>
        </motion.nav>

        {/* Column 4 — Contact & payment partners */}
        <motion.section variants={column} className="lg:col-span-3 space-y-5" aria-label={t('Contact')}>
          <ColumnHeading>{t('Contact')}</ColumnHeading>
          <ul className="space-y-3 text-sm">
            <li>
              <a
                href="mailto:ourcampus360bd@gmail.com"
                className="inline-flex items-center gap-3 rounded-lg py-1 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors break-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="3" y="5" width="18" height="14" rx="2.5" />
                    <path d="m3.5 7 8.5 6 8.5-6" />
                  </svg>
                </span>
                ourcampus360bd@gmail.com
              </a>
            </li>
            <li>
              <a
                href="tel:+8801722194398"
                className="inline-flex items-center gap-3 rounded-lg py-1 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 11.91a16 16 0 0 0 6 6l3.27-1.27a2 2 0 0 1 2.11.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </span>
                <span className="font-mono">+8801722194398</span>
              </a>
            </li>
          </ul>

          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {t('Payment Partners')}
            </h3>
            <ul className="mt-2.5 flex flex-wrap items-center gap-2" aria-label={t('Payment Partners')}>
              {PAYMENT_PARTNERS.map((partner) => (
                <li
                  key={partner.name}
                  className={`rounded-lg px-3.5 py-1.5 text-[12px] font-extrabold tracking-wide shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md ${partner.className}`}
                >
                  {partner.name}
                </li>
              ))}
            </ul>
          </div>
        </motion.section>
      </motion.div>

      {/* Bottom bar — centered, separated by a top hairline. */}
      <div className="relative border-t border-slate-200 dark:border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[3.5rem] py-2.5 flex flex-col items-center justify-center gap-1 text-center">
          <p className="text-[11px] sm:text-xs text-slate-400">Copyright © 2026 Campus360BD | All Rights Reserved.</p>
          <p className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <span aria-hidden>🇧🇩</span>
            <span>{t('Built for the public universities of Bangladesh')}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
