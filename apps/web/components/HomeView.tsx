'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useUi } from '@/lib/i18n-client';
import { ModuleHub } from '@/components/modules/ModuleHub';
import { CampusScopeToggle } from '@/components/CampusScopeToggle';
import { useSession } from '@/lib/modules/client';
import { useCampusScope } from '@/lib/use-campus-scope';
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
  const session = useSession();
  const { scope } = useCampusScope();
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

  const guest = !session.loading && !session.authenticated;

  return (
    <div className="space-y-10">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="c360-card space-y-6 p-6 sm:p-8"
      >
        <div className="max-w-3xl space-y-3">
          <h1 className="c360-h1 !text-2xl sm:!text-3xl">
            {t('One verified super-app for every public university campus in Bangladesh')}
          </h1>
          <p className="c360-muted">
            {session.authenticated
              ? t(scope === 'all' ? 'Showing public listings across supported universities.' : 'Showing listings and activity for your university only.')
              : t('Strict institutional email OTP verification, row-level tenant isolation, a 50 MB virus-scanned Academic Archive, SLA-tracked anonymous grievance resolution, and live campus events.')}
          </p>
        </div>
        {session.authenticated && (
          <div className="w-full max-w-xl">
            <CampusScopeToggle universityCode={session.profile?.universities?.code} />
          </div>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {guest && (
            <>
              <Link href="/signup" className="c360-btn-primary">
                {t('Join Your Campus')}
              </Link>
              <Link href="/signin" className="c360-btn-secondary">
                ⚡ {t('Quick Demo Login')}
              </Link>
            </>
          )}
          <Link
            href="/track/JU-CASE-2026-482913"
            className="inline-flex min-h-[44px] items-center text-sm font-semibold text-emerald-600 underline-offset-4 hover:underline dark:text-emerald-400"
          >
            {t('Track Grievance Case')} (JU-CASE-...) →
          </Link>
        </div>
      </motion.section>

      <ModuleHub />

      {!compact && (
        <section className="space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="c360-h2">{t('Supported Public Universities Registry')}</h2>
            <Link href="/signup" className="text-sm font-semibold text-emerald-600 hover:underline dark:text-emerald-400">
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
            <StaggerGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {universities.map((university) => (
                <StaggerItem key={university.id} className="h-full">
                  <motion.article {...cardHover} className="c360-card card-glow h-full overflow-hidden">
                    <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-emerald-900/70 via-slate-900 to-teal-950">
                      {university.cover_image_url ? (
                        <img
                          src={university.cover_image_url}
                          alt={`${university.name_en} campus`}
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          onError={hideOnBrokenImage}
                          className="aspect-video w-full object-cover transition-transform duration-500 hover:scale-105"
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
                        <span className="text-xs font-bold text-white">{university.code}</span>
                      </div>
                    </div>
                    <div className="space-y-1 p-4">
                      <h3 className="text-sm font-semibold leading-snug">{locale === 'bn' ? university.name_bn : university.name_en}</h3>
                      {university.city ? <p className="text-xs text-slate-500 dark:text-slate-400">{university.city}</p> : null}
                    </div>
                  </motion.article>
                </StaggerItem>
              ))}
            </StaggerGroup>
          )}
          <p className="text-[11px] text-slate-400">
            {t('Authentic campus photography supplied by campus contributors; remaining photos and institutional logos via Wikimedia Commons.')}
          </p>
        </section>
      )}
    </div>
  );
}
