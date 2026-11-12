// apps/web/components/welcome/LegalPage.tsx
// Standalone public legal & data-stewardship page (Server Component) sharing
// the Welcome header/footer visual language without authenticated shell chrome.

import React from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@campus360bd.com';

export interface LegalPageProps {
  title: string;
  intro: string;
  points: string[];
}

export function LegalPage({ title, intro, points }: LegalPageProps) {
  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <header className="sticky top-0 inset-x-0 z-40 w-full bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <img
              src="/logos/campus360-logo.jpg"
              alt="Campus360 BD"
              className="h-9 w-9 rounded-full object-cover bg-white p-0.5 shadow-sm shrink-0"
            />
            <span className="font-bold text-base tracking-tight truncate">Campus360 BD</span>
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <Link
              href="/signin"
              className="inline-flex min-h-[36px] items-center px-4 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:opacity-90 transition"
            >
              Enter Platform
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <article className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
          <div className="space-y-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              ← Back to Campus360 BD
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{title}</h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">{intro}</p>
          </div>

          <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
            {points.map((point) => (
              <li
                key={point}
                className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800"
              >
                <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0 mt-0.5" aria-hidden>
                  ✓
                </span>
                <span className="leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>

          <p className="pt-2 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200/80 dark:border-slate-800">
            Questions? Write to{' '}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </article>
      </main>

      <footer className="border-t border-slate-200/80 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-semibold">Campus360 BD — Verified Multi-University Super-App</span>
          <span className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/privacy" className="hover:text-emerald-500">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-emerald-500">
              Terms
            </Link>
            <Link href="/signin" className="hover:text-emerald-500">
              Sign In
            </Link>
            <Link href="/signup" className="hover:text-emerald-500">
              Join Your Campus
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
