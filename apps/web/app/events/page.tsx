// apps/web/app/events/page.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  ModuleHeader,
  Progress,
  SectionHeader,
  Select,
  SignInPrompt,
  SkeletonList,
  Stat,
  statusTone,
  useToast,
} from '@/components/modules/ui';
import { useApiList, useModuleMutation, useRealtimeModuleList, useRealtimeTable, useSession, Row } from '@/lib/modules/client';
import { formatDateTime, timeAgo } from '@/lib/utils';
import { useUi } from '@/lib/i18n-client';
import { CampusBadge } from '@/components/CampusBadge';
import { useCampusScope } from '@/lib/use-campus-scope';
import { asArray } from '@/lib/render-safe';

export default function EventsPage() {
  const session = useSession();
  const { scope } = useCampusScope();
  const { t } = useUi();
  const events = useApiList('/api/events', { table: 'events', enabled: !!session.authenticated });
  const rows = events.data;
  const { loading, demo, error, refresh } = events;
  const setRows = events.setData;
  const clubs = useRealtimeModuleList('clubs', {});
  const rsvps = useRealtimeModuleList('event-rsvps', { limit: 100, enabled: !!session.authenticated });
  const notices = useRealtimeModuleList('club-notices', { limit: 20 });
  const rsvpMutation = useModuleMutation('event-rsvps');
  const clubMutation = useModuleMutation('club-members');
  const noticeMutation = useModuleMutation('club-notices');
  const clubCreateMutation = useModuleMutation('clubs');
  const [createEventOpen, setCreateEventOpen] = React.useState(false);
  const [activeClub, setActiveClub] = React.useState<Row | null>(null);
  const [createClubOpen, setCreateClubOpen] = React.useState(false);
  const [rsvping, setRsvping] = React.useState<string | null>(null);
  const toast = useToast();

  // Realtime: RSVP inserts/updates change attendee counts on every open tab.
  useRealtimeTable(
    'event_rsvps',
    {
      onInsert: (row) => {
        setRows((prev) =>
          prev.map((event) =>
            String(event.id) === String(row.event_id)
              ? { ...event, rsvp_count: Number(event.rsvp_count ?? 0) + (row.status === 'GOING' ? 1 : 0) }
              : event
          )
        );
      },
      onUpdate: (row) => {
        setRows((prev) => prev.map((event) => (String(event.id) === String(row.event_id) ? { ...event } : event)));
      },
    },
    { enabled: !!session.authenticated && !demo }
  );

  const myRsvps = React.useMemo(() => {
    const map = new Map<string, string>();
    asArray(rsvps.data).forEach((rsvp) => {
      if (String(rsvp.user_id) === String(session.userId)) map.set(String(rsvp.event_id), String(rsvp.status));
    });
    return map;
  }, [rsvps.data, session.userId]);

  const grouped = React.useMemo(() => {
    const upcoming = rows
      .filter((event) => new Date(String(event.ends_at ?? event.starts_at)).getTime() >= Date.now() - 3600_000)
      .sort((a, b) => new Date(String(a.starts_at)).getTime() - new Date(String(b.starts_at)).getTime());
    const past = rows
      .filter((event) => new Date(String(event.ends_at ?? event.starts_at)).getTime() < Date.now() - 3600_000)
      .sort((a, b) => new Date(String(b.starts_at)).getTime() - new Date(String(a.starts_at)).getTime());
    return { upcoming, past };
  }, [rows]);

  async function rsvp(event: Row, status: 'GOING' | 'INTERESTED') {
    if (!session.authenticated) {
      toast.show('Sign in to RSVP.', 'amber');
      return;
    }
    setRsvping(String(event.id));
    const result = await rsvpMutation.create({ event_id: event.id, status });
    setRsvping(null);
    if (result.ok) {
      rsvps.refresh();
      setRows((prev) =>
        prev.map((item) =>
          String(item.id) === String(event.id)
            ? { ...item, rsvp_count: Number(item.rsvp_count ?? 0) + (status === 'GOING' ? 1 : 0) }
            : item
        )
      );
      toast.show(status === 'GOING' ? 'You are going — the organizer sees your RSVP live.' : 'Marked as interested.');
    } else {
      toast.show(result.error ?? 'Could not RSVP.', 'rose');
    }
  }

  async function joinClub(club: Row) {
    const result = await clubMutation.create({ club_id: club.id });
    if (result.ok) {
      toast.show(`Join request sent to ${club.name_en}.`);
      clubs.refresh();
    } else {
      toast.show(result.error ?? 'Could not join club.', 'rose');
    }
  }

  async function createEvent(values: Row) {
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const payload = await res.json();
      if (!payload.success) {
        if (session.demo) {
          const { demoInsert } = await import('@/lib/modules/demo-data');
          demoInsert('events', { ...values, rsvp_count: 0 });
          setCreateEventOpen(false);
          refresh();
          toast.show('Event added to the preview calendar.');
          return { ok: true };
        }
        return { ok: false, error: payload?.error?.message_en ?? 'Could not create event.' };
      }
      setCreateEventOpen(false);
      refresh();
      toast.show('Event published.');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  }


  return (
    <div className="space-y-6">
      <ModuleHeader
        icon="📅"
        title="Events & Club Connect"
        titleBn="ইভেন্ট ও ক্লাব কানেক্ট"
        blurb="Every departmental and club event in one real-time calendar. RSVP counts update live as classmates respond, and each club runs its own recruitment dashboard."
        live
        demo={demo}
      >
        <Link
          href={`/events/map?scope=${scope === 'all' ? 'all_campuses' : 'my_campus'}`}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-100 border border-slate-700"
        >
          📍 Live map
        </Link>
        <Button variant="secondary" onClick={() => setCreateClubOpen(true)}>
          + Create club
        </Button>
        <Button onClick={() => setCreateEventOpen(true)}>+ Create event</Button>
      </ModuleHeader>
      {/* Browsing is public now, so the sign-in path sits *below* the listings
          instead of replacing them: guests read, members post, book and chat. */}
      {!session.authenticated && <SignInPrompt moduleName="events and clubs" />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Upcoming events" value={grouped.upcoming.length} />
        <Stat label="Clubs active" value={asArray(clubs.data).length} />
        <Stat label="Recruiting clubs" value={asArray(clubs.data).filter((club) => club.is_recruiting).length} tone="amber" />
        <Stat
          label="My RSVPs"
          value={[...myRsvps.values()].filter((status) => status !== 'CANCELLED').length}
          tone="teal"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="space-y-3">
            <SectionHeader icon="🗓️" title="Real-time events calendar" subtitle="RSVP counts update instantly" />
            {loading ? (
              <SkeletonList rows={3} />
            ) : error ? (
              <EmptyState icon="⚠️" title="Could not load events" description={error} action={<Button onClick={refresh}>Retry</Button>} />
            ) : grouped.upcoming.length === 0 ? (
              <EmptyState icon="📅" title="No upcoming events" description="Create the first event for your campus." action={<Button onClick={() => setCreateEventOpen(true)}>Create event</Button>} />
            ) : (
              <div className="space-y-3">
                {grouped.upcoming.map((event) => {
                  const myStatus = myRsvps.get(String(event.id));
                  const capacity = Number(event.capacity ?? 0);
                  const going = Number(event.rsvp_count ?? 0);
                  return (
                    <Card key={String(event.id)} className="p-4 space-y-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="indigo">{String(event.category ?? 'EVENT')}</Badge>
                        <CampusBadge universityId={event.university_id} />
                        {event.is_public && <Badge tone="teal">Public</Badge>}
                        {Number(event.ticket_price_bdt ?? 0) > 0 ? (
                          <Badge tone="amber">৳{Number(event.ticket_price_bdt)} ticket</Badge>
                        ) : (
                          <Badge tone="emerald">Free entry</Badge>
                        )}
                        {myStatus && <Badge tone={statusTone(myStatus)}>You: {myStatus}</Badge>}
                        <span className="text-[11px] text-slate-400 ml-auto">{timeAgo(event.created_at)}</span>
                      </div>
                      <h3 className="font-bold text-sm">{event.title_en}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{event.description_en}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                        <span>📅 {formatDateTime(event.starts_at)}</span>
                        <span>📍 {event.venue_name}</span>
                        <span>🏛️ {event.host_organization}</span>
                      </div>
                      {capacity > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span>👥 {going} going</span>
                            <span>{capacity > 0 ? `${Math.max(0, capacity - going)} seats left` : 'Unlimited'}</span>
                          </div>
                          <Progress value={going} max={capacity} />
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Button size="sm" loading={rsvping === String(event.id)} onClick={() => rsvp(event, 'GOING')}>
                          {myStatus === 'GOING' ? '✓ Going' : 'RSVP — I’m going'}
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => rsvp(event, 'INTERESTED')}>
                          Interested
                        </Button>
                        <Link
                          href={`/events/map?event=${event.id}&scope=${scope === 'all' ? 'all_campuses' : 'my_campus'}`}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700"
                        >
                          📍 Directions & check-in
                        </Link>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {grouped.past.length > 0 && (
            <section className="space-y-2">
              <SectionHeader icon="🕘" title="Past events" subtitle="Rate the ones you attended" />
              {grouped.past.slice(0, 5).map((event) => (
                <Card key={String(event.id)} className="p-3 text-xs flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{event.title_en}</div>
                    <div className="text-slate-400">{formatDateTime(event.starts_at)} • {event.venue_name}</div>
                  </div>
                  <Badge tone="slate">{Number(event.rsvp_count ?? 0)} attended</Badge>
                </Card>
              ))}
            </section>
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-4 space-y-2">
            <SectionHeader icon="🎭" title="Clubs & societies" subtitle="Live membership counters" />
            <div className="space-y-2">
              {asArray(clubs.data).map((club) => (
                <div key={String(club.id)} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-xs truncate">{club.name_en}</span>
                    {club.is_recruiting ? <Badge tone="emerald">Recruiting</Badge> : <Badge tone="slate">Closed</Badge>}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {club.category} • {Number(club.member_count ?? 0)} members
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    <Button size="sm" variant="secondary" onClick={() => joinClub(club)}>
                      Join
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setActiveClub(club)}>
                      Open dashboard
                    </Button>
                  </div>
                </div>
              ))}
              {asArray(clubs.data).length === 0 && <p className="text-xs text-slate-400">No clubs registered yet.</p>}
            </div>
          </Card>

          <Card className="p-4 space-y-2">
            <SectionHeader icon="📢" title="Club notices" subtitle="Newest first" />
            {asArray(notices.data).length === 0 ? (
              <p className="text-xs text-slate-400">No notices published.</p>
            ) : (
              asArray(notices.data).slice(0, 5).map((notice) => (
                <div key={String(notice.id)} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
                  <div className="font-semibold">{notice.title}</div>
                  <p className="text-slate-400 line-clamp-2">{notice.body}</p>
                  <div className="text-[10px] text-slate-500 mt-1">{timeAgo(notice.created_at)}</div>
                </div>
              ))
            )}
          </Card>
        </div>
      </div>

      <Modal open={createEventOpen} onClose={() => setCreateEventOpen(false)} title="Create a campus event" wide>
        <EventForm onSubmit={createEvent} onCancel={() => setCreateEventOpen(false)} />
      </Modal>

      <Modal open={createClubOpen} onClose={() => setCreateClubOpen(false)} title="Register a club or society" wide>
        <ModuleFormForClub
          onSubmit={async (values) => {
            const result = await clubCreateMutation.create(values);
            if (result.ok) {
              setCreateClubOpen(false);
              clubs.refresh();
              toast.show('Club registered — students can join it now.');
              return { ok: true };
            }
            return { ok: false, error: result.error };
          }}
          onCancel={() => setCreateClubOpen(false)}
        />
      </Modal>

      {activeClub && (
        <ClubDashboard
          club={activeClub}
          onClose={() => setActiveClub(null)}
          notices={asArray(notices.data).filter((notice) => String(notice.club_id) === String(activeClub.id))}
          onNotice={async (values) => {
            const result = await noticeMutation.create({ ...values, club_id: activeClub.id });
            if (result.ok) {
              notices.refresh();
              toast.show('Notice published.');
              return { ok: true };
            }
            toast.show(result.error ?? 'Could not publish.', 'rose');
            return { ok: false };
          }}
        />
      )}

      {toast.node}
    </div>
  );
}

function EventForm({ onSubmit, onCancel }: { onSubmit: (values: Row) => Promise<{ ok: boolean; error?: string }>; onCancel: () => void }) {
  const [values, setValues] = React.useState<Row>({
    titleEn: '',
    titleBn: '',
    descriptionEn: '',
    hostOrganization: '',
    category: 'Technology',
    startsAt: '',
    endsAt: '',
    venueName: '',
    formattedAddress: 'Jahangirnagar University, Savar, Dhaka',
    textDirectionsEn: '',
    lat: '',
    lng: '',
    placeId: '',
    capacity: '',
    isPublic: true,
    geofenceRadiusM: 150,
  });
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  function set(key: string, value: unknown) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!values.titleEn || !values.startsAt || !values.endsAt || !values.venueName || !values.lat || !values.lng) {
          setError('Title, start, end, venue, latitude and longitude are required.');
          return;
        }
        setPending(true);
        const result = await onSubmit(values);
        setPending(false);
        if (!result.ok) setError(result.error ?? 'Could not create event.');
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Title (English)">
          <Input value={values.titleEn} onChange={(e) => set('titleEn', e.target.value)} />
        </Field>
        <Field label="Title (বাংলা)">
          <Input value={values.titleBn} onChange={(e) => set('titleBn', e.target.value)} />
        </Field>
        <Field label="Host organization">
          <Input value={values.hostOrganization} onChange={(e) => set('hostOrganization', e.target.value)} placeholder="CSE Society" />
        </Field>
        <Field label="Category">
          <Select
            value={values.category}
            onChange={(e) => set('category', e.target.value)}
            options={['Technology', 'Debate', 'Culture', 'Sports', 'Academic', 'Career'].map((value) => ({ value, label: value }))}
          />
        </Field>
        <Field label="Starts at">
          <Input type="datetime-local" value={values.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
        </Field>
        <Field label="Ends at">
          <Input type="datetime-local" value={values.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
        </Field>
        <Field label="Venue name">
          <Input value={values.venueName} onChange={(e) => set('venueName', e.target.value)} placeholder="TSC Auditorium" />
        </Field>
        <Field label="Capacity (optional)">
          <Input type="number" min={1} value={values.capacity} onChange={(e) => set('capacity', e.target.value)} />
        </Field>
        <Field label="Latitude">
          <Input value={values.lat} onChange={(e) => set('lat', e.target.value)} placeholder="23.8791" />
        </Field>
        <Field label="Longitude">
          <Input value={values.lng} onChange={(e) => set('lng', e.target.value)} placeholder="90.2674" />
        </Field>
      </div>
      <Field label="Description">
        <textarea
          value={values.descriptionEn}
          onChange={(e) => set('descriptionEn', e.target.value)}
          className="w-full rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 min-h-[90px]"
        />
      </Field>
      <Field label="Accessible text directions" hint="Shown to screen-reader users and as a fallback to the map.">
        <Input value={values.textDirectionsEn} onChange={(e) => set('textDirectionsEn', e.target.value)} placeholder="Enter through the main gate, walk 300m past the library." />
      </Field>
      <p className="text-[11px] text-slate-400">
        Google Places ID and geofence radius are stored for map pins and geofenced check-in (default 150 m).
      </p>
      {error && <p className="text-xs text-rose-500">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          Publish event
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ClubDashboard({
  club,
  notices,
  onClose,
  onNotice,
}: {
  club: Row;
  notices: Row[];
  onClose: () => void;
  onNotice: (values: Row) => Promise<{ ok: boolean }>;
}) {
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [pending, setPending] = React.useState(false);

  return (
    <Modal open onClose={onClose} title={`${club.name_en} — club dashboard`} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <Card className="p-3">
            <div className="text-lg font-extrabold">{Number(club.member_count ?? 0)}</div>
            <div className="text-[10px] text-slate-400">Members</div>
          </Card>
          <Card className="p-3">
            <div className="text-lg font-extrabold">{club.is_recruiting ? 'Open' : 'Closed'}</div>
            <div className="text-[10px] text-slate-400">Recruitment</div>
          </Card>
          <Card className="p-3">
            <div className="text-lg font-extrabold">{notices.length}</div>
            <div className="text-[10px] text-slate-400">Notices</div>
          </Card>
          <Card className="p-3">
            <div className="text-lg font-extrabold">{String(club.category ?? '—')}</div>
            <div className="text-[10px] text-slate-400">Category</div>
          </Card>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">{club.description_en}</p>

        <div className="space-y-2">
          <div className="font-semibold text-sm">Notices</div>
          {notices.length === 0 && <p className="text-xs text-slate-400">No notices yet.</p>}
          {notices.map((notice) => (
            <div key={String(notice.id)} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
              <div className="font-semibold">{notice.title}</div>
              <p className="text-slate-400">{notice.body}</p>
            </div>
          ))}
        </div>

        <div className="space-y-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="font-semibold text-sm">Publish a notice</div>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Notice title" />
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 min-h-[80px]"
            placeholder="Details for members…"
          />
          <Button
            size="sm"
            loading={pending}
            onClick={async () => {
              if (!title.trim()) return;
              setPending(true);
              const result = await onNotice({ title: title.trim(), body: body.trim() });
              setPending(false);
              if (result.ok) {
                setTitle('');
                setBody('');
              }
            }}
          >
            Publish notice
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ModuleFormForClub({
  onSubmit,
  onCancel,
}: {
  onSubmit: (values: Row) => Promise<{ ok: boolean; error?: string }>;
  onCancel: () => void;
}) {
  const [values, setValues] = React.useState<Row>({
    name_en: '',
    name_bn: '',
    category: 'Technology',
    description_en: '',
    is_recruiting: true,
    contact_email: '',
  });
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const set = (key: string, value: unknown) => setValues((prev) => ({ ...prev, [key]: value }));

  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        const result = await onSubmit(values);
        setPending(false);
        if (!result.ok) setError(result.error ?? 'Could not register club.');
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Club name (English)">
          <Input required value={values.name_en} onChange={(event) => set('name_en', event.target.value)} />
        </Field>
        <Field label="Club name (বাংলা)">
          <Input value={values.name_bn} onChange={(event) => set('name_bn', event.target.value)} />
        </Field>
        <Field label="Category">
          <Select
            value={values.category}
            onChange={(event) => set('category', event.target.value)}
            options={['Technology', 'Debate', 'Culture', 'Sports', 'Arts', 'Volunteering'].map((value) => ({ value, label: value }))}
          />
        </Field>
        <Field label="Contact email">
          <Input type="email" value={values.contact_email} onChange={(event) => set('contact_email', event.target.value)} />
        </Field>
      </div>
      <Field label="About the club">
        <textarea
          required
          value={values.description_en}
          onChange={(event) => set('description_en', event.target.value)}
          className="w-full rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 min-h-[90px]"
        />
      </Field>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={Boolean(values.is_recruiting)} onChange={(event) => set('is_recruiting', event.target.checked)} />
        <span>Recruiting new members now</span>
      </label>
      {error && <p className="text-xs text-rose-500">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          Register club
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
