// apps/web/app/events/map/page.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CampusGoogleMap, CampusEventPin } from '@/components/maps/CampusGoogleMap';
import { CampusScopeToggle } from '@/components/CampusScopeToggle';
import { SkeletonList } from '@/components/modules/ui';
import { useApiList, useSession } from '@/lib/modules/client';
import type { CampusScope } from '@/lib/campus-scope';
import { useCampusScope } from '@/lib/use-campus-scope';
import { useAppStore } from '@/lib/store';

export default function LiveEventsMapPage() {
  const session = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { scope } = useCampusScope();
  const setListingScope = useAppStore((state) => state.setListingScope);

  function setScope(next: CampusScope) {
    const params = new URLSearchParams(searchParams.toString());
    const value = next === 'all' ? 'all_campuses' : 'my_campus';
    setListingScope(value);
    params.set('scope', value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="w-full max-w-full space-y-4 sm:space-y-6">
      <CampusScopeToggle scope={scope} onScopeChange={setScope} universityCode={session.profile?.universities?.code} />
      {session.loading ? (
        <SkeletonList rows={2} />
      ) : session.error && !session.authenticated ? (
        <p role="alert">Could not verify your account. Please retry from the header.</p>
      ) : !session.authenticated && scope !== 'all' ? (
        <p className="rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-700">
          <Link href="/signin" className="font-semibold text-emerald-600 underline">Sign in</Link>
          {' '}to see your campus, or select All Campuses to browse public events.
        </p>
      ) : (
        <>
          {/* A scope or identity change resets old pins while the next request loads. */}
          <EventMapResults key={`${scope}:${session.userId ?? 'guest'}`} scope={scope} />
        </>
      )}
    </div>
  );
}

function EventMapResults({ scope }: { scope: CampusScope }) {
  // Forward the URL scope to the API; the server verifies the profile and
  // adds the university filter for My Campus.
  const events = useApiList('/api/events', { table: 'events', query: { scope: scope === 'all' ? 'all_campuses' : 'my_campus' } });

  async function handleCheckIn(eventId: string, lat: number, lng: number) {
    await fetch(`/api/events/${eventId}/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng }),
    });
  }

  if (events.loading) return <SkeletonList rows={2} />;
  if (events.error) return <p role="alert" className="text-sm text-rose-600">{events.error}</p>;
  return <CampusGoogleMap events={events.data as CampusEventPin[]} onCheckIn={handleCheckIn} />;
}
