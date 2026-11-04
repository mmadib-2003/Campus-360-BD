// apps/web/app/health/page.tsx
'use client';

import React from 'react';
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
import { useModuleMutation, useRealtimeModuleList, useRealtimeTable, useSession, Row } from '@/lib/modules/client';
import { isSupabaseConfigured } from '@/lib/supabase-browser';
import { readDemoRows, demoInsertRow } from '@/lib/modules/client';
import { formatDateTime, timeAgo } from '@/lib/utils';
import { useUi } from '@/lib/i18n-client';
import { CampusBadge } from '@/components/CampusBadge';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function HealthPage() {
  const session = useSession();
  const { t } = useUi();
  const [tab, setTab] = React.useState<'blood' | 'donors' | 'mental'>('blood');

  // Deep links from notifications: /health?tab=donors&group=O%2B
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('tab');
    if (requested === 'donors' || requested === 'mental' || requested === 'blood') setTab(requested);
    const group = params.get('group');
    if (group && BLOOD_GROUPS.includes(group.toUpperCase())) setBloodGroup(group.toUpperCase());
  }, []);
  const [bloodGroup, setBloodGroup] = React.useState('ALL');
  const [requestOpen, setRequestOpen] = React.useState(false);
  const [donorOpen, setDonorOpen] = React.useState(false);
  const [respondTarget, setRespondTarget] = React.useState<Row | null>(null);
  const [counselSlot, setCounselSlot] = React.useState<Row | null>(null);
  const [bookedRef, setBookedRef] = React.useState<{ bookingRef: string; retrievalToken: string } | null>(null);
  const toast = useToast();

  const requests = useRealtimeModuleList('blood-requests', {
    filters: { blood_group: bloodGroup },
    limit: 50,
    enabled: !!session.authenticated,
  });
  const donors = useModuleListDonors(bloodGroup, session);
  const contacts = useRealtimeModuleList('health-contacts', {});
  const slots = useRealtimeModuleList('counseling-slots', { enabled: !!session.authenticated });
  const requestsMutation = useModuleMutation('blood-requests');
  const responsesMutation = useModuleMutation('blood-responses');
  const donorMutation = useModuleMutation('donors');

  /** Emergency broadcast banner when a new critical request is posted. */
  const [broadcast, setBroadcast] = React.useState<Row | null>(null);
  useRealtimeTable(
    'blood_requests',
    {
      onInsert: (row) => {
        setBroadcast(row);
        setTimeout(() => setBroadcast(null), 12000);
      },
    },
    { enabled: !!session.authenticated && isSupabaseConfigured() }
  );

  async function createRequest(values: Row) {
    const result = await requestsMutation.create(values);
    if (result.ok) {
      setRequestOpen(false);
      requests.refresh();
      toast.show('Emergency request broadcast to matching donors.');
      return { ok: true };
    }
    return { ok: false, error: result.error };
  }

  async function respond(values: Row) {
    if (!respondTarget) return { ok: false };
    const result = await responsesMutation.create({ request_id: respondTarget.id, message: values.message });
    if (result.ok) {
      setRespondTarget(null);
      toast.show('The requester has been told you can donate.');
      return { ok: true };
    }
    toast.show(result.error ?? 'Could not respond.', 'rose');
    return { ok: false };
  }

  async function registerDonor(values: Row) {
    if (!isSupabaseConfigured()) {
      demoInsertRow('health_donors', {
        user_id: session.userId,
        blood_group: values.blood_group,
        is_available: true,
        verified_donations_count: 0,
        profiles: { full_name: session.profile?.full_name ?? 'You' },
      });
      setDonorOpen(false);
      donors.refresh();
      toast.show('Donor profile saved (preview).');
      return { ok: true };
    }
    const res = await fetch('/api/health/blood', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    const payload = await res.json();
    if (!payload.success) {
      toast.show(payload?.error?.message_en ?? 'Could not save donor profile.', 'rose');
      return { ok: false };
    }
    setDonorOpen(false);
    donors.refresh();
    toast.show('You are now in the Smart Blood Bank.');
    return { ok: true };
  }

  async function bookCounselling(payload: Row) {
    if (!counselSlot) return;
    try {
      if (!isSupabaseConfigured() || session.demo) {
        const ref = `CNS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        setBookedRef({ bookingRef: ref, retrievalToken: 'preview-token' });
        setCounselSlot(null);
        toast.show('Booking confirmed (preview). Keep your reference private.');
        return;
      }
      const res = await fetch('/api/health/counseling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot_id: counselSlot.id, ...payload }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.show(data?.error?.message_en ?? 'Could not book session.', 'rose');
        return;
      }
      setBookedRef({ bookingRef: data.data.bookingRef, retrievalToken: data.data.retrievalToken });
      setCounselSlot(null);
      slots.refresh();
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Network error', 'rose');
    }
  }

  if (!session.loading && !session.authenticated) {
    return (
      <div className="space-y-6">
        <ModuleHeader
          icon="🩸"
          title="Emergency, Mental & Physical Health"
          titleBn="জরুরি, মানসিক ও শারীরিক স্বাস্থ্য"
          blurb="Smart blood bank with emergency broadcasts, campus ambulance helplines and fully anonymous counselling."
        />
        <SignInPrompt moduleName="health services" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        icon="🩸"
        title="Emergency, Mental & Physical Health"
        titleBn="জরুরি, মানসিক ও শারীরিক স্বাস্থ্য"
        blurb="Smart Blood Bank with instant donor broadcasts, one-tap medical helplines, and anonymous counselling booking that never stores your identity."
        live
        demo={requests.demo}
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setDonorOpen(true)}>
            🩸 Become a donor
          </Button>
          <Button onClick={() => setRequestOpen(true)}>+ Request blood</Button>
        </div>
      </ModuleHeader>

      <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex flex-wrap items-center gap-3 text-xs">
        <span className="font-bold text-rose-600 dark:text-rose-300">Life-threatening emergency?</span>
        <a href="tel:999" className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-semibold">
          Call 999
        </a>
        {contacts.data
          .filter((contact) => ['AMBULANCE', 'MEDICAL_CENTER'].includes(String(contact.kind)))
          .map((contact) => (
            <a
              key={String(contact.id)}
              href={`tel:${contact.phone}`}
              className="px-3 py-1.5 rounded-xl bg-slate-900 text-slate-100 border border-slate-700 font-semibold"
            >
              {contact.label_en}: {contact.phone}
            </a>
          ))}
      </div>

      {broadcast && (
        <div role="alert" className="p-3 rounded-2xl bg-rose-600 text-white text-xs font-semibold flex items-center gap-2 animate-pulse">
          🚨 NEW {String(broadcast.urgency)} BLOOD REQUEST: {String(broadcast.blood_group)} for {String(broadcast.patient_name)} at{' '}
          {String(broadcast.hospital_name)}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {[
          { key: 'blood', label: '🩸 Blood requests' },
          { key: 'donors', label: '🙋 Donor network' },
          { key: 'mental', label: '🧠 Mental health' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key as typeof tab)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${
              tab === item.key
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/40'
                : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'blood' && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">Filter by group</span>
              {['ALL', ...BLOOD_GROUPS].map((group) => (
                <button
                  key={group}
                  type="button"
                  onClick={() => setBloodGroup(group)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition ${
                    bloodGroup === group
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/40'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  {group === 'ALL' ? 'All' : group}
                </button>
              ))}
            </div>
          </Card>

          {requests.loading ? (
            <SkeletonList rows={2} />
          ) : requests.data.length === 0 ? (
            <EmptyState
              icon="🩸"
              title="No open blood requests"
              description="When a student posts a request, matching donors are notified instantly by Supabase Realtime."
              action={<Button onClick={() => setRequestOpen(true)}>Post a request</Button>}
            />
          ) : (
            requests.data.map((request) => (
              <Card key={String(request.id)} className="p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-lg bg-rose-600 text-white text-xs font-extrabold">
                    {request.blood_group}
                  </span>
                  <Badge tone={statusTone(request.urgency)}>{String(request.urgency)}</Badge>
                  <Badge tone={statusTone(request.status)}>{String(request.status)}</Badge>
                  <CampusBadge universityId={request.university_id} />
                  <span className="text-[11px] text-slate-400 ml-auto">🕒 {timeAgo(request.created_at)}</span>
                </div>
                <h3 className="font-bold text-sm">
                  {request.bags_needed} bag(s) for {request.patient_name}
                </h3>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  🏥 {request.hospital_name} — {request.hospital_address}
                </div>
                <div className="text-[11px] text-slate-400">Needed by {formatDateTime(request.needed_by)}</div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button size="sm" onClick={() => setRespondTarget(request)}>
                    {t('Contact')}
                  </Button>
                  <a
                    href={`tel:${request.contact_phone}`}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700"
                  >
                    📞 {request.contact_phone}
                  </a>
                  <span className="text-[11px] text-slate-400">
                    {(request.profiles as Row)?.full_name ? `Posted by ${(request.profiles as Row).full_name}` : 'Posted anonymously'}
                  </span>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === 'donors' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Available donors" value={donors.data.length} hint="Opted in" />
            <Stat label="O+" value={donors.data.filter((donor) => donor.blood_group === 'O+').length} />
            <Stat label="B+" value={donors.data.filter((donor) => donor.blood_group === 'B+').length} />
            <Stat label="A+" value={donors.data.filter((donor) => donor.blood_group === 'A+').length} />
          </div>
          <Card className="p-4 space-y-2">
            <SectionHeader
              icon="🙋"
              title="Smart Blood Bank donor search"
              subtitle="Phone numbers stay private until a donor responds"
              actions={<Button size="sm" variant="secondary" onClick={() => setDonorOpen(true)}>Register / update</Button>}
            />
            {donors.loading ? (
              <SkeletonList rows={2} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {donors.data.map((donor) => (
                  <div key={String(donor.id)} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{(donor.profiles as Row)?.full_name ?? 'Student donor'}</span>
                      <Badge tone="rose">{donor.blood_group}</Badge>
                    </div>
                    <div className="text-slate-400">
                      {(donor.halls as Row)?.name_en ?? 'On campus'} • {Number(donor.verified_donations_count ?? 0)} donations
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={donor.is_available ? 'emerald' : 'slate'}>
                        {donor.is_available ? 'Available' : 'Unavailable'}
                      </Badge>
                      {donor.days_since_donation !== undefined && donor.days_since_donation !== null && (
                        <span className="text-[10px] text-slate-400">{donor.days_since_donation}d since last donation</span>
                      )}
                    </div>
                  </div>
                ))}
                {donors.data.length === 0 && (
                  <p className="text-xs text-slate-400 p-2">No donors match this blood group yet.</p>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === 'mental' && (
        <div className="space-y-4">
          <Card className="p-4 space-y-2 bg-violet-500/5 border-violet-500/30">
            <SectionHeader icon="🔒" title="Strictly anonymous counselling" subtitle="Your identity is never attached to the booking" />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Campus360 stores only an alias, the slot and an optional contact method you choose. The database row keeps
              <code className="mx-1">user_id</code> empty, so neither counselors nor administrators can trace a session
              back to a student account.
            </p>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {contacts.data
              .filter((contact) => ['COUNSELING', 'SECURITY'].includes(String(contact.kind)))
              .map((contact) => (
                <Card key={String(contact.id)} className="p-4 text-xs space-y-1">
                  <div className="font-bold text-sm">{contact.label_en}</div>
                  <div className="text-slate-400">{contact.available_hours}</div>
                  <a href={`tel:${contact.phone}`} className="text-emerald-500 font-semibold">
                    📞 {contact.phone}
                  </a>
                  {contact.notes_en && <p className="text-slate-400">{contact.notes_en}</p>}
                </Card>
              ))}
          </div>

          <SectionHeader icon="🗓️" title="Available counselling slots" subtitle="Book anonymously — no account linkage" />
          {slots.data.length === 0 ? (
            <EmptyState icon="🗓️" title="No counselling slots published" description="Your university counseling cell has not opened slots yet. Call the helpline above." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {slots.data.map((slot) => {
                const full = Number(slot.booked_count ?? 0) >= Number(slot.capacity ?? 1);
                return (
                  <Card key={String(slot.id)} className="p-4 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{slot.counselor_alias}</span>
                      <Badge tone={slot.mode === 'ONLINE' ? 'sky' : 'teal'}>{String(slot.mode).replace('_', ' ')}</Badge>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(slot.starts_at)}</div>
                    <div className="text-[11px] text-slate-400">
                      {Number(slot.capacity) - Number(slot.booked_count ?? 0)} of {slot.capacity} places left
                    </div>
                    <Button size="sm" disabled={full} onClick={() => setCounselSlot(slot)}>
                      {full ? 'Fully booked' : 'Book anonymously'}
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Modal open={requestOpen} onClose={() => setRequestOpen(false)} title="Post an emergency blood request" wide>
        <BloodRequestForm onSubmit={createRequest} onCancel={() => setRequestOpen(false)} />
      </Modal>

      <Modal open={donorOpen} onClose={() => setDonorOpen(false)} title="Register as a blood donor">
        <DonorForm onSubmit={registerDonor} onCancel={() => setDonorOpen(false)} />
      </Modal>

      {respondTarget && (
        <RespondModal target={respondTarget} onSubmit={respond} onClose={() => setRespondTarget(null)} />
      )}

      {counselSlot && (
        <CounsellingModal slot={counselSlot} onClose={() => setCounselSlot(null)} onSubmit={bookCounselling} />
      )}

      {bookedRef && (
        <Modal open onClose={() => setBookedRef(null)} title="Counselling session booked">
          <div className="space-y-3 text-sm">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Save these now — they are shown only once and are the only way to check or cancel this confidential
              booking.
            </p>
            <div className="p-3 rounded-xl bg-violet-500/10 space-y-1">
              <div className="text-[11px] text-slate-400">Booking reference</div>
              <div className="font-mono font-bold">{bookedRef.bookingRef}</div>
              <div className="text-[11px] text-slate-400 mt-2">Retrieval token</div>
              <div className="font-mono text-[11px] break-all">{bookedRef.retrievalToken}</div>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  localStorage.setItem(`campus360_counsel_${bookedRef.bookingRef}`, bookedRef.retrievalToken);
                }
                toast.show('Saved to this browser only.');
                setBookedRef(null);
              }}
            >
              Save in this browser
            </Button>
          </div>
        </Modal>
      )}

      {toast.node}
    </div>
  );
}

function useModuleListDonors(bloodGroup: string, session: ReturnType<typeof useSession>) {
  const [data, setData] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    if (session.loading) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      if (!isSupabaseConfigured() || session.demo) {
        const rows = readDemoRows('health_donors').filter(
          (donor) => bloodGroup === 'ALL' || donor.blood_group === bloodGroup
        );
        if (!cancelled) {
          setData(rows);
          setLoading(false);
        }
        return;
      }
      try {
        const params = new URLSearchParams({ compatible: 'true' });
        if (bloodGroup !== 'ALL') params.set('blood_group', bloodGroup);
        const res = await fetch(`/api/health/blood?${params.toString()}`, { cache: 'no-store' });
        const payload = await res.json();
        if (!cancelled && payload.success) setData(payload.data ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [bloodGroup, session.loading, session.demo, tick]);

  useRealtimeTable('health_donors', { onInsert: () => setTick((t) => t + 1) }, { enabled: !!session.authenticated });

  return { data, loading, refresh: () => setTick((t) => t + 1) };
}

function BloodRequestForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (values: Row) => Promise<{ ok: boolean; error?: string }>;
  onCancel: () => void;
}) {
  const [values, setValues] = React.useState<Row>({
    patient_name: '',
    blood_group: 'O+',
    bags_needed: 1,
    hospital_name: '',
    hospital_address: '',
    contact_phone: '',
    urgency: 'URGENT',
    needed_by: '',
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
        if (!result.ok) setError(result.error ?? 'Could not submit request.');
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Patient name">
          <Input required value={values.patient_name} onChange={(e) => set('patient_name', e.target.value)} />
        </Field>
        <Field label="Blood group">
          <Select value={values.blood_group} onChange={(e) => set('blood_group', e.target.value)} options={BLOOD_GROUPS.map((g) => ({ value: g, label: g }))} />
        </Field>
        <Field label="Bags needed">
          <Input type="number" min={1} value={values.bags_needed} onChange={(e) => set('bags_needed', e.target.value)} />
        </Field>
        <Field label="Urgency">
          <Select
            value={values.urgency}
            onChange={(e) => set('urgency', e.target.value)}
            options={['NORMAL', 'URGENT', 'CRITICAL'].map((v) => ({ value: v, label: v }))}
          />
        </Field>
        <Field label="Hospital">
          <Input required value={values.hospital_name} onChange={(e) => set('hospital_name', e.target.value)} />
        </Field>
        <Field label="Hospital address">
          <Input required value={values.hospital_address} onChange={(e) => set('hospital_address', e.target.value)} />
        </Field>
        <Field label="Contact phone">
          <Input required value={values.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} placeholder="+8801XXXXXXXXX" />
        </Field>
        <Field label="Needed by">
          <Input required type="datetime-local" value={values.needed_by} onChange={(e) => set('needed_by', e.target.value)} />
        </Field>
      </div>
      <p className="text-[11px] text-slate-400">
        All available donors of this blood group on your campus will be notified instantly, and the request appears live
        on every open Campus360 tab.
      </p>
      {error && <p className="text-xs text-rose-500">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          Broadcast request
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function DonorForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (values: Row) => Promise<{ ok: boolean }>;
  onCancel: () => void;
}) {
  const [values, setValues] = React.useState<Row>({ blood_group: 'O+', contact_phone: '', last_donated_at: '', is_available: true });
  const [pending, setPending] = React.useState(false);
  const set = (key: string, value: unknown) => setValues((prev) => ({ ...prev, [key]: value }));

  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        await onSubmit(values);
        setPending(false);
      }}
    >
      <Field label="Blood group">
        <Select value={values.blood_group} onChange={(e) => set('blood_group', e.target.value)} options={BLOOD_GROUPS.map((g) => ({ value: g, label: g }))} />
      </Field>
      <Field label="Contact phone" hint="Only revealed to a requester after you respond.">
        <Input required value={values.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} />
      </Field>
      <Field label="Last donated on" hint="Donors become eligible again 90 days after donating.">
        <Input type="date" value={values.last_donated_at} onChange={(e) => set('last_donated_at', e.target.value)} />
      </Field>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={Boolean(values.is_available)} onChange={(e) => set('is_available', e.target.checked)} />
        <span>I am available to donate now</span>
      </label>
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          Save donor profile
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function RespondModal({
  target,
  onSubmit,
  onClose,
}: {
  target: Row;
  onSubmit: (values: Row) => Promise<{ ok: boolean }>;
  onClose: () => void;
}) {
  const [message, setMessage] = React.useState('');
  const [pending, setPending] = React.useState(false);
  return (
    <Modal
      open
      onClose={onClose}
      title={`Respond to ${target.blood_group} request`}
      footer={
        <Button
          loading={pending}
          onClick={async () => {
            setPending(true);
            await onSubmit({ message });
            setPending(false);
          }}
        >
          Send offer
        </Button>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {target.bags_needed} bag(s) needed for {target.patient_name} at {target.hospital_name}.
        </p>
        <Field label="Message to the requester">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 min-h-[90px]"
            placeholder="I am O+ and free after 4pm. I can reach the hospital in 30 minutes."
          />
        </Field>
      </div>
    </Modal>
  );
}

function CounsellingModal({
  slot,
  onClose,
  onSubmit,
}: {
  slot: Row;
  onClose: () => void;
  onSubmit: (payload: Row) => Promise<void>;
}) {
  const [alias, setAlias] = React.useState('');
  const [note, setNote] = React.useState('');
  const [contactMethod, setContactMethod] = React.useState('IN_APP');
  const [contactValue, setContactValue] = React.useState('');
  const [pending, setPending] = React.useState(false);

  return (
    <Modal
      open
      onClose={onClose}
      title={`Anonymous booking — ${slot.counselor_alias}`}
      footer={
        <Button
          loading={pending}
          onClick={async () => {
            setPending(true);
            await onSubmit({ alias, note, contact_method: contactMethod, contact_value: contactValue });
            setPending(false);
          }}
        >
          Confirm anonymous booking
        </Button>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(slot.starts_at)}</p>
        <Field label="Preferred alias (optional)" hint="Leave empty and a reference alias is generated for you.">
          <Input value={alias} onChange={(event) => setAlias(event.target.value)} placeholder="Anonymous" />
        </Field>
        <Field label="What would you like to talk about? (optional)">
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 min-h-[90px]"
            placeholder="Exam stress, family pressure, anything you want the counselor to know."
          />
        </Field>
        <Field label="How should the counselor reach you?" hint="Nothing is stored unless you fill this in.">
          <Select
            value={contactMethod}
            onChange={(event) => setContactMethod(event.target.value)}
            options={[
              { value: 'IN_APP', label: 'Through Campus360 only' },
              { value: 'PHONE', label: 'Phone call' },
              { value: 'EMAIL', label: 'Email' },
            ]}
          />
        </Field>
        {contactMethod !== 'IN_APP' && (
          <Field label={contactMethod === 'PHONE' ? 'Phone number' : 'Email address'}>
            <Input value={contactValue} onChange={(event) => setContactValue(event.target.value)} />
          </Field>
        )}
        <p className="text-[11px] text-violet-500">
          🔒 This booking is not linked to your account in the database.
        </p>
      </div>
    </Modal>
  );
}
