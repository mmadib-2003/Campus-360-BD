'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useUi } from '@/lib/i18n-client';
import { ModuleHub } from '@/components/modules/ModuleHub';
import { EmptyState, SkeletonGrid } from '@/components/modules/ui';
import { StaggerGroup, StaggerItem, cardHover } from '@/components/motion/Stagger';

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
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
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

  return (
    <div className="space-y-8">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden p-8 rounded-2xl bg-gradient-to-br from-emerald-900/60 via-slate-900 to-teal-950 border border-emerald-500/30 shadow-xl"
      >
        {/* Slow ambient blobs — the page should feel alive before any data lands. */}
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

        <div className="relative">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            🇧🇩 {t('13 Bangladesh Public Universities Supported')}
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
              className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow transition hover:scale-[1.03] hover:shadow-emerald-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              {t('Join Your Campus')}
            </Link>
            <Link
              href="/track/JU-CASE-2026-482913"
              className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition hover:scale-[1.02]"
            >
              {t('Track Grievance Case')} (JU-CASE-...)
            </Link>
            <Link
              href="/signin"
              className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-white/10 hover:bg-white/15 text-white border border-white/20 transition hover:scale-[1.02]"
            >
              ⚡ {t('Quick Demo Login')}
            </Link>
          </div>
        </div>
      </motion.section>

      <ModuleHub />

      {!compact && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold">{t('Supported Public Universities Registry')}</h2>
              <p className="text-[11px] text-slate-400">
                {t('Authentic campus photography and institutional logos via Wikimedia Commons.')}
              </p>
            </div>
            <Link href="/signup" className="text-xs text-emerald-400 hover:underline">
              {t('View Full Searchable Dropdown')} →
            </Link>
          </div>

          {loading ? (
            <SkeletonGrid rows={6} />
          ) : universities.length === 0 ? (
            <EmptyState
              icon="🏛️"
              title={t('The registry is warming up')}
              description={t('Campus cards will appear as soon as the registry responds.')}
            />
          ) : (
            <StaggerGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {universities.slice(0, 12).map((university) => (
                <StaggerItem key={university.id} className="h-full">
                  <motion.article
                    {...cardHover}
                    className="card-glow h-full overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                  >
                    <div className="relative h-24 bg-gradient-to-br from-emerald-900/70 via-slate-900 to-teal-950">
                      {university.cover_image_url ? (
                        <img
                          src={university.cover_image_url}
                          alt={`${university.name_en} campus`}
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          onError={hideOnBrokenImage}
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 hover:scale-105"
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
                  </motion.article>
                </StaggerItem>
              ))}
            </StaggerGroup>
          )}
        </section>
      )}
    </div>
  );
}
