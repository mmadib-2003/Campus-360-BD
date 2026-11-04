// apps/web/app/mentorship/page.tsx
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
  SectionHeader,
  Select,
  SignInPrompt,
  SkeletonList,
  Stat,
  statusTone,
  useToast,
} from '@/components/modules/ui';
import { ModuleForm } from '@/components/modules/ModuleForm';
import { useModuleMutation, useRealtimeModuleList, useSession, Row } from '@/lib/modules/client';
import { useUi } from '@/lib/i18n-client';
import { CampusBadge } from '@/components/CampusBadge';
import { formatDateTime, timeAgo, toStringArray} from '@/lib/utils';
import { asArray } from '@/lib/render-safe';

export default function MentorshipPage() {
  const session = useSession();
  const { t } = useUi();
  const [offerOpen, setOfferOpen] = React.useState(false);
  const [slotOpen, setSlotOpen] = React.useState(false);
  const [bookingTarget, setBookingTarget] = React.useState<Row | null>(null);
  const toast = useToast();

  const mentors = useRealtimeModuleList('mentors', { limit: 50 });
  const slots = useRealtimeModuleList('mentorship-slots', { limit: 60 });
  const bookings = useRealtimeModuleList('mentorship-bookings', { limit: 40, enabled: !!session.authenticated });
  const mentorMutation = useModuleMutation('mentors');
  const slotMutation = useModuleMutation('mentorship-slots');
  const bookingMutation = useModuleMutation('mentorship-bookings');

  const myBookings = React.useMemo(
    () => asArray(bookings.data).filter((booking) => String(booking.mentee_id) === String(session.userId)),
    [bookings.data, session.userId]
  );

  const available = React.useMemo(
    () =>
      slots.data
        .filter((slot) => slot.is_active !== false && Number(slot.booked_count ?? 0) < Number(slot.capacity ?? 1))
        .sort((a, b) => new Date(String(a.starts_at)).getTime() - new Date(String(b.starts_at)).getTime()),
    [slots.data]
  );

  async function saveMentor(values: Row) {
    const result = await mentorMutation.create(values);
    if (result.ok) {
      setOfferOpen(false);
      mentors.refresh();
      toast.show('Mentor profile published.');
      return { ok: true };
    }
    return { ok: false, error: result.error };
  }

  async function createSlot(values: Row) {
    const result = await slotMutation.create(values);
    if (result.ok) {
      setSlotOpen(false);
      slots.refresh();
      toast.show('Session slot published — juniors can now book it.');
      return { ok: true };
    }
    return { ok: false, error: result.error };
  }

  async function book(slot: Row, message: string) {
    const result = await bookingMutation.create({
      slot_id: slot.id,
      mentor_id: slot.mentor_id,
      message,
    });
    if (result.ok) {
      setBookingTarget(null);
      bookings.refresh();
      slots.refresh();
      toast.show('Session requested — the mentor sees it live.');
      return { ok: true };
    }
    toast.show(result.error ?? 'Could not book session.', 'rose');
    return { ok: false };
  }


  const mentorOptions = asArray(mentors.data).map((mentor) => ({
    value: String(mentor.id),
    label: `${(mentor.profiles as Row)?.full_name ?? 'Mentor'} — ${mentor.headline}`,
  }));

  return (
    <div className="space-y-6">
      <ModuleHeader
        icon="📖"
        title="Academic Archive & Mentorship"
        titleBn="একাডেমিক আর্কাইভ ও মেন্টরশিপ"
        blurb="Juniors schedule sessions with seniors using real-time calendar availability. Files stay in the virus-scanned archive; guidance happens here."
        live
        demo={mentors.demo}
      >
        <Link
          href="/archive"
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-100 border border-slate-700"
        >
          📚 Open archive
        </Link>
        <Button variant="secondary" onClick={() => setOfferOpen(true)}>
          Become a mentor
        </Button>
        <Button onClick={() => setSlotOpen(true)}>+ Offer a slot</Button>
      </ModuleHeader>
      {/* Browsing is public now, so the sign-in path sits *below* the listings
          instead of replacing them: guests read, members post, book and chat. */}
      {!session.authenticated && <SignInPrompt moduleName="mentorship" />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Active mentors" value={asArray(mentors.data).length} />
        <Stat label="Open slots" value={available.length} tone="teal" />
        <Stat label="My sessions" value={myBookings.length} tone="amber" />
        <Stat
          label="Free sessions"
          value={asArray(mentors.data).filter((mentor) => Number(mentor.session_rate_bdt ?? 0) === 0).length}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <SectionHeader icon="🗓️" title="Available mentorship slots" subtitle="Updates instantly when someone books" />
          {slots.loading ? (
            <SkeletonList rows={3} />
          ) : available.length === 0 ? (
            <EmptyState icon="🗓️" title="No open slots right now" description="Seniors publish slots during exam season. Check back soon, or become a mentor yourself." />
          ) : (
            <div className="space-y-2">
              {available.map((slot) => {
                const mentor = (slot.mentor_profiles as Row) ?? {};
                const places = Number(slot.capacity ?? 1) - Number(slot.booked_count ?? 0);
                return (
                  <Card key={String(slot.id)} className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="amber">{String(slot.topic)}</Badge>
                          <Badge tone={places > 0 ? 'emerald' : 'slate'}>{places} place(s) left</Badge>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          🧑‍🏫 {(mentor.profiles as Row)?.full_name ?? 'Senior mentor'} — {mentor.headline}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          📅 {formatDateTime(slot.starts_at)} → {formatDateTime(slot.ends_at)}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        disabled={places <= 0}
                        onClick={() => setBookingTarget(slot)}
                      >
                        {places > 0 ? 'Request session' : 'Full'}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {myBookings.length > 0 && (
            <section className="space-y-2">
              <SectionHeader icon="✅" title="My sessions" subtitle="Live status from your mentor" />
              {myBookings.map((booking) => (
                <Card key={String(booking.id)} className="p-3 text-xs flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{booking.message || 'Mentorship session'}</div>
                    <div className="text-slate-400">{timeAgo(booking.created_at)}</div>
                  </div>
                  <Badge tone={statusTone(booking.status)}>{String(booking.status)}</Badge>
                </Card>
              ))}
            </section>
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-4 space-y-2">
            <SectionHeader icon="🧑‍🏫" title="Mentor directory" subtitle="Seniors who can help" />
            {asArray(mentors.data).length === 0 && <p className="text-xs text-slate-400">No mentors yet — be the first.</p>}
            {asArray(mentors.data).map((mentor) => (
              <div key={String(mentor.id)} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{(mentor.profiles as Row)?.full_name ?? 'Mentor'}</span>
                  <Badge tone={mentor.is_accepting ? 'emerald' : 'slate'}>
                    {mentor.is_accepting ? 'Accepting' : 'Paused'}
                  </Badge>
                  <CampusBadge universityId={mentor.university_id} />
                </div>
                <div className="text-slate-400">{mentor.headline}</div>
                <div className="flex flex-wrap gap-1">
                  {toStringArray(mentor.expertise).slice(0, 3).map((tag) => (
                    <span key={tag} className="px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700 text-[10px]">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="text-[10px] text-slate-500">
                  ⭐ {Number(mentor.rating ?? 0).toFixed(1)} • {mentor.sessions_count ?? 0} sessions •{' '}
                  {Number(mentor.session_rate_bdt ?? 0) === 0 ? 'Free' : `৳${mentor.session_rate_bdt}`}
                </div>
              </div>
            ))}
          </Card>

          <Card className="p-4 space-y-2 text-xs">
            <SectionHeader icon="📚" title="Archive integration" />
            <p className="text-slate-500 dark:text-slate-400">
              Discuss the exact lecture sheet or past question during your session — attach the archive file id when you
              request the slot.
            </p>
            <Link href="/archive" className="text-emerald-500 font-semibold">
              Browse the archive →
            </Link>
          </Card>
        </div>
      </div>

      <Modal open={offerOpen} onClose={() => setOfferOpen(false)} title="Publish a mentor profile" wide>
        <ModuleForm
          moduleKey="mentors"
          omit={['rating', 'sessions_count']}
          submitLabel="Publish mentor profile"
          onSubmit={saveMentor}
          onCancel={() => setOfferOpen(false)}
        />
      </Modal>

      <Modal open={slotOpen} onClose={() => setSlotOpen(false)} title="Offer a mentorship slot" wide>
        <ModuleForm
          moduleKey="mentorship-slots"
          options={{ mentor_id: mentorOptions }}
          omit={['booked_count']}
          submitLabel="Publish slot"
          onSubmit={createSlot}
          onCancel={() => setSlotOpen(false)}
        />
      </Modal>

      {bookingTarget && (
        <BookingModal slot={bookingTarget} onClose={() => setBookingTarget(null)} onSubmit={book} />
      )}

      {toast.node}
    </div>
  );
}

function BookingModal({
  slot,
  onClose,
  onSubmit,
}: {
  slot: Row;
  onClose: () => void;
  onSubmit: (slot: Row, message: string) => Promise<{ ok: boolean }>;
}) {
  const [message, setMessage] = React.useState('');
  const [pending, setPending] = React.useState(false);

  return (
    <Modal
      open
      onClose={onClose}
      title={`Request session — ${slot.topic}`}
      footer={
        <Button
          loading={pending}
          onClick={async () => {
            setPending(true);
            await onSubmit(slot, message);
            setPending(false);
          }}
        >
          Send request
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          📅 {formatDateTime(slot.starts_at)} • {Number(slot.capacity ?? 1) - Number(slot.booked_count ?? 0)} place(s) left
        </div>
        <Field label="What do you need help with?">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 min-h-[100px]"
            placeholder="I am stuck on dynamic programming and have my mid-term next week."
          />
        </Field>
      </div>
    </Modal>
  );
}
