// apps/web/app/events/map/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { CampusGoogleMap, CampusEventPin } from '@/components/maps/CampusGoogleMap';
import { SkeletonList } from '@/components/modules/ui';

export default function LiveEventsMapPage() {
  const [events, setEvents] = useState<CampusEventPin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/events')
      .then((r) => r.json())
      .then((res) => {
        if (!cancelled && res.success) setEvents(res.data || []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCheckIn(eventId: string, lat: number, lng: number) {
    await fetch(`/api/events/${eventId}/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng }),
    });
  }

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="space-y-3">
          <div className="h-64 rounded-2xl skeleton-shimmer" />
          <SkeletonList rows={2} />
        </div>
      ) : (
        <CampusGoogleMap events={events} onCheckIn={handleCheckIn} />
      )}
    </div>
  );
}
