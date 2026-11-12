// apps/web/components/reviews/RealtimeReviewWidget.tsx
'use client';
import { useCampusScope } from '@/lib/use-campus-scope';
import { CampusBadge } from '@/components/CampusBadge';

import React, { useCallback, useEffect, useState } from 'react';
import { trySupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase-browser';
import { subscribeToTable } from '@/lib/realtime';
import { timeAgo } from '@/lib/utils';
import { Badge, Button, Card, EmptyState, Field, Input, Select, SkeletonList, useToast } from '@/components/modules/ui';
import { useSession } from '@/lib/modules/client';

interface ReviewItem {
  id: string;
  university_id?: string;
  rating: number;
  title?: string;
  body: string;
  verified_participation: boolean;
  created_at: string;
  author_id?: string;
}

const TARGET_TYPES = [
  'MARKETPLACE',
  'EVENT',
  'ARCHIVE_FILE',
  'TUTORING',
  'HOUSING',
  'LOST_AND_FOUND',
  'CLUBS',
  'HALL_DINING',
  'LIBRARY',
  'TRANSPORTATION',
];

export function RealtimeReviewWidget({
  universityId,
  targetType,
  targetId,
}: {
  universityId: string;
  targetType: string;
  targetId: string;
}) {
  const session = useSession();
  const { scope } = useCampusScope();
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [avgRating, setAvgRating] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState(targetType);
  const [target, setTarget] = useState(targetId);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pending, setPending] = useState(false);
  const [tick, setTick] = useState(0);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/reviews?targetType=${encodeURIComponent(type)}&targetId=${encodeURIComponent(target)}&scope=${scope === 'all' ? 'all_campuses' : 'my_campus'}`,
        { cache: 'no-store' }
      );
      const payload = await res.json();
      if (payload.success) {
        setReviews(payload.data.reviews ?? []);
        setAvgRating(Number(payload.data.aggregate?.avg_rating ?? 0));
      } else {
        setError(payload?.error?.message_en ?? 'Could not load reviews.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [type, target, scope]);

  useEffect(() => {
    load();
  }, [load, tick]);

  // Supabase Realtime: new reviews appear instantly on every open tab.
  // The helper registers .on() before .subscribe(), uses a unique topic per
  // effect run and calls removeChannel on cleanup (see lib/realtime.ts).
  useEffect(() => {
    const supabase = trySupabaseBrowser();
    if (!supabase) return;

    return subscribeToTable(
      supabase,
      'reviews',
      {
        // Re-read through the API so public cross-campus RLS cannot inject a
        // foreign row into this campus-local widget.
        onInsert: () => setTick((value) => value + 1),
        onError: (error) => console.warn('[campus360:realtime] review subscription failed', error),
      },
      {
        event: 'INSERT',
        filter: `target_id=eq.${target}`,
        topicBase: `campus360:reviews:${type}:${target}`,
      }
    );
  }, [type, target]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setPending(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: type,
          targetId: target,
          rating,
          title: title.trim() || undefined,
          body: body.trim(),
        }),
      });
      const payload = await res.json();
      if (!payload.success) {
        toast.show(payload?.error?.message_en ?? 'Could not post review.', 'rose');
        return;
      }
      setTitle('');
      setBody('');
      setTick((t) => t + 1);
      toast.show('Review published — it appears live for your campus.');
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Network error', 'rose');
    } finally {
      setPending(false);
    }
  }

  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((review) => Number(review.rating) === star).length,
  }));

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-bold text-sm">⭐ Real-Time Verified Reviews ({reviews.length})</h4>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Avg: {avgRating.toFixed(2)} / 5.00
            </span>
            <Badge tone="emerald">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> live
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="Review target type">
            <Select
              value={type}
              onChange={(event) => setType(event.target.value)}
              options={TARGET_TYPES.map((value) => ({ value, label: value.replace(/_/g, ' ') }))}
            />
          </Field>
          <Field label="Target id" hint="Paste the id of the listing, event, file or tutor.">
            <Input value={target} onChange={(event) => setTarget(event.target.value)} />
          </Field>
        </div>

        <div className="space-y-1">
          {distribution.map(({ star, count }) => (
            <div key={star} className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="w-8">{star}★</span>
              <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-amber-400"
                  style={{ width: `${reviews.length ? (count / reviews.length) * 100 : 0}%` }}
                />
              </div>
              <span className="w-6 text-right">{count}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h4 className="font-bold text-sm">Write a review</h4>
        {!session.authenticated && !session.loading ? (
          <p className="text-xs text-slate-400">
            <a href="/signin" className="text-emerald-500 font-semibold">
              Sign in
            </a>{' '}
            with your university email to review campus services.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-2">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  aria-label={`${star} star`}
                  onClick={() => setRating(star)}
                  className={`text-xl leading-none ${star <= rating ? 'text-amber-400' : 'text-slate-300 dark:text-slate-500'}`}
                >
                  ★
                </button>
              ))}
              <span className="text-[11px] text-slate-400 ml-1">{rating}/5</span>
            </div>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Headline (optional)"
              maxLength={140}
            />
            <textarea
              required
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="What was your experience? Mention condition, punctuality, safety…"
              className="w-full rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 min-h-[90px]"
            />
            <Button type="submit" loading={pending}>
              Publish review
            </Button>
          </form>
        )}
      </Card>

      {loading ? (
        <SkeletonList rows={2} />
      ) : error ? (
        <EmptyState icon="⚠️" title="Reviews unavailable" description={error} action={<Button onClick={() => setTick((t) => t + 1)}>Retry</Button>} />
      ) : reviews.length === 0 ? (
        <EmptyState icon="⭐" title="No reviews for this target yet" description="Be the first to review it — verified participation is detected automatically." />
      ) : (
        <div className="space-y-2">
          {reviews.map((review) => (
            <Card key={review.id} className="p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-500">{'★'.repeat(Number(review.rating))}</span>
                <CampusBadge universityId={review.university_id} />
                <div className="flex items-center gap-2">
                  {review.verified_participation && (
                    <Badge tone="emerald">✓ Verified participation</Badge>
                  )}
                  <span className="text-[10px] text-slate-400">{timeAgo(review.created_at)}</span>
                </div>
              </div>
              {review.title && <div className="font-semibold text-sm">{review.title}</div>}
              <p className="text-xs text-slate-600 dark:text-slate-300">{review.body}</p>
            </Card>
          ))}
        </div>
      )}

      {toast.node}
    </div>
  );
}
