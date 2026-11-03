// apps/web/app/events/map/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { CampusGoogleMap, CampusEventPin } from '@/components/maps/CampusGoogleMap';

export default function LiveEventsMapPage() {
  const [events, setEvents] = useState<CampusEventPin[]>([]);

  useEffect(() => {
    fetch('/api/events')
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setEvents(res.data || []);
      });
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
      <CampusGoogleMap events={events} onCheckIn={handleCheckIn} />
    </div>
  );
}
