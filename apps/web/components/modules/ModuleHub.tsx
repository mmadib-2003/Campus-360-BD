// apps/web/components/modules/ModuleHub.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { MODULE_META } from '@/lib/modules/labels';
import dynamic from 'next/dynamic';
import { useSession } from '@/lib/modules/client';
import { Badge, Card, SkeletonList } from './ui';

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

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">Campus360 Interactive Modules</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Twelve real-time modules — every status change, RSVP, ticket and match updates live via Supabase Realtime.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="emerald">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE
          </Badge>
          {session.demo && <Badge tone="amber">Preview data</Badge>}
          {session.profile?.universities?.code && <Badge tone="slate">{session.profile.universities.code}</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {ORDER.map((key) => {
          const meta = MODULE_META[key];
          if (!meta) return null;
          return (
            <Link
              key={key}
              href={meta.href}
              className="group p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 hover:shadow-md transition"
            >
              <div className="flex items-start gap-3">
                <span className="h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center text-lg shrink-0">
                  {meta.icon}
                </span>
                <div className="min-w-0">
                  <div className="font-semibold text-sm group-hover:text-emerald-500 transition truncate">
                    {meta.title}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">{meta.titleBn}</div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{meta.blurb}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm">🛍️ Fresh on the marketplace</h3>
            <p className="text-[11px] text-slate-400">Live listings from your university — updates without refresh.</p>
          </div>
          <Link href="/marketplace" className="text-[11px] font-semibold text-emerald-500">
            Open marketplace →
          </Link>
        </div>
        <MarketplacePreview />
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm">🩸 Smart Blood Bank — open requests</h3>
            <p className="text-[11px] text-slate-400">Broadcasts reach matching donors instantly.</p>
          </div>
          <Link href="/health?tab=donors" className="text-[11px] font-semibold text-emerald-500">
            Open blood bank →
          </Link>
        </div>
        <HealthPreview />
      </Card>
    </section>
  );
}
