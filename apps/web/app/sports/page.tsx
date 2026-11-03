// apps/web/app/sports/page.tsx
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
  Progress,
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
import { formatBdt, formatDateTime } from '@/lib/utils';

export default function SportsPage() {
  const session = useSession();
  const [tab, setTab] = React.useState<'teams' | 'fields' | 'fundraising'>('teams');
  const [teamOpen, setTeamOpen] = React.useState(false);
  const [bookingTarget, setBookingTarget] = React.useState<Row | null>(null);
  const [campaignOpen, setCampaignOpen] = React.useState(false);
  const [donateTarget, setDonateTarget] = React.useState<Row | null>(null);
  const [ledgerTarget, setLedgerTarget] = React.useState<Row | null>(null);
  const toast = useToast();

  const teams = useRealtimeModuleList('sports-teams', { limit: 40, enabled: !!session.authenticated });
  const challenges = useRealtimeModuleList('sports-challenges', { limit: 40, enabled: !!session.authenticated });
  const venues = useRealtimeModuleList('sports-venues', { limit: 40, enabled: !!session.authenticated });
  const bookings = useRealtimeModuleList('venue-bookings', { limit: 60, enabled: !!session.authenticated });
  const campaigns = useRealtimeModuleList('campaigns', { limit: 40, enabled: !!session.authenticated });
  const ledger = useRealtimeModuleList('donation-ledger', { limit: 100, enabled: !!session.authenticated });
  const teamMutation = useModuleMutation('sports-teams');
  const challengeMutation = useModuleMutation('sports-challenges');
  const bookingMutation = useModuleMutation('venue-bookings');
  const campaignMutation = useModuleMutation('campaigns');
  const donationMutation = useModuleMutation('donations');

  const totalRaised = campaigns.data.reduce((sum, campaign) => sum + Number(campaign.raised_bdt ?? 0), 0);
  const totalTarget = campaigns.data.reduce((sum, campaign) => sum + Number(campaign.target_bdt ?? 0), 0);

  if (!session.loading && !session.authenticated) {
    return (
      <div className="space-y-6">
        <ModuleHeader
          icon="🏆"
          title="Sports & Crowdfunding"
          titleBn="খেলাধুলা ও ক্রাউডফান্ডিং"
          blurb="Find teammates or opponents, book fields and gyms in real time, and follow every taka in a transparent donation tracker."
        />
        <SignInPrompt moduleName="sports and fundraising" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        icon="🏆"
        title="Sports & Crowdfunding"
        titleBn="খেলাধুলা ও ক্রাউডফান্ডিং"
        blurb="A sports hub to find teammates or opponents with live venue schedules, plus a transparent donation tracker where every disbursement is published with proof."
        live
        demo={teams.demo}
      >
        <Button onClick={() => setTeamOpen(true)}>+ Create a team</Button>
      </ModuleHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Open teams" value={teams.data.filter((team) => String(team.status) === 'OPEN').length} />
        <Stat label="Challenges" value={challenges.data.length} tone="teal" />
        <Stat label="Raised (BDT)" value={formatBdt(totalRaised)} tone="amber" hint={`of ${formatBdt(totalTarget)}`} />
        <Stat label="Ledger entries" value={ledger.data.length} />
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: 'teams', label: '⚽ Sports hub' },
          { key: 'fields', label: '🏟️ Fields & gyms' },
          { key: 'fundraising', label: '💝 Fundraising' },
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

      {tab === 'teams' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <SectionHeader icon="⚽" title="Teams looking for players" subtitle="Live roster needs" />
            {teams.data.length === 0 ? (
              <EmptyState icon="⚽" title="No teams yet" description="Create a team and list the roles you need." action={<Button onClick={() => setTeamOpen(true)}>Create a team</Button>} />
            ) : (
              teams.data.map((team) => (
                <Card key={String(team.id)} className="p-4 text-xs space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm">{team.name}</span>
                    <Badge tone={statusTone(team.status)}>{String(team.status)}</Badge>
                  </div>
                  <div className="text-slate-400">
                    {team.sport} • {String(team.skill_level)} level
                  </div>
                  {team.description && <p className="text-slate-500 dark:text-slate-400">{team.description}</p>}
                  <div className="flex flex-wrap gap-1">
                    {((team.needed_roles as string[]) ?? []).map((role) => (
                      <span key={role} className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 text-[10px]">
                        Need: {role}
                      </span>
                    ))}
                  </div>
                  {team.contact_note && <div className="text-[11px] text-slate-400">📞 {team.contact_note}</div>}
                </Card>
              ))
            )}
          </div>
          <div className="space-y-2">
            <SectionHeader icon="🥊" title="Find an opponent" subtitle="Open challenges" />
            <div className="pb-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  const result = await challengeMutation.create({
                    team_name: 'My team',
                    sport: 'Football',
                    title: 'Friendly match request',
                    description: 'Looking for an opponent this weekend at the central field.',
                  });
                  if (result.ok) {
                    challenges.refresh();
                    toast.show('Challenge posted.');
                  } else {
                    toast.show(result.error ?? 'Could not post challenge.', 'rose');
                  }
                }}
              >
                + Post a challenge
              </Button>
            </div>
            {challenges.data.map((challenge) => (
              <Card key={String(challenge.id)} className="p-4 text-xs space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sm">{challenge.title}</span>
                  <Badge tone={statusTone(challenge.status)}>{String(challenge.status)}</Badge>
                </div>
                <div className="text-slate-400">
                  {challenge.team_name} • {challenge.sport} • {challenge.venue ?? 'TBD'}
                </div>
                {challenge.preferred_date && (
                  <div className="text-[11px] text-slate-400">🕒 {formatDateTime(challenge.preferred_date)}</div>
                )}
                {challenge.description && <p className="text-slate-500 dark:text-slate-400">{challenge.description}</p>}
              </Card>
            ))}
            {challenges.data.length === 0 && <p className="text-xs text-slate-400">No open challenges.</p>}
          </div>
        </div>
      )}

      {tab === 'fields' && (
        <div className="space-y-4">
          {venues.loading ? (
            <SkeletonList rows={2} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {venues.data.map((venue) => {
                const venueBookings = bookings.data
                  .filter((booking) => String(booking.venue_id) === String(venue.id) && String(booking.status) === 'CONFIRMED')
                  .sort((a, b) => new Date(String(a.starts_at)).getTime() - new Date(String(b.starts_at)).getTime());
                return (
                  <Card key={String(venue.id)} className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm">{venue.name_en}</span>
                      <Badge tone="teal">{String(venue.sport)}</Badge>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      👥 Capacity {venue.capacity ?? '—'} • {Number(venue.hourly_rate_bdt ?? 0) === 0 ? 'Free' : `${formatBdt(venue.hourly_rate_bdt)}/hr`}
                    </div>
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Real-time schedule</div>
                      {venueBookings.length === 0 ? (
                        <p className="text-[11px] text-emerald-500">Open — no bookings yet.</p>
                      ) : (
                        venueBookings.slice(0, 4).map((booking) => (
                          <div key={String(booking.id)} className="text-[11px] p-1.5 rounded bg-slate-50 dark:bg-slate-800/60">
                            🔒 {formatDateTime(booking.starts_at)} → {formatDateTime(booking.ends_at)} • {booking.team_name}
                          </div>
                        ))
                      )}
                    </div>
                    <Button size="sm" onClick={() => setBookingTarget(venue)}>
                      Book a slot
                    </Button>
                  </Card>
                );
              })}
              {venues.data.length === 0 && (
                <EmptyState icon="🏟️" title="No venues listed" description="Your university admin can publish fields and gyms." />
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'fundraising' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setCampaignOpen(true)}>+ Start a campaign</Button>
            <Badge tone="emerald">Every disbursement is published with proof</Badge>
          </div>
          {campaigns.data.length === 0 ? (
            <EmptyState icon="💝" title="No campaigns yet" description="Raise funds transparently for medical emergencies or events." action={<Button onClick={() => setCampaignOpen(true)}>Start a campaign</Button>} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campaigns.data.map((campaign) => {
                const entries = ledger.data.filter((entry) => String(entry.campaign_id) === String(campaign.id));
                return (
                  <Card key={String(campaign.id)} className="p-4 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="rose">{String(campaign.cause)}</Badge>
                      {campaign.is_verified && <Badge tone="emerald">✓ Verified</Badge>}
                      <Badge tone={statusTone(campaign.status)}>{String(campaign.status)}</Badge>
                    </div>
                    <h3 className="font-bold text-sm">{campaign.title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3">{campaign.story}</p>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatBdt(campaign.raised_bdt)} raised
                        </span>
                        <span>of {formatBdt(campaign.target_bdt)}</span>
                      </div>
                      <Progress value={Number(campaign.raised_bdt ?? 0)} max={Number(campaign.target_bdt ?? 1)} />
                      <div className="text-[11px] text-slate-400">
                        {campaign.donors_count ?? 0} donors
                        {campaign.deadline ? ` • until ${String(campaign.deadline)}` : ''}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" onClick={() => setDonateTarget(campaign)}>
                        Donate
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setLedgerTarget({ campaign, entries })}>
                        🔍 Open ledger ({entries.length})
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Modal open={teamOpen} onClose={() => setTeamOpen(false)} title="Create a sports team" wide>
        <ModuleForm
          moduleKey="sports-teams"
          omit={['status']}
          submitLabel="Publish team"
          onSubmit={async (values) => {
            const result = await teamMutation.create(values);
            if (result.ok) {
              setTeamOpen(false);
              teams.refresh();
              toast.show('Team published — teammates can find you now.');
              return { ok: true };
            }
            return { ok: false, error: result.error };
          }}
          onCancel={() => setTeamOpen(false)}
        />
      </Modal>

      {bookingTarget && (
        <VenueBookingModal
          venue={bookingTarget}
          onClose={() => setBookingTarget(null)}
          onSubmit={async (values) => {
            const result = await bookingMutation.create({ venue_id: bookingTarget.id, ...values });
            if (result.ok) {
              bookings.refresh();
              setBookingTarget(null);
              toast.show('Venue booked — the schedule updated for everyone.');
              return { ok: true };
            }
            toast.show(result.error ?? 'Could not book venue.', 'rose');
            return { ok: false };
          }}
        />
      )}

      <Modal open={campaignOpen} onClose={() => setCampaignOpen(false)} title="Start a fundraising campaign" wide>
        <ModuleForm
          moduleKey="campaigns"
          omit={['raised_bdt', 'donors_count', 'status', 'is_verified']}
          submitLabel="Launch campaign"
          onSubmit={async (values) => {
            const result = await campaignMutation.create(values);
            if (result.ok) {
              setCampaignOpen(false);
              campaigns.refresh();
              toast.show('Campaign live — donations are tracked publicly.');
              return { ok: true };
            }
            return { ok: false, error: result.error };
          }}
          onCancel={() => setCampaignOpen(false)}
        />
      </Modal>

      {donateTarget && (
        <DonateModal
          campaign={donateTarget}
          onClose={() => setDonateTarget(null)}
          onSubmit={async (values) => {
            const result = await donationMutation.create({ campaign_id: donateTarget.id, ...values });
            if (result.ok) {
              campaigns.refresh();
              ledger.refresh();
              setDonateTarget(null);
              toast.show('Thank you — your donation is on the public ledger.');
              return { ok: true };
            }
            toast.show(result.error ?? 'Could not record donation.', 'rose');
            return { ok: false };
          }}
        />
      )}

      {ledgerTarget && (
        <LedgerModal data={ledgerTarget} onClose={() => setLedgerTarget(null)} />
      )}

      {toast.node}
    </div>
  );
}

function VenueBookingModal({
  venue,
  onClose,
  onSubmit,
}: {
  venue: Row;
  onClose: () => void;
  onSubmit: (values: Row) => Promise<{ ok: boolean }>;
}) {
  const [values, setValues] = React.useState({ team_name: '', starts_at: '', ends_at: '', purpose: '' });
  const [pending, setPending] = React.useState(false);
  const set = (key: string, value: string) => setValues((prev) => ({ ...prev, [key]: value }));

  return (
    <Modal
      open
      onClose={onClose}
      title={`Book ${venue.name_en}`}
      footer={
        <Button
          loading={pending}
          onClick={async () => {
            setPending(true);
            await onSubmit(values);
            setPending(false);
          }}
        >
          Confirm booking
        </Button>
      }
    >
      <div className="space-y-3">
        <Field label="Team name">
          <Input value={values.team_name} onChange={(event) => set('team_name', event.target.value)} />
        </Field>
        <Field label="Starts at">
          <Input type="datetime-local" value={values.starts_at} onChange={(event) => set('starts_at', event.target.value)} />
        </Field>
        <Field label="Ends at">
          <Input type="datetime-local" value={values.ends_at} onChange={(event) => set('ends_at', event.target.value)} />
        </Field>
        <Field label="Purpose">
          <Input value={values.purpose} onChange={(event) => set('purpose', event.target.value)} placeholder="Practice match" />
        </Field>
        <p className="text-[11px] text-slate-400">
          Double bookings are rejected server-side using an overlap check on confirmed bookings.
        </p>
      </div>
    </Modal>
  );
}

function DonateModal({
  campaign,
  onClose,
  onSubmit,
}: {
  campaign: Row;
  onClose: () => void;
  onSubmit: (values: Row) => Promise<{ ok: boolean }>;
}) {
  const [amount, setAmount] = React.useState('500');
  const [name, setName] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [anonymous, setAnonymous] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  return (
    <Modal
      open
      onClose={onClose}
      title={`Donate — ${campaign.title}`}
      footer={
        <Button
          loading={pending}
          onClick={async () => {
            setPending(true);
            await onSubmit({
              amount_bdt: Number(amount),
              donor_name: name,
              message,
              is_anonymous: anonymous,
            });
            setPending(false);
          }}
        >
          Confirm donation of {formatBdt(amount)}
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold">{formatBdt(campaign.raised_bdt)} raised</span>
            <span className="text-slate-400">target {formatBdt(campaign.target_bdt)}</span>
          </div>
          <Progress value={Number(campaign.raised_bdt ?? 0)} max={Number(campaign.target_bdt ?? 1)} />
        </div>
        <Field label="Amount (BDT)">
          <Input type="number" min={1} value={amount} onChange={(event) => setAmount(event.target.value)} />
        </Field>
        <Field label="Your name">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Optional" disabled={anonymous} />
        </Field>
        <Field label="Message of support (optional)">
          <Input value={message} onChange={(event) => setMessage(event.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} />
          <span>Donate anonymously</span>
        </label>
        <p className="text-[11px] text-slate-400">
          Campus360 records pledges for transparency. Payment is completed via the organiser’s published channel; every
          confirmed donation and disbursement appears in the public ledger.
        </p>
      </div>
    </Modal>
  );
}

function LedgerModal({ data, onClose }: { data: Row; onClose: () => void }) {
  const campaign = data.campaign as Row;
  const entries = data.entries as Row[];
  const collected = entries.filter((entry) => entry.entry_type === 'DONATION').reduce((sum, entry) => sum + Number(entry.amount_bdt), 0);
  const spent = entries.filter((entry) => entry.entry_type === 'DISBURSEMENT').reduce((sum, entry) => sum + Number(entry.amount_bdt), 0);

  return (
    <Modal open onClose={onClose} title={`Transparent ledger — ${campaign.title}`} wide>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2.5 rounded-xl bg-emerald-500/10">
            <div className="font-extrabold">{formatBdt(collected)}</div>
            <div className="text-[10px] text-slate-400">Logged donations</div>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-500/10">
            <div className="font-extrabold">{formatBdt(spent)}</div>
            <div className="text-[10px] text-slate-400">Disbursed</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-500/10">
            <div className="font-extrabold">{formatBdt(collected - spent)}</div>
            <div className="text-[10px] text-slate-400">Balance</div>
          </div>
        </div>
        {entries.length === 0 ? (
          <p className="text-xs text-slate-400">No ledger entries yet.</p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {entries.map((entry) => (
              <div key={String(entry.id)} className="py-2 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{entry.description}</div>
                  <div className="text-[10px] text-slate-400">{formatDateTime(entry.created_at)}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {entry.proof_url && (
                    <a href={String(entry.proof_url)} target="_blank" rel="noreferrer noopener" className="text-emerald-500 text-[11px]">
                      Proof ↗
                    </a>
                  )}
                  <span className={entry.entry_type === 'DISBURSEMENT' ? 'text-rose-500 font-semibold' : 'text-emerald-500 font-semibold'}>
                    {entry.entry_type === 'DISBURSEMENT' ? '−' : '+'}
                    {formatBdt(entry.amount_bdt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
