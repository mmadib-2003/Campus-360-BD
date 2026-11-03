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

const RESOLUTION_STATUSES = ['ACKNOWLEDGED', 'IN_REVIEW', 'ACTION_TAKEN', 'RESOLVED', 'CLOSED', 'REJECTED_WITH_REASON'];

export default function AdminConsolePage() {
  const session = useSession();
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

  const stats = React.useMemo(() => {
    const open = tickets.data.filter((ticket) => !['RESOLVED', 'CLOSED'].includes(String(ticket.status))).length;
    const breached = tickets.data.filter((ticket) => ticket.sla_breached).length;
    const critical = tickets.data.filter((ticket) => String(ticket.severity) === 'CRITICAL').length;
    return { open, breached, critical, total: tickets.data.length };
  }, [tickets.data]);

  async function updateStatus() {
    if (!activeTicket) return;
    setPending(true);
    try {
      if (session.demo) {
        tickets.setData((prev) =>
          prev.map((item) =>
            String(item.id) === String(activeTicket.id)
              ? { ...item, status, resolution_summary: summary || item.resolution_summary }
              : item
          )
        );
        toast.show('Status updated (preview mode).');
        setActiveTicket(null);
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
        toast.show(payload?.error?.message_en ?? 'Update denied.', 'rose');
        return;
      }
      tickets.setData((prev) =>
        prev.map((item) => (String(item.id) === String(activeTicket.id) ? { ...item, ...payload.data } : item))
      );
      toast.show('Ticket updated — the student was notified in real time.');
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
      toast.show('Reply sent to the student.');
    } else {
      toast.show(result.error ?? 'Could not reply.', 'rose');
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
          <Link href="/signin" className="inline-block px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
            Sign in
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        icon="🏛️"
        title="Administration Console"
        titleBn="প্রশাসনিক কনসোল"
        blurb="Live civic-ticket queue, dispute support and moderation. Every status change is written to the immutable audit log and pushed to the reporting student in real time."
        live
        demo={tickets.demo}
      >
        <Badge tone="emerald">{session.profile?.universities?.code ?? 'CAMPUS'}</Badge>
        <Badge tone="teal">{session.isAdmin ? 'ADMIN' : 'LIMITED'}</Badge>
      </ModuleHeader>

      {!session.isAdmin && (
        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300">
          Your account has student-level permissions. The database will reject ticket mutations, but you can still view
          the queue for transparency. Ask your university admin to grant <code>GOVERNING_BODY</code> or{' '}
          <code>UNIVERSITY_ADMIN</code>.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Open tickets" value={stats.open} tone="amber" hint="In queue" />
        <Stat label="SLA breached" value={stats.breached} tone="rose" hint="Needs escalation" />
        <Stat label="Critical" value={stats.critical} tone="rose" hint="Handle first" />
        <Stat label="Total this campus" value={stats.total} hint="All time" />
      </div>

      <section className="space-y-3">
        <SectionHeader icon="🎫" title="Civic ticket queue" subtitle="Sorted by most recent activity" />
        {tickets.loading ? (
          <SkeletonList rows={4} />
        ) : tickets.data.length === 0 ? (
          <EmptyState icon="✅" title="No tickets in the queue" description="Students have not reported any issues yet." />
        ) : (
          <div className="space-y-2">
            {tickets.data.map((ticket) => (
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
        {disputes.data.length === 0 ? (
          <EmptyState icon="⚖️" title="No open disputes" description="Students can open a dispute from the Trust panel." />
        ) : (
          <div className="space-y-2">
            {disputes.data.map((dispute) => (
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
