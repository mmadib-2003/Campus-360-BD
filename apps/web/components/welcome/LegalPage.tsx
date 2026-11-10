'use client';

import React from 'react';
import Link from 'next/link';
import { useUi } from '@/lib/i18n-client';
import { SUPPORT_EMAIL } from '@/lib/welcome';

/** Short, static information page shared by /privacy and /terms. */
export function LegalPage({ title, intro, points }: { title: string; intro: string; points: string[] }) {
  const { t } = useUi();
  return (
    <article className="c360-card mx-auto max-w-2xl space-y-6 p-6 sm:p-8">
      <header className="space-y-2">
        <h1 className="c360-h1 !text-3xl">{t(title)}</h1>
        <p className="c360-muted">{t(intro)}</p>
      </header>
      <ul className="list-disc space-y-3 pl-5 text-sm leading-relaxed">
        {points.map((point) => (
          <li key={point}>{t(point)}</li>
        ))}
      </ul>
      <p className="c360-muted">
        {t('Questions? Write to')}{' '}
        <a className="font-semibold text-emerald-600 hover:underline dark:text-emerald-400" href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_EMAIL}
        </a>
      </p>
      <Link href="/welcome" className="c360-btn-secondary">← {t('Back to Welcome')}</Link>
    </article>
  );
}
