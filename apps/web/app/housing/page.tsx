// apps/web/app/housing/page.tsx
'use client';

import React from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  FilterChips,
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
import { formatBdt, formatDateTime, toDateInputValue } from '@/lib/utils';
import { useUi } from '@/lib/i18n-client';
import { CampusBadge } from '@/components/CampusBadge';

export default function HousingPage() {
  const session = useSession();
  const { t } = useUi();
  const [tab, setTab] = React.useState<'housing' | 'rideshare' | 'tickets'>('housing');
  const [kind, setKind] = React.useState('ALL');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [rideOpen, setRideOpen] = React.useState(false);
  const [requestOpen, setRequestOpen] = React.useState(false);
  const [ticketOpen, setTicketOpen] = React.useState(false);
  const [matches, setMatches] = React.useState<Row[] | null>(null);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const toast = useToast();

  const housing = useRealtimeModuleList('housing', {
    filters: { kind },
    limit: 60,
    enabled: !!session.authenticated,
  });
  const rides = useRealtimeModuleList('rideshare', { limit: 60, enabled: !!session.authenticated });
  const rideRequests = useRealtimeModuleList('ride-requests', { limit: 60, enabled: !!session.authenticated });
  const tickets = useRealtimeModuleList('ticket-exchange', { limit: 60, enabled: !!session.authenticated });
  const housingMutation = useModuleMutation('housing');
  const rideMutation = useModuleMutation('rideshare');
  const rideRequestMutation = useModuleMutation('ride-requests');
  const ticketMutation = useModuleMutation('ticket-exchange');

  const openRides = rides.data.filter((ride) => String(ride.status) === 'OPEN');
  const openRequests = rideRequests.data.filter((request) => String(request.status) === 'OPEN');
  const openTickets = tickets.data.filter((ticket) => String(ticket.status) === 'AVAILABLE');

  function findMatches(request: Row) {
    const targetDate = new Date(String(request.depart_at)).getTime();
    const origin = String(request.origin ?? '').toLowerCase();
    const destination = String(request.destination ?? '').toLowerCase();
    const result = openRides.filter((ride) => {
      const sameMode = String(ride.mode) === String(request.mode);
      const sameRoute =
        String(ride.origin ?? '').toLowerCase().includes(destination.slice(0, 4)) ||
        String(ride.destination ?? '').toLowerCase().includes(destination.slice(0, 4)) ||
        String(ride.destination ?? '').toLowerCase().includes(origin.slice(0, 4));
      const closeInTime = Math.abs(new Date(String(ride.depart_at)).getTime() - targetDate) <= 1000 * 60 * 60 * 36;
      const hasSeats = Number(ride.seats_available ?? 0) > 0;
      return hasSeats && sameRoute && (sameMode || closeInTime) && closeInTime;
    });
    setMatches(result);
  }

  if (!session.loading && !session.authenticated) {
    return (
      <div className="space-y-6">
        <ModuleHeader
          icon="🏢"
          title={t('Housing')}
          titleBn={t('Housing')}
          blurb={t('Find a hall seat or a verified off-campus mess near your campus.')}
        />
        <SignInPrompt moduleName="housing and commute" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        icon="🏢"
        title="Housing & Commute"
        titleBn="আবাসন ও যাতায়াত"
        blurb={t('Find a hall seat or a verified off-campus mess near your campus.')}
        live
        demo={housing.demo}
      >
        <Button onClick={() => setCreateOpen(true)}>+ Post a seat</Button>
      </ModuleHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Vacant seats" value={housing.data.filter((row) => String(row.status) === 'AVAILABLE').length} />
        <Stat label="Open rides" value={openRides.length} tone="teal" />
        <Stat label="Looking to join" value={openRequests.length} tone="amber" />
        <Stat label="Tickets for exchange" value={openTickets.length} />
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: 'housing', label: '🏠 To-Let board' },
          { key: 'rideshare', label: '🚌 Rideshare matching' },
          { key: 'tickets', label: '🎫 Ticket exchange' },
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

      {tab === 'housing' && (
        <div className="space-y-4">
          <FilterChips
            label="Type"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'MESS_SEAT', label: 'Mess seat' },
              { value: 'HOSTEL_SEAT', label: 'Hostel seat' },
              { value: 'SUB_LET', label: 'Sub-let' },
              { value: 'FAMILY_FLAT', label: 'Family flat' },
              { value: 'PAYING_GUEST', label: 'Paying guest' },
            ]}
          />
          {housing.loading ? (
            <SkeletonList rows={2} />
          ) : housing.data.length === 0 ? (
            <EmptyState icon="🏠" title={t('No listings found')} description={t('Find a hall seat or a verified off-campus mess near your campus.')} action={<Button onClick={() => setCreateOpen(true)}>{t('New listing')}</Button>} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {housing.data.map((listing) => (
                <Card key={String(listing.id)} className="p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="cyan">{String(listing.kind).replace(/_/g, ' ')}</Badge>
                    <Badge tone={statusTone(listing.status)}>{String(listing.status)}</Badge>
                    <Badge tone="slate">{String(listing.gender_policy)}</Badge>
                    <CampusBadge universityId={listing.university_id} />
                  </div>
                  <h3 className="font-bold text-sm">{listing.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{listing.description}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                    <span>📍 {listing.area_en}</span>
                    {listing.distance_km && <span>• {listing.distance_km} km from campus</span>}
                    <span>• 🛏 {listing.seat_count} seat(s)</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {((listing.amenities as string[]) ?? []).map((amenity) => (
                      <span key={amenity} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 dark:text-slate-300">
                        {amenity}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                      {formatBdt(listing.rent_bdt)}<span className="text-[11px] text-slate-400 font-normal"> /month</span>
                    </span>
                    <div className="flex gap-1.5">
                      <a
                        href={`/trust?report=housing&id=${listing.id}`}
                        className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border border-slate-300 dark:border-slate-700"
                      >
                        Report
                      </a>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => toast.show('Ask the owner in the messaging panel (Trust → Messages).')}
                      >
                        Contact owner
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'rideshare' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setRideOpen(true)}>+ Offer a seat</Button>
            <Button variant="secondary" onClick={() => setRequestOpen(true)}>
              🔎 I need a ride
            </Button>
          </div>

          {matches && (
            <Card className="p-4 space-y-2 border-emerald-500/40">
              <SectionHeader
                icon="✨"
                title={`${matches.length} ride match(es) found`}
                subtitle="Matched by route and departure window"
                actions={<Button size="sm" variant="ghost" onClick={() => setMatches(null)}>Clear</Button>}
              />
              {matches.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No rides match yet. We will notify you the moment someone posts a matching route.
                </p>
              ) : (
                matches.map((ride) => (
                  <div key={String(ride.id)} className="p-2.5 rounded-xl bg-emerald-500/10 text-xs flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold">
                        {ride.origin} → {ride.destination} • {String(ride.mode)}
                      </div>
                      <div className="text-slate-400">
                        {formatDateTime(ride.depart_at)} • {ride.seats_available} seat(s) • {formatBdt(ride.fare_bdt)}
                      </div>
                    </div>
                    <Badge tone="emerald">Match</Badge>
                  </div>
                ))
              )}
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <SectionHeader icon="🚌" title={t('Available')} subtitle={t('Available')} />
              {rides.data.length === 0 ? (
                <EmptyState icon="🚌" title={t('No listings found')} description={t('No listings found')} />
              ) : (
                rides.data.map((ride) => (
                  <Card key={String(ride.id)} className="p-4 text-xs space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm">
                        {ride.origin} → {ride.destination}
                      </span>
                      <Badge tone="cyan">{String(ride.mode)}</Badge>
                    </div>
                    <div className="text-slate-500 dark:text-slate-400">
                      🕒 {formatDateTime(ride.depart_at)} • 💺 {ride.seats_available}/{ride.seats_total} seats •{' '}
                      {formatBdt(ride.fare_bdt)}
                    </div>
                    {ride.vehicle_details && <div className="text-[11px] text-slate-400">🚐 {ride.vehicle_details}</div>}
                    {ride.notes && <div className="text-[11px] text-slate-400">{ride.notes}</div>}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-400">
                        {(ride.profiles as Row)?.full_name ?? 'Student'}
                      </span>
                      <Button
                        size="sm"
                        disabled={Number(ride.seats_available ?? 0) <= 0}
                        loading={pendingId === String(ride.id)}
                        onClick={async () => {
                          setPendingId(String(ride.id));
                          const next = Math.max(0, Number(ride.seats_available ?? 1) - 1);
                          const result = await rideMutation.update(String(ride.id), {
                            seats_available: next,
                            status: next === 0 ? 'FULL' : 'OPEN',
                          });
                          setPendingId(null);
                          if (result.ok) {
                            rides.refresh();
                            toast.show('Seat reserved. Message the driver for the meeting point.');
                          } else {
                            toast.show(result.error ?? 'Could not reserve.', 'rose');
                          }
                        }}
                      >
                        Claim a seat
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>

            <div className="space-y-2">
              <SectionHeader icon="🙋" title={t('Student')} subtitle={t('Student')} />
              {openRequests.length === 0 ? (
                <EmptyState icon="🙋" title={t('No listings found')} description={t('No listings found')} />
              ) : (
                openRequests.map((request) => (
                  <Card key={String(request.id)} className="p-4 text-xs space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm">
                        {request.origin} → {request.destination}
                      </span>
                      <Badge tone={statusTone(request.status)}>{String(request.status)}</Badge>
                    </div>
                    <div className="text-slate-500 dark:text-slate-400">
                      🕒 {formatDateTime(request.depart_at)} • 💺 needs {request.seats_needed} • {String(request.mode)}
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => findMatches(request)}>
                      ✨ Find matches
                    </Button>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'tickets' && (
        <div className="space-y-4">
          <Button onClick={() => setTicketOpen(true)}>+ Post a ticket for exchange</Button>
          {tickets.data.length === 0 ? (
            <EmptyState icon="🎫" title={t('No listings found')} description={t('No listings found')} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tickets.data.map((ticket) => (
                <Card key={String(ticket.id)} className="p-4 text-xs space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm">
                      {ticket.route_from} → {ticket.route_to}
                    </span>
                    <Badge tone={statusTone(ticket.status)}>{String(ticket.status)}</Badge>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400">
                    📅 {toDateInputValue(ticket.travel_date)} • 🎫 {ticket.seat_count} seat(s) • {formatBdt(ticket.price_bdt)} •{' '}
                    {String(ticket.mode)}
                  </div>
                  {ticket.notes && <div className="text-[11px] text-slate-400">{ticket.notes}</div>}
                  <a
                    href={`/trust?report=ticket&id=${ticket.id}`}
                    className="inline-block text-[11px] text-emerald-500 font-semibold"
                  >
                    Request exchange →
                  </a>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t('New listing')} wide>
        <ModuleForm
          moduleKey="housing"
          omit={['status']}
          submitLabel="Publish seat"
          onSubmit={async (values) => {
            const result = await housingMutation.create(values);
            if (result.ok) {
              setCreateOpen(false);
              housing.refresh();
              toast.show('Seat published.');
              return { ok: true };
            }
            return { ok: false, error: result.error };
          }}
          onCancel={() => setCreateOpen(false)}
        />
      </Modal>

      <Modal open={rideOpen} onClose={() => setRideOpen(false)} title={t('New listing')} wide>
        <ModuleForm
          moduleKey="rideshare"
          omit={['status']}
          submitLabel="Publish ride"
          onSubmit={async (values) => {
            const result = await rideMutation.create(values);
            if (result.ok) {
              setRideOpen(false);
              rides.refresh();
              toast.show('Ride published — matching students are notified.');
              return { ok: true };
            }
            return { ok: false, error: result.error };
          }}
          onCancel={() => setRideOpen(false)}
        />
      </Modal>

      <Modal open={requestOpen} onClose={() => setRequestOpen(false)} title={t('New listing')} wide>
        <ModuleForm
          moduleKey="ride-requests"
          omit={['status', 'matched_offer_id']}
          submitLabel="Publish request"
          onSubmit={async (values) => {
            const result = await rideRequestMutation.create(values);
            if (result.ok) {
              setRequestOpen(false);
              rideRequests.refresh();
              toast.show('Request published — we will alert matching drivers.');
              return { ok: true };
            }
            return { ok: false, error: result.error };
          }}
          onCancel={() => setRequestOpen(false)}
        />
      </Modal>

      <Modal open={ticketOpen} onClose={() => setTicketOpen(false)} title={t('New listing')} wide>
        <ModuleForm
          moduleKey="ticket-exchange"
          omit={['status']}
          submitLabel="Publish ticket"
          onSubmit={async (values) => {
            const result = await ticketMutation.create(values);
            if (result.ok) {
              setTicketOpen(false);
              tickets.refresh();
              toast.show('Ticket listed for exchange.');
              return { ok: true };
            }
            return { ok: false, error: result.error };
          }}
          onCancel={() => setTicketOpen(false)}
        />
      </Modal>

      {toast.node}
    </div>
  );
}
