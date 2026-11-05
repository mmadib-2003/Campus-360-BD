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

function isEventLive(ev: CampusEventPin, now: number): boolean {
  return (
    ev.live_override === 'FORCE_LIVE' ||
    (ev.live_override === 'AUTO' &&
      now >= new Date(ev.starts_at).getTime() &&
      now <= new Date(ev.ends_at).getTime())
  );
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

  const now = Date.now();
  // Centre the radar on the first live event, else the first scheduled one.
  const focus = events.find((ev) => isEventLive(ev, now)) ?? events[0];
  const mapSrc = focus
    ? `https://maps.google.com/maps?q=${focus.lat},${focus.lng}&z=15&output=embed`
    : null;

  return (
    <div
      role="region"
      aria-label="Interactive Google Map of university events with geofence check-in and text directions"
      className="space-y-4"
    >
      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-900">
        <h3 className="font-bold text-sm text-white">
          📍 Google Maps Live Campus Event Radar (BD Referrer-Restricted Key)
        </h3>
        <p className="text-xs text-slate-400">
          Accessible text directions provided alongside interactive pins & geofence circles.
        </p>
      </div>

      {/* Map on top, event list below on mobile; side-by-side from lg. */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="h-[50dvh] sm:h-[65dvh] w-full lg:flex-1 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900">
          {mapSrc ? (
            <iframe
              key={focus?.id}
              src={mapSrc}
              title={`Google Map centred on ${focus?.venue_name ?? 'campus'}`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
              className="h-full w-full border-0"
            />
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center gap-2 p-6 text-center">
              <span className="text-3xl" aria-hidden>📍</span>
              <p className="text-sm font-semibold text-white">No event pins yet</p>
              <p className="text-xs text-slate-400">
                The radar centres on your campus events as soon as they are published.
              </p>
            </div>
          )}
        </div>

        {/* Event list: full-width below the map on mobile, scrollable sidebar on lg. */}
        <div className="w-full lg:w-96 lg:shrink-0 lg:max-h-[65dvh] lg:overflow-y-auto overscroll-contain rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900 divide-y divide-slate-800">
          {events.length === 0 && (
            <p className="p-4 text-xs text-slate-400">No events to show for this scope yet.</p>
          )}
          {events.map((ev) => {
            const isLive = isEventLive(ev, now);
            return (
              <div key={ev.id} className="p-4 space-y-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm text-white break-words">{ev.title_en}</span>
                    {isLive && (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold animate-pulse">
                        ● Happening Now
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 break-words">
                    {ev.venue_name} ({ev.lat.toFixed(4)}, {ev.lng.toFixed(4)}) • Geofence: {ev.geofence_radius_m}m
                  </p>
                  <p className="text-xs text-slate-400 break-words">
                    Accessible Text Directions: {ev.text_directions_en}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${ev.lat},${ev.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-[44px] inline-flex items-center justify-center px-3 py-1.5 rounded-xl bg-slate-800 text-xs text-slate-200 hover:bg-slate-700"
                  >
                    Get Directions
                  </a>
                  <button
                    type="button"
                    onClick={() => handleGeofenceCheckIn(ev.id)}
                    className="min-h-[44px] inline-flex items-center justify-center px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white"
                  >
                    I&apos;m Here (Check-In)
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
