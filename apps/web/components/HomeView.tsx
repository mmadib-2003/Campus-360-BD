'use client';

import React from 'react';
import Link from 'next/link';
import { useUi } from '@/lib/i18n-client';
import { ModuleHub } from '@/components/modules/ModuleHub';

interface RegistryUniversity {
  id: string;
  code: string;
  name_en: string;
  name_bn: string;
  city?: string;
  /** Both optional: the demo payload and 0014 provide them, older rows may not. */
  logo_url?: string | null;
  cover_image_url?: string | null;
  university_email_domains?: Array<{ domain: string; is_primary?: boolean }>;
}

/**
 * A 404 on a campus image must never take the section down: the element hides
 * itself and the gradient behind it stays as the artwork. `visibility` (not
 * `remove()`) so React still owns the node it is unmounting later.
 */
function hideOnBrokenImage(event: React.SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.style.visibility = 'hidden';
}

export function HomeView({ compact = false }: { compact?: boolean }) {
  const { locale, t } = useUi();
  const [universities, setUniversities] = React.useState<RegistryUniversity[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/universities')
      .then((response) => response.json())
      .then((payload) => {
        if (!cancelled && payload?.success && Array.isArray(payload.data)) {
          setUniversities(payload.data as RegistryUniversity[]);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <section className="p-8 rounded-2xl bg-gradient-to-br from-emerald-900/60 via-slate-900 to-teal-950 border border-emerald-500/30 shadow-xl">
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300">
          🇧🇩 {t('All 50+ Bangladesh Public Universities Supported')}
        </span>
        <h1 className="text-3xl md:text-4xl font-extrabold text-white mt-4">
          {t('One verified super-app for every public university campus in Bangladesh')}
        </h1>
        <p className="text-sm text-slate-300 mt-2 max-w-2xl">
          {t('Strict institutional email OTP verification, row-level tenant isolation, a 50 MB virus-scanned Academic Archive, SLA-tracked anonymous grievance resolution, and live campus events.')}
        </p>
        <div className="flex flex-wrap gap-3 mt-6">
          <Link
            href="/signup"
            className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow"
          >
            {t('Join Your Campus')}
          </Link>
          <Link
            href="/track/JU-CASE-2026-482913"
            className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700"
          >
            {t('Track Grievance Case')} (JU-CASE-...)
          </Link>
        </div>
      </section>

      <ModuleHub />

      {!compact && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">{t('Supported Public Universities Registry')}</h2>
            <Link href="/signup" className="text-xs text-emerald-400 hover:underline">
              {t('View Full Searchable Dropdown')} →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(universities.length ? universities : []).slice(0, 12).map((university) => (
              <div
                key={university.id}
                className="overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              >
                <div className="relative h-24 bg-gradient-to-br from-emerald-900/70 via-slate-900 to-teal-950">
                  {university.cover_image_url ? (
                    <img
                      src={university.cover_image_url}
                      alt=""
                      loading="lazy"
                      onError={hideOnBrokenImage}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : null}
                  <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-slate-950/85 to-transparent" />
                  <div className="absolute bottom-2 left-3 right-3 flex items-center gap-2">
                    {university.logo_url ? (
                      <img
                        src={university.logo_url}
                        alt=""
                        loading="lazy"
                        width={28}
                        height={28}
                        onError={hideOnBrokenImage}
                        className="h-7 w-7 rounded-lg ring-1 ring-white/25"
                      />
                    ) : null}
                    <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-200 font-bold text-xs">
                      {university.code}
                    </span>
                  </div>
                </div>
                <div className="p-4 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400 font-mono truncate">
                      {(university.university_email_domains ?? []).map((domain) => `@${domain.domain}`).join(', ')}
                    </span>
                    {university.city ? (
                      <span className="text-[11px] text-slate-400 shrink-0">{university.city}</span>
                    ) : null}
                  </div>
                  <div className="font-semibold text-sm">{locale === 'bn' ? university.name_bn : university.name_en}</div>
                  <div className="text-xs text-slate-400">{locale === 'bn' ? university.name_en : university.name_bn}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
