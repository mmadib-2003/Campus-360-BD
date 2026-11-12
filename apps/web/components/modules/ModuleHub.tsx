// apps/web/components/modules/ModuleHub.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { MODULE_META } from '@/lib/modules/labels';
import dynamic from 'next/dynamic';
import { useSession } from '@/lib/modules/client';
import { useCampusScope } from '@/lib/use-campus-scope';
import { withCampusScope } from '@/lib/campus-scope';
import { Badge, Card, SkeletonList } from './ui';
import { useUi } from '@/lib/i18n-client';
import { StaggerGroup, StaggerItem, cardHover } from '@/components/motion/Stagger';

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
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{t('Campus360 Interactive Modules')}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('Twelve real-time modules — every status change, RSVP, ticket and match updates live via Supabase Realtime.')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="emerald">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> {t('LIVE')}
          </Badge>
          {session.demo && <Badge tone="amber">{t('Preview data')}</Badge>}
          {session.profile?.universities?.code && <Badge tone="slate">{session.profile.universities.code}</Badge>}
        </div>
      </div>

      <StaggerGroup className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {ORDER.map((key) => {
          const meta = MODULE_META[key];
          if (!meta) return null;
          return (
            <StaggerItem key={key} className="h-full">
              <motion.div {...cardHover} className="h-full">
                <Link
                  href={withCampusScope(meta.href, scope)}
                  className="group card-glow flex h-full flex-col justify-between p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                >
                  <div className="flex items-start gap-3">
                    <span className="h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center text-lg shrink-0 transition-transform duration-200 group-hover:scale-110">
                      {meta.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm group-hover:text-emerald-500 transition truncate">
                        {locale === 'bn' ? meta.titleBn : t(meta.title)}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{locale === 'bn' ? meta.blurbBn : meta.blurb}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {t('Live module')}
                    </span>
                    <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
                  </div>
                </Link>
              </motion.div>
            </StaggerItem>
          );
        })}
      </StaggerGroup>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm">🛍️ {t('Marketplace')}</h3>
            <p className="text-[11px] text-slate-400">{t('Buy, sell and rent verified student items with monitored campus handover points.')}</p>
          </div>
          <Link href={withCampusScope("/marketplace", scope)} className="text-[11px] font-semibold text-emerald-500">
            {t('Marketplace')} →
          </Link>
        </div>
        <MarketplacePreview />
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm">🩸 {t('Blood & Health Network')}</h3>
            <p className="text-[11px] text-slate-400">{t('Blood requests, donor matching and confidential counselling.')}</p>
          </div>
          <Link href={withCampusScope("/health?tab=donors", scope)} className="text-[11px] font-semibold text-emerald-500">
            {t('Blood & Health Network')} →
          </Link>
        </div>
        <HealthPreview />
      </Card>
    </section>
  );
}
