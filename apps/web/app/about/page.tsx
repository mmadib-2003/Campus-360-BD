// apps/web/app/about/page.tsx
// Static About page — the footer's "About Us" destination.
import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Reveal } from '@/components/motion/Reveal';

export const metadata: Metadata = {
  title: 'About Us — Campus360 BD',
  description:
    'Campus360 BD is the unified digital ecosystem for the public universities of Bangladesh: verified academics, tracked grievances, live events, marketplace and emergency support.',
};

const STATS = [
  { value: '13', label: 'Public universities live' },
  { value: '142', label: 'Residential halls mapped' },
  { value: '18', label: 'Modules, one account' },
];

const PILLARS = [
  {
    icon: '🎓',
    title: 'Academic & Career Hub',
    blurb: 'Verified academic archive, skill tracks, peer mentorship and an alumni network that actually opens doors.',
  },
  {
    icon: '🌿',
    title: 'Campus Life & Circular Economy',
    blurb: 'Marketplace, lost & found, events, clubs, cafeteria and sports — everything campus, run by and for students.',
  },
  {
    icon: '🩸',
    title: 'Emergency & Health Network',
    blurb: 'Live blood-donor finder, emergency campus support and health services wired into the university network.',
  },
  {
    icon: '🏛️',
    title: 'Hall & Campus Governance',
    blurb: 'Hall registries and verified, trackable grievance resolution — a JU-CASE-style ticket for every complaint.',
  },
];

export default function AboutPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-12">
      {/* Hero */}
      <section className="text-center max-w-3xl mx-auto space-y-5">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
          About Campus360 BD
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15]">
          The Unified{' '}
          <span className="bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">
            Digital Ecosystem
          </span>{' '}
          for Public Universities in Bangladesh
        </h1>
        <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-7">
          Campus360 BD gives every verified student, faculty member and alumnus of Bangladesh&apos;s public
          universities one trusted home: a verified academic archive, tracked grievance resolution, live campus
          events, and the everyday services campus life runs on — across halls, departments and universities.
        </p>
      </section>

      {/* Stats */}
      <Reveal>
      <section aria-label="Campus360 BD at a glance" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {STATS.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0a0a0a] p-6 text-center card-glow hover-lift"
          >
            <div className="text-4xl sm:text-5xl font-extrabold bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">
              {stat.value}
            </div>
            <div className="mt-2 text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</div>
          </div>
        ))}
      </section>
      </Reveal>

      {/* Pillars */}
      <Reveal delay={0.08}>
      <section aria-label="What we build" className="space-y-6">
        <div className="text-center max-w-xl mx-auto">
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Four pillars, one campus</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Everything on Campus360 BD hangs off one verified identity — your university.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PILLARS.map((pillar) => (
            <article
              key={pillar.title}
              className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0a0a0a] p-6 hover-lift transition-colors hover:border-emerald-500/40"
            >
              <div className="text-3xl" aria-hidden>{pillar.icon}</div>
              <h3 className="mt-3 font-bold text-slate-900 dark:text-white">{pillar.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-slate-500 dark:text-slate-400">{pillar.blurb}</p>
            </article>
          ))}
        </div>
      </section>
      </Reveal>

      {/* CTA */}
      <Reveal delay={0.12}>
      <section className="rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent p-8 sm:p-10 text-center space-y-5">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
          Ready to enter your campus?
        </h2>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          Sign in with your institutional email, verify through OTP, and the whole university opens up.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex min-h-[48px] items-center px-6 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 hover:opacity-90 hover:-translate-y-0.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            Join Your Campus →
          </Link>
          <Link
            href="/welcome"
            className="inline-flex min-h-[48px] items-center px-6 rounded-xl font-semibold text-sm border border-slate-300 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            Explore the platform
          </Link>
        </div>
      </section>
      </Reveal>
    </div>
  );
}
