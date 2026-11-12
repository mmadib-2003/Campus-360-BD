// apps/web/app/contact/page.tsx
// Static Contact page — the footer's "Contact" destination.
import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Reveal } from '@/components/motion/Reveal';

export const metadata: Metadata = {
  title: 'Contact — Campus360 BD',
  description:
    'Reach the Campus360 BD team: ourcampus360bd@gmail.com, +8801722194398. Campus onboarding, partnerships, support and feedback.',
};

export default function ContactPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-10">
      <section className="text-center space-y-4">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
          Contact
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Talk to the{' '}
          <span className="bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">
            Campus360 BD
          </span>{' '}
          team
        </h1>
        <p className="text-base text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-7">
          Onboarding a hall or a university, media and partnerships, platform support or feedback — we read every
          message.
        </p>
      </section>

      <Reveal>
      <section aria-label="Contact channels" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <a
          href="mailto:ourcampus360bd@gmail.com"
          className="group rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0a0a0a] p-6 hover-lift transition-colors hover:border-emerald-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="5" width="18" height="14" rx="2.5" />
              <path d="m3.5 7 8.5 6 8.5-6" />
            </svg>
          </span>
          <h2 className="mt-4 font-bold text-slate-900 dark:text-white">Email us</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 break-all">ourcampus360bd@gmail.com</p>
          <p className="mt-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform">
            Write to us →
          </p>
        </a>

        <a
          href="tel:+8801722194398"
          className="group rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0a0a0a] p-6 hover-lift transition-colors hover:border-emerald-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 11.91a16 16 0 0 0 6 6l3.27-1.27a2 2 0 0 1 2.11.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </span>
          <h2 className="mt-4 font-bold text-slate-900 dark:text-white">Call us</h2>
          <p className="mt-1 text-sm font-mono text-slate-500 dark:text-slate-400">+8801722194398</p>
          <p className="mt-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform">
            Tap to call →
          </p>
        </a>
      </section>
      </Reveal>

      {/* Grievance fast-lane */}
      <Reveal delay={0.08}>
      <section className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="text-3xl" aria-hidden>🛡️</div>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-slate-900 dark:text-white">Tracking a grievance?</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
            You don&apos;t need to email us. Every complaint gets a live tracking code (like JU-CASE-…) the moment it is
            filed — follow status, evidence and resolution in real time.
          </p>
        </div>
        <Link
          href="/track"
          className="shrink-0 inline-flex min-h-[44px] items-center px-5 rounded-xl text-sm font-semibold border border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 transition-colors"
        >
          Track a case →
        </Link>
      </section>
      </Reveal>
    </div>
  );
}
