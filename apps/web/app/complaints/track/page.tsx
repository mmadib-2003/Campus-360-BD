'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUi } from '@/lib/i18n-client';

function TrackForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useUi();
  const [code, setCode] = React.useState(searchParams.get('code') ?? '');

  React.useEffect(() => {
    const existing = searchParams.get('code');
    if (existing) router.replace(`/track/${encodeURIComponent(existing.trim().toUpperCase())}`);
  }, [router, searchParams]);

  return (
    <div className="max-w-xl mx-auto my-12 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
      <h1 className="text-xl font-bold">🔎 {t('Track Grievance Case')}</h1>
      <p className="text-xs text-slate-500">{t('Paste your ticket ID to see the live status timeline.')}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const next = code.trim().toUpperCase();
          if (next) router.push(`/track/${encodeURIComponent(next)}`);
        }}
        className="flex flex-col sm:flex-row gap-2"
      >
        <input
          required
          placeholder={t('JU-CASE-2026-482913')}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className="flex-1 rounded-xl p-2.5 text-sm font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
        />
        <button type="submit" className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold">
          {t('Track')}
        </button>
      </form>
      <div className="flex flex-wrap gap-3 text-xs">
        <Link href="/track/JU-CASE-2026-482913" className="text-emerald-600 dark:text-emerald-400 hover:underline">
          JU-CASE-2026-482913
        </Link>
        <Link href="/track/DU-CASE-2026-482913" className="text-emerald-600 dark:text-emerald-400 hover:underline">
          DU-CASE-2026-482913
        </Link>
      </div>
      <p className="text-[11px] text-slate-400">{t('Check the code and try again. Civic tickets look like')} JU-CASE-2026-482913.</p>
    </div>
  );
}

export default function ComplaintTrackPage() {
  return (
    <React.Suspense fallback={<div className="text-center mt-20 text-sm">…</div>}>
      <TrackForm />
    </React.Suspense>
  );
}
