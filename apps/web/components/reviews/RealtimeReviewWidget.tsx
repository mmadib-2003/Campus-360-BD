// apps/web/components/reviews/RealtimeReviewWidget.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

interface ReviewItem {
  id: string;
  rating: number;
  title?: string;
  body: string;
  verified_participation: boolean;
  created_at: string;
}

export function RealtimeReviewWidget({
  universityId,
  targetType,
  targetId,
}: {
  universityId: string;
  targetType: string;
  targetId: string;
}) {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [avgRating, setAvgRating] = useState<number>(0);

  useEffect(() => {
    fetch(`/api/reviews?targetType=${targetType}&targetId=${targetId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setReviews(res.data.reviews || []);
          setAvgRating(Number(res.data.aggregate?.avg_rating || 0));
        }
      });

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const channel = supabase
      .channel(`reviews:${targetType}:${targetId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reviews',
          filter: `target_id=eq.${targetId}`,
        },
        (payload) => {
          const inserted = payload.new as ReviewItem;
          setReviews((prev) => [inserted, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [universityId, targetType, targetId]);

  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-sm">⭐ Real-Time Verified Reviews ({reviews.length})</h4>
        <span className="text-xs font-semibold text-emerald-400">
          Avg: {avgRating.toFixed(2)} / 5.00
        </span>
      </div>
      <div className="space-y-2">
        {reviews.map((r) => (
          <div key={r.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-400">{'★'.repeat(r.rating)}</span>
              {r.verified_participation && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px]">
                  ✓ Verified Participation
                </span>
              )}
            </div>
            {r.title && <div className="font-semibold">{r.title}</div>}
            <p className="text-slate-600 dark:text-slate-300">{r.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
