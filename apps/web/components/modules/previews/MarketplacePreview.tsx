// apps/web/components/modules/previews/MarketplacePreview.tsx
'use client';

import Link from 'next/link';
import { useRealtimeModuleList } from '@/lib/modules/client';
import { Badge, EmptyState, SkeletonList, statusTone } from '../ui';
import { formatBdt, timeAgo } from '@/lib/utils';

export default function MarketplacePreview() {
  const listings = useRealtimeModuleList('marketplace', { limit: 3 });

  if (listings.loading) return <SkeletonList rows={1} />;
  if (listings.data.length === 0) {
    return (
      <EmptyState
        icon="🛍️"
        title="No listings yet"
        description="Be the first to post a book, laptop or bicycle for your campus."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {listings.data.map((listing) => (
        <Link
          key={String(listing.id)}
          href="/marketplace"
          className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:border-emerald-500/40 border border-transparent transition text-xs space-y-1"
        >
          <div className="flex items-center justify-between gap-1">
            <Badge tone="emerald">{String(listing.kind)}</Badge>
            <Badge tone={statusTone(listing.status)}>{String(listing.status)}</Badge>
          </div>
          <div className="font-semibold line-clamp-2">{listing.title}</div>
          <div className="text-emerald-600 dark:text-emerald-400 font-bold">{formatBdt(listing.price_bdt)}</div>
          <div className="text-[10px] text-slate-400">{timeAgo(listing.created_at)}</div>
        </Link>
      ))}
    </div>
  );
}
