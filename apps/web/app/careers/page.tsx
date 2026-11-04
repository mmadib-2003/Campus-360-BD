// apps/web/app/careers/page.tsx
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
import { useModuleMutation, useRealtimeModuleList, useRealtimeTable, useSession, Row } from '@/lib/modules/client';
import { formatDateTime, initials, timeAgo } from '@/lib/utils';
import { useUi } from '@/lib/i18n-client';
import { CampusBadge } from '@/components/CampusBadge';

export default function CareersPage() {
  const session = useSession();
  const { t } = useUi();
  const [tab, setTab] = React.useState<'jobs' | 'alumni' | 'messages'>('jobs');
  const [kind, setKind] = React.useState('ALL');
  const [search, setSearch] = React.useState('');
  const [alumniFormOpen, setAlumniFormOpen] = React.useState(false);
  const [jobFormOpen, setJobFormOpen] = React.useState(false);
  const [applyTarget, setApplyTarget] = React.useState<Row | null>(null);
  const [thread, setThread] = React.useState<Row | null>(null);
  const toast = useToast();

  const opportunities = useRealtimeModuleList('careers', {
    filters: { kind },
    search,
    limit: 60,
  });
  const alumni = useRealtimeModuleList('alumni', { limit: 50, enabled: !!session.authenticated });
  const applications = useRealtimeModuleList('career-applications', { limit: 40, enabled: !!session.authenticated });
  const conversations = useRealtimeModuleList('conversations', { limit: 40, enabled: !!session.authenticated });
  const alumniMutation = useModuleMutation('alumni');
  const jobMutation = useModuleMutation('careers');
  const applicationMutation = useModuleMutation('career-applications');
  const conversationMutation = useModuleMutation('conversations');

  const myAlumniProfile = alumni.data.find((profile) => String(profile.user_id) === String(session.userId));
  const myApplications = applications.data.filter((application) => String(application.applicant_id) === String(session.userId));

  const alumniOptions = alumni.data.map((profile) => ({
    value: String(profile.id),
    label: `${(profile.profiles as Row)?.full_name ?? 'Alumnus'} — ${profile.job_title} @ ${profile.employer}`,
  }));

  async function startConversation(profile: Row) {
    const counterpartId = String(profile.user_id);
    const existing = conversations.data.find(
      (conversation) =>
        String(conversation.user_a) === counterpartId ||
        String(conversation.user_b) === counterpartId
    );
    if (existing) {
      setThread(existing);
      setTab('messages');
      return;
    }
    const result = await conversationMutation.create({
      user_b: counterpartId,
      context: `Career chat — ${profile.employer}`,
    });
    if (result.ok && result.data) {
      conversations.refresh();
      setThread(result.data);
      setTab('messages');
    } else {
      toast.show(result.error ?? 'Could not start conversation.', 'rose');
    }
  }

  if (!session.loading && !session.authenticated) {
    return (
      <div className="space-y-6">
        <ModuleHeader
          icon="💼"
          title="Alumni Network & Career Hub"
          titleBn="অ্যালামনাই নেটওয়ার্ক ও ক্যারিয়ার হাব"
          blurb="Internships, referrals and real-time messaging with verified alumni of your university."
        />
        <SignInPrompt moduleName="the career hub" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        icon="💼"
        title="Alumni Network & Career Hub"
        titleBn="অ্যালামনাই নেটওয়ার্ক ও ক্যারিয়ার হাব"
        blurb="A corporate networking space where alumni post internships, full-time roles and referral slots — and students message them directly in real time."
        live
        demo={opportunities.demo}
      >
        <Button variant="secondary" onClick={() => setAlumniFormOpen(true)}>
          {myAlumniProfile ? 'Update alumni profile' : 'I am an alumnus'}
        </Button>
        <Button onClick={() => setJobFormOpen(true)}>+ Post an opportunity</Button>
      </ModuleHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Open opportunities" value={opportunities.data.length} />
        <Stat label="Alumni network" value={alumni.data.length} tone="teal" />
        <Stat label="Offering referrals" value={alumni.data.filter((profile) => profile.offers_referrals).length} tone="amber" />
        <Stat label="My applications" value={myApplications.length} />
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: 'jobs', label: '💼 Opportunities' },
          { key: 'alumni', label: '🤝 Alumni network' },
          { key: 'messages', label: `💬 Messages (${conversations.data.length})` },
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

      {tab === 'jobs' && (
        <div className="space-y-4">
          <Card className="p-4 space-y-3">
            <Input
              placeholder="Search company, role or keyword…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search opportunities"
            />
            <FilterChips
              label="Type"
              value={kind}
              onChange={setKind}
              options={[
                { value: 'INTERNSHIP', label: 'Internship' },
                { value: 'FULL_TIME', label: 'Full-time' },
                { value: 'REFERRAL', label: 'Referral' },
                { value: 'PART_TIME', label: 'Part-time' },
                { value: 'CONTRACT', label: 'Contract' },
              ]}
            />
          </Card>

          {opportunities.loading ? (
            <SkeletonList rows={3} />
          ) : opportunities.data.length === 0 ? (
            <EmptyState
              icon="💼"
              title="No opportunities posted yet"
              description="Alumni can share internships, full-time roles and referral slots with their university."
              action={<Button onClick={() => setJobFormOpen(true)}>Post an opportunity</Button>}
            />
          ) : (
            opportunities.data.map((opportunity) => {
              const owner = (opportunity.alumni_profiles as Row) ?? {};
              const applied = myApplications.some((application) => String(application.opportunity_id) === String(opportunity.id));
              return (
                <Card key={String(opportunity.id)} className="p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="blue">{String(opportunity.kind).replace('_', ' ')}</Badge>
                    {opportunity.is_remote && <Badge tone="sky">Remote</Badge>}
                    <Badge tone={statusTone(opportunity.status)}>{String(opportunity.status)}</Badge>
                    <CampusBadge universityId={opportunity.university_id} />
                    {applied && <Badge tone="emerald">Applied</Badge>}
                    <span className="text-[11px] text-slate-400 ml-auto">{timeAgo(opportunity.created_at)}</span>
                  </div>
                  <h3 className="font-bold text-sm">
                    {opportunity.title} · <span className="text-slate-500 dark:text-slate-400">{opportunity.company}</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3">{opportunity.description}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                    <span>📍 {opportunity.location || 'Bangladesh'}</span>
                    {opportunity.salary_range && <span>💰 {opportunity.salary_range}</span>}
                    {opportunity.deadline && <span>⏳ Apply by {String(opportunity.deadline)}</span>}
                    <span>👤 {(owner.profiles as Row)?.full_name ?? 'Alumnus'}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button size="sm" onClick={() => setApplyTarget(opportunity)} disabled={applied}>
                      {applied ? 'Application sent' : 'Apply'}
                    </Button>
                    {opportunity.apply_url && (
                      <a
                        href={opportunity.apply_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700"
                      >
                        External link ↗
                      </a>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        const profile = alumni.data.find((item) => String(item.id) === String(opportunity.alumni_id));
                        if (profile) await startConversation(profile);
                      }}
                    >
                      💬 Message alumnus
                    </Button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {tab === 'alumni' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {alumni.data.length === 0 && (
            <EmptyState icon="🤝" title="No alumni profiles yet" description="Invite graduates of your university to join the network." />
          )}
          {alumni.data.map((profile) => (
            <Card key={String(profile.id)} className="p-4 space-y-2">
              <div className="flex items-center gap-3">
                <span className="h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-bold text-xs">
                  {initials(String((profile.profiles as Row)?.full_name ?? 'A'))}
                </span>
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate">{(profile.profiles as Row)?.full_name ?? 'Alumnus'}</div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {profile.job_title} @ {profile.employer}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                <span>🎓 {profile.graduation_year}</span>
                {profile.degree && <span>• {profile.degree}</span>}
                <span>• {profile.industry}</span>
                <span>• {profile.city ? `${profile.city}, ` : ''}{profile.country}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {profile.offers_referrals && <Badge tone="emerald">Offers referrals</Badge>}
                {profile.is_mentor && <Badge tone="amber">Mentors students</Badge>}
              </div>
              <Button size="sm" variant="secondary" onClick={() => startConversation(profile)}>
                💬 Start a conversation
              </Button>
            </Card>
          ))}
        </div>
      )}

      {tab === 'messages' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <SectionHeader icon="💬" title="Conversations" subtitle="Realtime direct messages" />
            {conversations.data.length === 0 && (
              <EmptyState icon="💬" title="No conversations yet" description="Open an alumnus profile and start a chat." />
            )}
            {conversations.data.map((conversation) => {
              const counterpartId =
                String(conversation.user_a) === String(session.userId) ? conversation.user_b : conversation.user_a;
              const payload = alumni.data.find((profile) => String(profile.user_id) === String(counterpartId));
              return (
                <button
                  key={String(conversation.id)}
                  type="button"
                  onClick={() => setThread(conversation)}
                  className={`w-full text-left p-3 rounded-xl border transition ${
                    String(thread?.id) === String(conversation.id)
                      ? 'border-emerald-500/40 bg-emerald-500/10'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="text-xs font-semibold truncate">
                    {(payload?.profiles as Row)?.full_name ?? 'Alumnus'}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {conversation.context ?? 'Direct message'} • {timeAgo(conversation.last_message_at)}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="lg:col-span-2">
            {thread ? <MessageThread conversation={thread} /> : (
              <EmptyState icon="💬" title="Select a conversation" description="Messages update instantly via Supabase Realtime." />
            )}
          </div>
        </div>
      )}

      <Modal open={alumniFormOpen} onClose={() => setAlumniFormOpen(false)} title="Alumni profile" wide>
        <ModuleForm
          moduleKey="alumni"
          initial={myAlumniProfile ?? null}
          submitLabel={myAlumniProfile ? 'Update profile' : 'Join the network'}
          onSubmit={async (values) => {
            const result = await alumniMutation.create(values);
            if (result.ok) {
              setAlumniFormOpen(false);
              alumni.refresh();
              toast.show('Alumni profile saved.');
              return { ok: true };
            }
            return { ok: false, error: result.error };
          }}
          onCancel={() => setAlumniFormOpen(false)}
        />
      </Modal>

      <Modal open={jobFormOpen} onClose={() => setJobFormOpen(false)} title="Post an opportunity" wide>
        {!myAlumniProfile ? (
          <div className="space-y-3 text-sm">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Create your alumni profile first — opportunities are attributed to a verified graduate of this university.
            </p>
            <Button
              onClick={() => {
                setJobFormOpen(false);
                setAlumniFormOpen(true);
              }}
            >
              Create alumni profile
            </Button>
          </div>
        ) : (
          <ModuleForm
            moduleKey="careers"
            options={{ alumni_id: [{ value: String(myAlumniProfile.id), label: `${myAlumniProfile.job_title} @ ${myAlumniProfile.employer}` }] }}
            omit={['status']}
            submitLabel="Publish opportunity"
            onSubmit={async (values) => {
              const result = await jobMutation.create({ ...values, alumni_id: myAlumniProfile.id });
              if (result.ok) {
                setJobFormOpen(false);
                opportunities.refresh();
                toast.show('Opportunity published.');
                return { ok: true };
              }
              return { ok: false, error: result.error };
            }}
            onCancel={() => setJobFormOpen(false)}
          />
        )}
      </Modal>

      {applyTarget && (
        <Modal open onClose={() => setApplyTarget(null)} title={`Apply — ${applyTarget.title}`} footer={null}>
          <ApplyForm
            onCancel={() => setApplyTarget(null)}
            onSubmit={async (values) => {
              const result = await applicationMutation.create({
                opportunity_id: applyTarget.id,
                ...values,
              });
              if (result.ok) {
                applications.refresh();
                setApplyTarget(null);
                toast.show('Application submitted — the alumnus can reply in Messages.');
                return { ok: true };
              }
              toast.show(result.error ?? 'Could not apply.', 'rose');
              return { ok: false };
            }}
          />
        </Modal>
      )}

      {toast.node}
    </div>
  );
}

function ApplyForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (values: Row) => Promise<{ ok: boolean }>;
  onCancel: () => void;
}) {
  const [message, setMessage] = React.useState('');
  const [resume, setResume] = React.useState('');
  const [pending, setPending] = React.useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        await onSubmit({ message, resume_url: resume });
        setPending(false);
      }}
    >
      <Field label="Message to the alumnus">
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="w-full rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 min-h-[110px]"
          placeholder="Briefly introduce yourself, your skills and why you fit this role."
        />
      </Field>
      <Field label="Resume link (optional)">
        <Input value={resume} onChange={(event) => setResume(event.target.value)} placeholder="https://drive.google.com/…" />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          Send application
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function MessageThread({ conversation }: { conversation: Row }) {
  const session = useSession();
  const messages = useRealtimeModuleList('messages', {
    filters: { conversation_id: String(conversation.id) },
    limit: 200,
    enabled: !!session.authenticated,
  });
  const { create } = useModuleMutation('messages');
  const [draft, setDraft] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const bottom = React.useRef<HTMLDivElement | null>(null);

  useRealtimeTable(
    'direct_messages',
    {
      onInsert: (row) => {
        if (String(row.conversation_id) === String(conversation.id)) messages.refresh();
      },
    },
    { enabled: !!session.authenticated }
  );

  React.useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.data.length]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    setPending(true);
    const result = await create({ conversation_id: conversation.id, body: draft.trim() });
    setPending(false);
    if (result.ok) {
      setDraft('');
      messages.refresh();
    }
  }

  return (
    <Card className="p-4 flex flex-col h-[520px]">
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {messages.data.length === 0 && (
          <p className="text-xs text-slate-400">No messages yet — say hello and mention the role you are interested in.</p>
        )}
        {messages.data.map((message) => {
          const mine = String(message.sender_id) === String(session.userId);
          return (
            <div
              key={String(message.id)}
              className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs ${
                mine ? 'ml-auto bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.body}</p>
              <div className={`text-[10px] mt-1 ${mine ? 'text-emerald-100' : 'text-slate-400'}`}>
                {formatDateTime(message.created_at)}
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      <form onSubmit={send} className="flex items-center gap-2 pt-3 border-t border-slate-200 dark:border-slate-800 mt-3">
        <Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message…" aria-label="Message" />
        <Button type="submit" loading={pending}>
          Send
        </Button>
      </form>
    </Card>
  );
}
