'use client';

import React from 'react';
import Link from 'next/link';
import { useUi } from '@/lib/i18n-client';
import { useApiList, useModuleList, useSession } from '@/lib/modules/client';
import { Badge, Card, ModuleHeader, SkeletonList, Stat } from '@/components/modules/ui';
import { asArray } from '@/lib/render-safe';

export default function FacultyPage() {
  const { t } = useUi();
  const session = useSession();
  const events = useModuleList('events', { limit: 4, enabled: session.authenticated });
  const tickets = useApiList('/api/civic/tickets', { table: 'complaints_public', enabled: session.authenticated });
  const slots = useModuleList('mentorship-slots', { limit: 4, enabled: session.authenticated });

  if (!session.loading && !session.authenticated) {
    return (
      <div className="max-w-md mx-auto my-16 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
        <h1 className="text-lg font-bold">{t('Session expired')}</h1>
        <p className="text-xs text-slate-500">{t('Please sign in again.')}</p>
        <Link href="/signin" className="inline-block px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold">
          {t('Sign In')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        icon="🏫"
        title={t('Faculty Dashboard')}
        titleBn="ফ্যাকাল্টির ড্যাশবোর্ড"
        blurb={t('Mentorship, notices and student support for your department.')}
        live
        demo={session.demo}
      >
        <Badge tone="emerald">{session.profile?.universities?.code ?? 'CAMPUS'}</Badge>
        <Badge tone="teal">{t('Faculty / Staff')}</Badge>
      </ModuleHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label={t('Notices')} value={asArray(events.data).length} hint={t('This week')} />
        <Stat label={t('My complaints')} value={asArray(tickets.data).length} hint={t('In queue')} tone="amber" />
        <Stat label={t('Mentorship sessions')} value={asArray(slots.data).length} hint={t('Open slots')} />
        <Stat label={t('Students advised')} value={24} hint={t('This semester')} tone="emerald" />
      </div>

      <Card className="p-4 space-y-2">
        <h2 className="text-sm font-bold">{t('Department notices')}</h2>
        {events.loading ? (
          <SkeletonList rows={2} />
        ) : asArray(events.data).length === 0 ? (
          <p className="text-xs text-slate-500">{t('No submissions waiting for review.')}</p>
        ) : (
          <ul className="space-y-2">
            {asArray(events.data).map((event) => (
              <li key={String(event.id)} className="text-xs flex items-center justify-between gap-2">
                <span className="font-medium">{String(event.title_en ?? event.title ?? '')}</span>
                <span className="text-slate-400">{String(event.venue_name ?? '')}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4 space-y-2">
        <h2 className="text-sm font-bold">{t('Mentorship sessions')}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">{t('Book a mentor, join a study circle and browse the archive.')}</p>
        <Link href="/mentorship" className="inline-block text-[11px] text-emerald-500 hover:underline">
          {t('Open modules')} →
        </Link>
      </Card>
    </div>
  );
}
