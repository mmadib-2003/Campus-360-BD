// apps/web/app/reviews/page.tsx
import React from 'react';
import { RealtimeReviewWidget } from '@/components/reviews/RealtimeReviewWidget';

export default function ReviewsFeedPage() {
  return (
    <div className="space-y-6">
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <h1 className="text-xl font-bold">⭐ Live Service Reviews / লাইভ রিভিউ</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Verified reviews for marketplace sellers, events, archive files, tutors, housing and dining. New reviews stream
          in instantly over Supabase Realtime, and aggregate ratings are maintained by a database trigger.
        </p>
      </div>
      <RealtimeReviewWidget
        universityId="00000000-0000-0000-0000-000000000000"
        targetType="LIBRARY"
        targetId="dddddddd-dddd-dddd-dddd-dddddddddddd"
      />
    </div>
  );
}
