// apps/web/components/maps/CampusGoogleMap.tsx
'use client';

import React from 'react';

export interface CampusEventPin {
  id: string;
  title_en: string;
  venue_name: string;
  formatted_address: string;
  text_directions_en: string;
  lat: number;
  lng: number;
  geofence_radius_m: number;
  live_override: 'AUTO' | 'FORCE_LIVE' | 'FORCE_ENDED';
  starts_at: string;
  ends_at: string;
}

export function CampusGoogleMap({
  events,
  onCheckIn,
}: {
  events: CampusEventPin[];
  onCheckIn?: (eventId: string, lat: number, lng: number) => void;
}) {
  const handleGeofenceCheckIn = (eventId: string) => {
    if (!navigator.geolocation || !onCheckIn) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      onCheckIn(eventId, pos.coords.latitude, pos.coords.longitude);
    });
  };

  return (
    <div
      role="region"
      aria-label="Interactive Google Map of university events with geofence check-in and text directions"
      className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-900"
    >
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-sm text-white">
            📍 Google Maps Live Campus Event Radar (BD Referrer-Restricted Key)
          </h3>
          <p className="text-xs text-slate-400">
            Accessible text directions provided alongside interactive pins & geofence circles.
          </p>
        </div>
      </div>

      <div className="divide-y divide-slate-800">
        {events.map((ev) => {
          const now = Date.now();
          const isLive =
            ev.live_override === 'FORCE_LIVE' ||
            (ev.live_override === 'AUTO' &&
              now >= new Date(ev.starts_at).getTime() &&
              now <= new Date(ev.ends_at).getTime());

          return (
            <div key={ev.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-white">{ev.title_en}</span>
                  {isLive && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold animate-pulse">
                      ● Happening Now
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300">
                  {ev.venue_name} ({ev.lat.toFixed(4)}, {ev.lng.toFixed(4)}) • Geofence: {ev.geofence_radius_m}m
                </p>
                <p className="text-xs text-slate-400">
                  Accessible Text Directions: {ev.text_directions_en}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${ev.lat},${ev.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-xs text-slate-200 hover:bg-slate-700"
                >
                  Get Directions
                </a>
                <button
                  type="button"
                  onClick={() => handleGeofenceCheckIn(ev.id)}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white"
                >
                  I&apos;m Here (Check-In)
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
