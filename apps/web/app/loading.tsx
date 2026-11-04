// apps/web/app/loading.tsx
// Route-level loading state. Before this existed, navigating to a module
// rendered a blank white area until the first fetch resolved; now the same
// skeleton language is used everywhere (hero, stats, cards, list rows).
import React from 'react';
import { SkeletonGrid, SkeletonList, SkeletonStat } from '@/components/modules/ui';

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite" data-testid="route-loading">
      <div className="h-36 rounded-2xl skeleton-shimmer" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonStat key={index} />
        ))}
      </div>
      <SkeletonGrid rows={3} />
      <SkeletonList rows={2} />
    </div>
  );
}
