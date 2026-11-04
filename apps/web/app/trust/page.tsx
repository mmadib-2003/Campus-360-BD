// apps/web/app/trust/page.tsx
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
import { trySupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase-browser';
import { timeAgo } from '@/lib/utils';

const STEPS = [
  { key: 'EMAIL_VERIFIED', label: 'University email verified', hint: 'Institutional domain + 6-digit OTP' },
  { key: 'ID_VERIFIED', label: 'Student ID card reviewed', hint: 'Manual review by your university admin' },
  { key: 'TRUSTED', label: 'Trusted Campus360 member', hint: 'Consistent positive reviews & no disputes' },
];

export default function TrustPage() {
  const session = useSession();
  const { t } = useUi();
  const [disputeOpen, setDisputeOpen] = React.useState(false);
  const [idOpen, setIdOpen] = React.useState(false);
  const [activeDispute, setActiveDispute] = React.useState<Row | null>(null);
  const [idFile, setIdFile] = React.useState<File | null>(null);
  const [idPending, setIdPending] = React.useState(false);
  const toast = useToast();

  const disputes = useRealtimeModuleList('disputes', { limit: 40, enabled: !!session.authenticated });
  const reviews = useRealtimeModuleList('reviews', { limit: 30 });
  const disputeMutation = useModuleMutation('disputes');

  const trustLevel = String(session.profile?.trust_level ?? 'UNVERIFIED');
  const myReviews = reviews.data.filter((review) => String(review.author_id) === String(session.userId));
  const avgGiven =
    myReviews.length > 0 ? myReviews.reduce((sum, review) => sum + Number(review.rating ?? 0), 0) / myReviews.length : 0;

  async function submitIdVerification() {
    if (!idFile) {
      toast.show('Choose a photo of your student ID card.', 'amber');
      return;
    }
    if (!isSupabaseConfigured()) {
      toast.show('ID verification requires a connected Supabase project.', 'amber');
      return;
    }
    setIdPending(true);
    try {
      const supabase = trySupabaseBrowser();
      if (!supabase) {
        toast.show('Supabase client is not configured.', 'rose');
        return;
      }
      const path = `${session.profile?.university_id ?? 'campus'}/${session.userId}-${Date.now()}-${idFile.name.replace(/[^a-zA-Z0-9._-]+/g, '_')}`;
      const { error } = await supabase.storage.from('id-verifications').upload(path, idFile, { upsert: true });
      if (error) {
        toast.show(error.message, 'rose');
        return;
      }
      const res = await fetch('/api/profile/id-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath: path, mimeType: idFile.type, fileSizeBytes: idFile.size }),
      });
      const payload = await res.json();
      if (!payload.success) {
        toast.show(payload?.error?.message_en ?? 'Could not submit ID.', 'rose');
        return;
      }
      setIdOpen(false);
      toast.show('ID submitted for review — you will be notified once approved.');
    } finally {
      setIdPending(false);
    }
  }

  if (!session.loading && !session.authenticated) {
    return (
      <div className="space-y-6">
        <ModuleHeader
          icon="✅"
          title="Trust & Verification Panel"
          titleBn="ট্রাস্ট ও ভেরিফিকেশন প্যানেল"
          blurb="Verify your student identity, build a reputation through reviews, and open a dispute if a campus transaction goes wrong."
        />
        <SignInPrompt moduleName="the Trust panel" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        icon="✅"
        title="Trust & Verification Panel"
        titleBn="ট্রাস্ট ও ভেরিফিকেশন প্যানেল"
        blurb="University-issued email verification, student ID review, transparent ratings and a moderated dispute channel. Moderation decisions propagate to every module in real time."
        live
        demo={disputes.demo}
      >
        <Button variant="secondary" onClick={() => setIdOpen(true)}>
          Verify student ID
        </Button>
        <Button onClick={() => setDisputeOpen(true)}>Open a dispute</Button>
      </ModuleHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Trust level" value={trustLevel.replace('_', ' ')} tone="emerald" />
        <Stat label="Reviews written" value={myReviews.length} />
        <Stat label="Average rating given" value={avgGiven > 0 ? avgGiven.toFixed(1) : '—'} tone="teal" />
        <Stat label="Open disputes" value={disputes.data.filter((dispute) => String(dispute.status) === 'OPEN').length} tone="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4 space-y-3">
            <SectionHeader icon="🪪" title="Verification ladder" subtitle="Each rung unlocks more of the super-app" />
            <ol className="space-y-2">
              {STEPS.map((step, index) => {
                const order = ['UNVERIFIED', 'EMAIL_VERIFIED', 'ID_VERIFIED', 'TRUSTED'];
                const reached = order.indexOf(trustLevel) >= order.indexOf(step.key);
                return (
                  <li
                    key={step.key}
                    className={`p-3 rounded-xl border flex items-start gap-3 ${
                      reached ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <span
                      className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                        reached ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                      }`}
                    >
                      {reached ? '✓' : index + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{step.label}</div>
                      <div className="text-[11px] text-slate-400">{step.hint}</div>
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="text-[11px] text-slate-400">
              Verification is enforced by row-level security: unverified accounts can browse but cannot post listings,
              RSVP, book resources or send messages.
            </p>
          </Card>

          <Card className="p-4 space-y-3">
            <SectionHeader
              icon="⚖️"
              title="Dispute support tickets"
              subtitle="Escalate a marketplace, housing or ticket exchange issue"
            />
            {disputes.loading ? (
              <SkeletonList rows={2} />
            ) : disputes.data.length === 0 ? (
              <EmptyState
                icon="⚖️"
                title="No disputes opened"
                description="If a transaction goes wrong, open a dispute and a moderator will step in."
                action={<Button onClick={() => setDisputeOpen(true)}>Open a dispute</Button>}
              />
            ) : (
              <div className="space-y-2">
                {disputes.data.map((dispute) => (
                  <button
                    key={String(dispute.id)}
                    type="button"
                    onClick={() => setActiveDispute(dispute)}
                    className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={statusTone(dispute.status)}>{String(dispute.status).replace('_', ' ')}</Badge>
                      <CampusBadge universityId={dispute.university_id} />
                      <span className="text-[11px] font-mono text-slate-400">{dispute.reference_code}</span>
                      <span className="text-[11px] text-slate-400 ml-auto">{timeAgo(dispute.created_at)}</span>
                    </div>
                    <div className="font-semibold text-sm mt-1">{dispute.subject}</div>
                    <p className="text-[11px] text-slate-400 line-clamp-2">{dispute.description}</p>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4 space-y-2">
            <SectionHeader icon="⭐" title="My reviews" subtitle="Rate services you actually used" />
            {myReviews.length === 0 ? (
              <p className="text-xs text-slate-400">
                You have not reviewed anything yet. Visit a module and rate the service you received.
              </p>
            ) : (
              myReviews.slice(0, 5).map((review) => (
                <div key={String(review.id)} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-amber-500">{'★'.repeat(Number(review.rating ?? 0))}</span>
                    <span className="text-[10px] text-slate-400">{String(review.target_type)}</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 line-clamp-2">{review.body}</p>
                </div>
              ))
            )}
            <Link href="/reviews" className="text-[11px] text-emerald-500 font-semibold">
              Go to live service reviews →
            </Link>
          </Card>

          <Card className="p-4 space-y-2 text-xs">
            <SectionHeader icon="🛡️" title="Moderation" />
            <p className="text-slate-500 dark:text-slate-400">
              Moderators can hide listings, warn accounts or suspend posting rights. Every action is written to an
              immutable audit log visible to your university administration.
            </p>
            <Link href="/admin/console" className="text-emerald-500 font-semibold">
              Admin console (staff only) →
            </Link>
          </Card>

          <Card className="p-4 space-y-2 text-xs">
            <SectionHeader icon="📞" title="Need urgent help?" />
            <a href="tel:999" className="block p-2.5 rounded-xl bg-rose-600 text-white font-bold text-center">
              Call 999
            </a>
            <Link href="/health" className="block p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-semibold text-center">
              Campus helplines & anonymous counselling
            </Link>
          </Card>
        </div>
      </div>

      <Modal open={disputeOpen} onClose={() => setDisputeOpen(false)} title="Open a dispute" wide>
        <ModuleForm
          moduleKey="disputes"
          omit={['status', 'resolution']}
          submitLabel="Submit dispute"
          onSubmit={async (values) => {
            const result = await disputeMutation.create(values);
            if (result.ok) {
              setDisputeOpen(false);
              disputes.refresh();
              toast.show(`Dispute opened${result.data?.reference_code ? ` (${result.data.reference_code})` : ''}.`);
              return { ok: true };
            }
            return { ok: false, error: result.error };
          }}
          onCancel={() => setDisputeOpen(false)}
        />
      </Modal>

      <Modal open={idOpen} onClose={() => setIdOpen(false)} title="Submit student ID for verification">
        <div className="space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Upload a clear photo of your student ID card. It is stored in a private bucket, visible only to your
            university’s verification officers, and retained for a limited review window.
          </p>
          <Field label="Student ID photo">
            <input type="file" accept="image/*,application/pdf" onChange={(event) => setIdFile(event.target.files?.[0] ?? null)} className="text-xs" />
          </Field>
          <Button loading={idPending} onClick={submitIdVerification}>
            Submit for review
          </Button>
        </div>
      </Modal>

      {activeDispute && (
        <Modal open onClose={() => setActiveDispute(null)} title={`Dispute ${activeDispute.reference_code}`} wide>
          <DisputeThread dispute={activeDispute} />
        </Modal>
      )}

      {toast.node}
    </div>
  );
}

function DisputeThread({ dispute }: { dispute: Row }) {
  const messages = useRealtimeModuleList('dispute-messages', {
    filters: { dispute_id: String(dispute.id) },
    limit: 100,
  });
  const { create } = useModuleMutation('dispute-messages');
  const [draft, setDraft] = React.useState('');
  const [pending, setPending] = React.useState(false);

  return (
    <div className="space-y-3">
      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs space-y-1">
        <div className="flex items-center gap-2">
          <Badge tone={statusTone(dispute.status)}>{String(dispute.status).replace('_', ' ')}</Badge>
                      <CampusBadge universityId={dispute.university_id} />
          <span className="text-slate-400">{String(dispute.category)}</span>
        </div>
        <p className="text-slate-600 dark:text-slate-300">{dispute.description}</p>
        {dispute.resolution && <p className="text-emerald-500 font-semibold">Resolution: {dispute.resolution}</p>}
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {messages.data.length === 0 && <p className="text-xs text-slate-400">No messages yet.</p>}
        {messages.data.map((message) => (
          <div
            key={String(message.id)}
            className={`p-2.5 rounded-xl text-xs ${message.is_admin ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-slate-100 dark:bg-slate-800'}`}
          >
            <div className="text-[10px] text-slate-400 mb-1">
              {message.is_admin ? '🛡️ Campus360 moderation' : 'You'} • {timeAgo(message.created_at)}
            </div>
            <p>{message.body}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add evidence or a reply…" />
        <Button
          loading={pending}
          onClick={async () => {
            if (!draft.trim()) return;
            setPending(true);
            const result = await create({ dispute_id: dispute.id, body: draft.trim() });
            setPending(false);
            if (result.ok) {
              setDraft('');
              messages.refresh();
            }
          }}
        >
          Send
        </Button>
      </div>
    </div>
  );
}
