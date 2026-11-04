'use client';

import React from 'react';
import Link from 'next/link';
import { useUi } from '@/lib/i18n-client';
import { useModuleList, useSession } from '@/lib/modules/client';
import { Badge, Card, ModuleHeader, SkeletonList, Stat } from '@/components/modules/ui';
import { getDemoUniversity } from '@/lib/modules/demo-data';
import { asArray } from '@/lib/render-safe';

export default function FeedPage() {
  const { locale, t } = useUi();
  const session = useSession();
  const listings = useModuleList('marketplace', { limit: 3, enabled: session.authenticated });
  const tickets = useModuleList('complaints', { limit: 3, enabled: session.authenticated });

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

  const profile = session.profile;
  const university = profile?.universities ? getDemoUniversity(profile.universities.code) : undefined;
  const universityName = university
    ? locale === 'bn'
      ? university.name_bn
      : university.name_en
    : profile?.universities?.code ?? 'CAMPUS';

  return (
    <div className="space-y-6">
      <ModuleHeader
        icon="🎓"
        title={t('Student Dashboard')}
        titleBn="শিক্ষার্থীর ড্যাশবোর্ড"
        blurb={t('Your campus at a glance')}
        live
        demo={session.demo}
      >
        <Badge tone="emerald">{universityName}</Badge>
        <Badge tone="teal">{t('Your campus only')}</Badge>
      </ModuleHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label={t('Verification status')} value={t('ID verified')} hint={t('Email verified')} />
        <Stat label={t('My tickets')} value={asArray(tickets.data).length} hint={t('Open')} tone="amber" />
        <Stat label={t('My listings')} value={asArray(listings.data).length} hint={t('Marketplace')} />
        <Stat label={t('Tenant isolation')} value="RLS" hint={t('Your campus only')} tone="emerald" />
      </div>

      <Card className="p-5 space-y-2">
        <h2 className="text-sm font-bold">{t('Welcome back')}, {profile?.full_name}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t('You are signed in with the')} <strong>{t(session.roles[0] === 'UNIVERSITY_ADMIN' ? 'University Admin' : session.roles[0] === 'FACULTY' ? 'Faculty / Staff' : session.roles[0] === 'ALUMNI' ? 'Alumni' : 'Student')}</strong> {t('role. Your modules and data are scoped to your university.')}
        </p>
        <p className="text-[11px] text-emerald-600 dark:text-emerald-400">{t("No other university's rows are visible.")}</p>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">{t('Open modules')}</h2>
          <Link href="/" className="text-[11px] text-emerald-500 hover:underline">
            {t('Campus Feed')} →
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { href: '/marketplace', label: t('Marketplace'), icon: '🛍️' },
            { href: '/civic', label: t('Civic Ticketing & Complaint Box'), icon: '🛡️' },
            { href: '/lost-found', label: t('Lost & Found'), icon: '🔍' },
            { href: '/health', label: t('Blood & Health Network'), icon: '🩸' },
            { href: '/housing', label: t('Hall & Off-Campus Housing'), icon: '🏢' },
            { href: '/dining', label: t('Cafeteria & Home Food'), icon: '🍛' },
            { href: '/skills', label: t('Skill Hub & Jobs'), icon: '🎓' },
            { href: '/events', label: t('Events & RSVPs'), icon: '📅' },
          ].map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/40 text-xs font-medium"
            >
              <span className="text-base" aria-hidden>
                {module.icon}
              </span>
              <span className="block mt-1">{module.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">{t('My tickets')}</h2>
          <Link href="/complaints/track" className="text-[11px] text-emerald-500 hover:underline">
            {t('Track a case')} →
          </Link>
        </div>
        {tickets.loading ? (
          <SkeletonList rows={2} />
        ) : (
          <Card className="p-4 text-xs space-y-2">
            <p className="text-slate-500 dark:text-slate-400">{t('Paste your ticket ID to see the live status timeline.')}</p>
            <Link
              href="/track/JU-CASE-2026-482913"
              className="inline-block px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 font-mono text-[11px]"
            >
              JU-CASE-2026-482913
            </Link>
          </Card>
        )}
      </section>
    </div>
  );
}
