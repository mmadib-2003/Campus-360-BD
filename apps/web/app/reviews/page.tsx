// apps/web/app/reviews/page.tsx
import React from 'react';
import { RealtimeReviewWidget } from '@/components/reviews/RealtimeReviewWidget';

export default function ReviewsFeedPage() {
  return (
    <div className="space-y-6">
      <RealtimeReviewWidget
        universityId="00000000-0000-0000-0000-000000000000"
        targetType="LIBRARY"
        targetId="dddddddd-dddd-dddd-dddd-dddddddddddd"
      />
    </div>
  );
}
