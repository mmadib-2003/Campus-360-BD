'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useUi } from '@/lib/i18n-client';
import { useApiList, useModuleList, useSession } from '@/lib/modules/client';
import { Badge, Card, ModuleHeader, SkeletonList, SkeletonStat, Stat } from '@/components/modules/ui';
import { getDemoUniversity } from '@/lib/modules/demo-data';
import { asArray } from '@/lib/render-safe';
import { useCampusScope } from '@/lib/use-campus-scope';
import { CampusScopeToggle } from '@/components/CampusScopeToggle';
import { withCampusScope } from '@/lib/campus-scope';
import { StaggerGroup, StaggerItem, cardHover } from '@/components/motion/Stagger';

export default function FeedPage() {
  const { locale, t } = useUi();
  const session = useSession();
  const { scope } = useCampusScope();
  const listings = useModuleList('marketplace', { limit: 3, enabled: session.authenticated, campusLocal: true });
  const tickets = useApiList('/api/complaints', { table: 'complaints_public', enabled: session.authenticated });

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

  const roles = session.roles.map((role) => role.toUpperCase());
  const dashboard = session.isAdmin ? { icon: '🛡️', title: 'Admin Dashboard' }
    : roles.includes('FACULTY') ? { icon: '👨‍🏫', title: 'Faculty Dashboard' }
    : roles.includes('ALUMNI') ? { icon: '🏛️', title: 'Alumni Dashboard' }
    : { icon: '🎓', title: 'Student Dashboard' };

  return (
    <div className="space-y-6">
      <ModuleHeader
        icon={dashboard.icon}
        title={t(dashboard.title)}
        blurb={t(scope === 'all' ? 'Showing public listings across supported universities.' : 'Showing listings and activity for your university only.')}
        live
        demo={session.demo}
      >
        <Badge tone="emerald">{universityName}</Badge>
        <CampusScopeToggle universityCode={profile?.universities?.code} />
      </ModuleHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {session.loading || listings.loading || tickets.loading ? (
          Array.from({ length: 4 }).map((_, index) => <SkeletonStat key={index} />)
        ) : (
          <>
            <Stat label={t('Verification status')} value={t('ID verified')} hint={t('Email verified')} />
            <Stat label={t('My tickets')} value={asArray(tickets.data).length} hint={t('Open')} tone="amber" />
            <Stat label={t('My listings')} value={asArray(listings.data).length} hint={t('Marketplace')} />
            <Stat label={t('Tenant isolation')} value="RLS" hint={t('Your campus only')} tone="emerald" />
          </>
        )}
      </div>

      <Card className="p-5 space-y-2">
        <h2 className="text-sm font-bold">{t('Welcome back')}, {profile?.full_name}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t('You are signed in with the')} <strong>{t(session.roles[0] === 'UNIVERSITY_ADMIN' ? 'University Admin' : session.roles[0] === 'FACULTY' ? 'Faculty / Staff' : session.roles[0] === 'ALUMNI' ? 'Alumni' : 'Student')}</strong> {t('role. Private records remain protected.')}
        </p>
        <p className="text-[11px] text-emerald-600 dark:text-emerald-400">{t('Public listings follow the selected university scope.')}</p>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">{t('Open modules')}</h2>
          <Link href={withCampusScope("/", scope)} className="text-[11px] text-emerald-500 hover:underline">
            {t('Campus Feed')} →
          </Link>
        </div>
        <StaggerGroup className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
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
            <StaggerItem key={module.href} className="h-full">
              <motion.div {...cardHover} className="h-full">
                <Link
                  href={withCampusScope(module.href, scope)}
                  className="group card-glow flex h-full min-h-[44px] flex-col rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 p-3 text-xs font-medium"
                >
                  <span className="text-base transition-transform duration-200 group-hover:scale-110" aria-hidden>
                    {module.icon}
                  </span>
                  <span className="block mt-1">{module.label}</span>
                </Link>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerGroup>
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
        ) : tickets.error ? (
          <Card className="p-4 text-xs text-rose-500">{t('Could not load tickets. Please try again.')}</Card>
        ) : asArray(tickets.data).length ? (
          <div className="grid gap-2">
            {asArray(tickets.data).slice(0, 3).map((ticket) => (
              <Card key={String(ticket.id)} className="p-4 text-xs space-y-1">
                <p className="font-semibold">{String(ticket.title ?? '')}</p>
                <p className="text-slate-500">{String(ticket.tracking_code ?? '')} · {String(ticket.status ?? '')}</p>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-4 text-xs text-slate-500">{t('You have no tickets yet.')}</Card>
        )}
      </section>
    </div>
  );
}
