// apps/web/components/modules/ModuleHub.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { MODULE_META } from '@/lib/modules/labels';
import dynamic from 'next/dynamic';
import { useSession } from '@/lib/modules/client';
import { useCampusScope } from '@/lib/use-campus-scope';
import { withCampusScope } from '@/lib/campus-scope';
import { Badge, Card, SkeletonList } from './ui';
import { useUi } from '@/lib/i18n-client';
import { StaggerGroup, StaggerItem } from '@/components/motion/Stagger';

// Code-split embeds keep the campus feed's first-load JS unchanged.
const MarketplacePreview = dynamic(() => import('./previews/MarketplacePreview'), {
  ssr: false,
  loading: () => <SkeletonList rows={2} />,
});
const HealthPreview = dynamic(() => import('./previews/HealthPreview'), {
  ssr: false,
  loading: () => <SkeletonList rows={2} />,
});

const ORDER = [
  'marketplace',
  'skills',
  'civic',
  'events',
  'health',
  'mentorship',
  'housing',
  'careers',
  'dining',
  'lostfound',
  'sports',
  'trust',
];

/**
 * The twelve interactive modules rendered as a hub on the campus feed.
 * Purely additive: the hero, registry and existing navigation are untouched.
 */
export function ModuleHub() {
  const session = useSession();
  const { scope } = useCampusScope();
  const { locale, t } = useUi();

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="c360-h2">{t('Campus360 Interactive Modules')}</h2>
          <p className="c360-muted">
            {t('Twelve real-time modules — every status change, RSVP, ticket and match updates live via Supabase Realtime.')}
          </p>
        </div>
        {session.demo && <Badge tone="amber">{t('Preview data')}</Badge>}
      </div>

      {/* One icon, one title, one sentence: no badges, no footers. */}
      <StaggerGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ORDER.map((key) => {
          const meta = MODULE_META[key];
          if (!meta) return null;
          return (
            <StaggerItem key={key} className="h-full">
              <Link
                href={withCampusScope(meta.href, scope)}
                className="group c360-card-interactive flex h-full items-start gap-4 p-5"
              >
                <span
                  aria-hidden
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-xl transition-transform duration-200 group-hover:scale-110"
                >
                  {meta.icon}
                </span>
                <span className="min-w-0">
                  <span className="c360-h3 block truncate transition-colors group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                    {locale === 'bn' ? meta.titleBn : t(meta.title)}
                  </span>
                  <span className="c360-muted mt-1 line-clamp-2 block">{locale === 'bn' ? meta.blurbBn : meta.blurb}</span>
                </span>
              </Link>
            </StaggerItem>
          );
        })}
      </StaggerGroup>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="c360-h3">🛍️ {t('Marketplace')}</h3>
            <p className="c360-muted">{t('Buy, sell and rent verified student items with monitored campus handover points.')}</p>
          </div>
          <Link href={withCampusScope("/marketplace", scope)} className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            {t('Marketplace')} →
          </Link>
        </div>
        <MarketplacePreview />
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="c360-h3">🩸 {t('Blood & Health Network')}</h3>
            <p className="c360-muted">{t('Blood requests, donor matching and confidential counselling.')}</p>
          </div>
          <Link href={withCampusScope("/health?tab=donors", scope)} className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            {t('Blood & Health Network')} →
          </Link>
        </div>
        <HealthPreview />
      </Card>
    </section>
  );
}
