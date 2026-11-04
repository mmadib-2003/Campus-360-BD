'use client';

import React from 'react';
import { useUi } from '@/lib/i18n-client';
import { useSession } from '@/lib/modules/client';
import { getActiveDemoUniversity } from '@/lib/modules/demo-data';
import { RealtimeReviewWidget } from '@/components/reviews/RealtimeReviewWidget';

export default function ReviewsFeedPage() {
  const { t } = useUi();
  const session = useSession();
  const universityId = session.profile?.university_id ?? getActiveDemoUniversity().id;

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <h1 className="text-xl font-bold">⭐ {t('Live Service Reviews')}</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {t('Verified reviews of campus services, updated live.')}
        </p>
      </div>
      <RealtimeReviewWidget universityId={universityId} targetType="LIBRARY" targetId="dddddddd-dddd-dddd-dddd-dddddddddddd" />
    </div>
  );
}
