// apps/web/app/admin/console/page.tsx
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
  SkeletonList,
  Stat,
  statusTone,
  useToast,
} from '@/components/modules/ui';
import { useApiList, useModuleMutation, useRealtimeModuleList, useSession, Row } from '@/lib/modules/client';
import { timeAgo } from '@/lib/utils';
import { useUi } from '@/lib/i18n-client';
import { demoUpdate } from '@/lib/modules/demo-data';
import { asArray } from '@/lib/render-safe';

const RESOLUTION_STATUSES = ['ACKNOWLEDGED', 'IN_REVIEW', 'ACTION_TAKEN', 'RESOLVED', 'CLOSED', 'REJECTED_WITH_REASON'];

export default function AdminConsolePage() {
  const session = useSession();
  const { t } = useUi();
  const tickets = useApiList('/api/civic/tickets', {
    query: { limit: 100, scope: 'admin' },
    table: 'complaints_public',
    enabled: !!session.authenticated,
  });
  const disputes = useRealtimeModuleList('disputes', { limit: 50, enabled: !!session.authenticated });
  const disputeMessages = useModuleMutation('dispute-messages');
  const [activeTicket, setActiveTicket] = React.useState<Row | null>(null);
  const [activeDispute, setActiveDispute] = React.useState<Row | null>(null);
  const [status, setStatus] = React.useState('IN_REVIEW');
  const [summary, setSummary] = React.useState('');
  const [reply, setReply] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const toast = useToast();
  const [idReviews, setIdReviews] = React.useState<Array<Record<string, any>>>([]);

  React.useEffect(() => {
    function readReviews() {
      try {
        const raw = window.localStorage.getItem('campus360.demo.idverifications');
        setIdReviews(raw ? (JSON.parse(raw) as Array<Record<string, any>>) : []);
      } catch {
        setIdReviews([]);
      }
    }
    readReviews();
    window.addEventListener('storage', readReviews);
    window.addEventListener('campus360:demo-store', readReviews);
    return () => {
      window.removeEventListener('storage', readReviews);
      window.removeEventListener('campus360:demo-store', readReviews);
    };
  }, []);

  function reviewId(id: string, status: 'VERIFIED' | 'MANUAL_REVIEW') {
    try {
      const raw = window.localStorage.getItem('campus360.demo.idverifications');
      const rows = raw ? (JSON.parse(raw) as Array<Record<string, any>>) : [];
      const next = rows.map((row) => (String(row.id) === String(id) ? { ...row, reviewStatus: status } : row));
      window.localStorage.setItem('campus360.demo.idverifications', JSON.stringify(next));
      setIdReviews(next);
      window.dispatchEvent(new CustomEvent('campus360:demo-store'));
      toast.show(status === 'VERIFIED' ? t('Verified') : t('Rejected'));
    } catch {
      toast.show(t('Manual review'), 'rose');
    }
  }

  const stats = React.useMemo(() => {
    const open = asArray(tickets.data).filter((ticket) => !['RESOLVED', 'CLOSED'].includes(String(ticket.status))).length;
    const breached = asArray(tickets.data).filter((ticket) => ticket.sla_breached).length;
    const critical = asArray(tickets.data).filter((ticket) => String(ticket.severity) === 'CRITICAL').length;
    return { open, breached, critical, total: asArray(tickets.data).length };
  }, [tickets.data]);

  async function updateStatus() {
    if (!activeTicket) return;
    setPending(true);
    try {
      if (session.demo) {
        const updated = demoUpdate('complaints_public', String(activeTicket.id), {
          status,
          resolution_summary: summary || activeTicket.resolution_summary,
        });
        tickets.setData((prev) =>
          prev.map((item) =>
            String(item.id) === String(activeTicket.id) ? { ...item, ...(updated ?? {}) } : item
          )
        );
        tickets.refresh();
        toast.show(t('Status updated (preview mode).'));
        setActiveTicket(null);
        setSummary('');
        return;
      }

      const res = await fetch(`/api/admin/complaints/${activeTicket.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          resolutionSummary: summary || undefined,
          rejectionReason: status === 'REJECTED_WITH_REASON' ? summary || 'Not actionable' : undefined,
        }),
      });
      const payload = await res.json();
      if (!payload.success) {
        toast.show(payload?.error?.message_en ?? t('Update denied.'), 'rose');
        return;
      }
      tickets.setData((prev) =>
        prev.map((item) => (String(item.id) === String(activeTicket.id) ? { ...item, ...payload.data } : item))
      );
      toast.show(t('Ticket updated — the student was notified in real time.'));
      setActiveTicket(null);
      setSummary('');
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Network error', 'rose');
    } finally {
      setPending(false);
    }
  }

  async function replyToDispute() {
    if (!activeDispute || !reply.trim()) return;
    setPending(true);
    const result = await disputeMessages.create({ dispute_id: activeDispute.id, body: reply.trim() });
    setPending(false);
    if (result.ok) {
      setReply('');
      toast.show(t('Ticket updated — the student was notified in real time.'));
    } else {
      toast.show(result.error ?? t('Could not reply.'), 'rose');
    }
  }

  if (!session.loading && !session.authenticated) {
    return (
      <div className="space-y-6">
        <ModuleHeader
          icon="🏛️"
          title="Administration Console"
          titleBn="প্রশাসনিক কনসোল"
          blurb="Resolve civic tickets, moderate content and answer dispute tickets. Actions propagate to students instantly."
        />
        <Card className="p-5 text-sm space-y-2">
          <p className="font-semibold">This console requires an administrator session.</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sign in with your institutional email; access is enforced twice — by middleware and by row-level security
            (only <code>UNIVERSITY_ADMIN</code>, <code>GOVERNING_BODY</code> and <code>SUPER_ADMIN</code> roles can
            update tickets).
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/login" className="inline-block px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
              {t('Admin Login')}
            </Link>
            <Link href="/signin" className="inline-block px-4 py-2 rounded-xl text-sm font-semibold border border-slate-300 dark:border-slate-700">
              {t('Sign In')}
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        icon="🏛️"
        title={t('Administration Console')}
        titleBn={t('Administration Console')}
        blurb={t('Live civic-ticket queue, dispute support and moderation. Every status change is written to the immutable audit log and pushed to the reporting student in real time.')}
        live
        demo={tickets.demo}
      >
        <Badge tone="emerald">{session.profile?.universities?.code ?? 'CAMPUS'}</Badge>
        <Badge tone="teal">{session.isAdmin ? t('Admin') : t('Unverified')}</Badge>
      </ModuleHeader>

      {!session.isAdmin && (
        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300">
          {t('Your account has student-level permissions. The database will reject ticket mutations, but you can still view the queue for transparency. Ask your university admin to grant GOVERNING_BODY or UNIVERSITY_ADMIN.')} The database will reject ticket mutations, but you can still view
          the queue for transparency. Ask your university admin to grant <code>GOVERNING_BODY</code> or{' '}
          <code>UNIVERSITY_ADMIN</code>.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label={t('Open tickets')} value={stats.open} tone="amber" hint={t('In queue')} />
        <Stat label={t('SLA breached')} value={stats.breached} tone="rose" hint={t('Needs escalation')} />
        <Stat label={t('Critical')} value={stats.critical} tone="rose" hint={t('Handle first')} />
        <Stat label={t('Total this campus')} value={stats.total} hint={t('All time')} />
      </div>

      <section className="space-y-3">
        <SectionHeader
          icon="🪪"
          title={t('ID verification review queue')}
          subtitle={t('Optional — adds a second verification factor')}
        />
        {idReviews.length === 0 ? (
          <Card className="p-4 text-xs text-slate-500">{t('No submissions waiting for review.')}</Card>
        ) : (
          <div className="space-y-2">
            {idReviews.map((review) => (
              <Card key={String(review.id)} className="p-3 flex flex-wrap items-center gap-3 text-xs">
                <span className="font-mono font-semibold">{String(review.student_id_number ?? '—')}</span>
                <span className="text-slate-500">{String(review.name ?? '—')}</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                  {String(review.university_code ?? '')} • {Number(review.confidence ?? 0)}%
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full font-semibold ${
                    review.reviewStatus === 'VERIFIED'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                      : review.reviewStatus === 'MANUAL_REVIEW'
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {review.reviewStatus === 'VERIFIED'
                    ? t('Verified')
                    : review.reviewStatus === 'MANUAL_REVIEW'
                      ? t('Manual review')
                      : t('Pending review')}
                </span>
                <div className="ml-auto flex gap-2">
                  <button
                    type="button"
                    onClick={() => reviewId(String(review.id), 'VERIFIED')}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold"
                  >
                    {t('Approve')}
                  </button>
                  <button
                    type="button"
                    onClick={() => reviewId(String(review.id), 'MANUAL_REVIEW')}
                    className="px-3 py-1.5 rounded-lg border border-amber-500/40 text-amber-600 dark:text-amber-300 font-semibold"
                  >
                    {t('Reject')}
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader icon="🎫" title="Civic ticket queue" subtitle="Sorted by most recent activity" />
        {tickets.loading ? (
          <SkeletonList rows={4} />
        ) : asArray(tickets.data).length === 0 ? (
          <EmptyState icon="✅" title="No tickets in the queue" description="Students have not reported any issues yet." />
        ) : (
          <div className="space-y-2">
            {asArray(tickets.data).map((ticket) => (
              <Card key={String(ticket.id)} className="p-4">
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={statusTone(ticket.status)}>{String(ticket.status).replace(/_/g, ' ')}</Badge>
                      <Badge tone={statusTone(ticket.severity)}>{String(ticket.severity)}</Badge>
                      <span className="text-[11px] font-mono text-slate-400">{ticket.tracking_code}</span>
                      <span className="text-[11px] text-slate-400">▲ {Number(ticket.upvotes_count ?? 0)}</span>
                    </div>
                    <div className="font-semibold text-sm truncate">{ticket.title}</div>
                    <div className="text-[11px] text-slate-400">
                      {String(ticket.category).replace('_', ' ')} • updated {timeAgo(ticket.last_activity_at ?? ticket.created_at)}
                      {ticket.is_anonymous && ' • anonymous reporter'}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setActiveTicket(ticket);
                      setStatus(String(ticket.status));
                      setSummary(String(ticket.resolution_summary ?? ''));
                    }}
                  >
                    Update status
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader icon="⚖️" title="Dispute support tickets" subtitle="Moderation & dispute resolution" />
        {asArray(disputes.data).length === 0 ? (
          <EmptyState icon="⚖️" title="No open disputes" description="Students can open a dispute from the Trust panel." />
        ) : (
          <div className="space-y-2">
            {asArray(disputes.data).map((dispute) => (
              <Card key={String(dispute.id)} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge tone={statusTone(dispute.status)}>{String(dispute.status).replace('_', ' ')}</Badge>
                    <span className="text-[11px] font-mono text-slate-400">{dispute.reference_code}</span>
                  </div>
                  <div className="font-semibold text-sm mt-1">{dispute.subject}</div>
                  <p className="text-[11px] text-slate-400 line-clamp-2">{dispute.description}</p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setActiveDispute(dispute);
                    setActiveDispute(dispute);
                  }}
                >
                  Reply
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={!!activeTicket}
        onClose={() => setActiveTicket(null)}
        title={`Update ticket ${activeTicket?.tracking_code ?? ''}`}
        footer={
          <Button onClick={updateStatus} loading={pending}>
            Save & notify student
          </Button>
        }
      >
        <div className="space-y-3">
          <Field label="New status">
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-full rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
            >
              {RESOLUTION_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Resolution summary / reason" hint="Shown to the student in their live tracker.">
            <textarea
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              className="w-full rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 min-h-[100px]"
              placeholder="Streetlight replaced by the electrical maintenance team on 3 Nov."
            />
          </Field>
          <Field label="Attach proof URL (optional)">
            <Input placeholder="https://…/resolution-photo.jpg" />
          </Field>
        </div>
      </Modal>

      <Modal
        open={!!activeDispute}
        onClose={() => setActiveDispute(null)}
        title={`Dispute ${activeDispute?.reference_code ?? ''}`}
        footer={
          <Button onClick={replyToDispute} loading={pending}>
            Send reply
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">{activeDispute?.description}</p>
          <textarea
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 min-h-[100px]"
            placeholder="Explain the next step for the student…"
          />
        </div>
      </Modal>

      {toast.node}
    </div>
  );
}
