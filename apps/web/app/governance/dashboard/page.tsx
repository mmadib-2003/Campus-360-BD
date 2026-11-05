'use client';

// apps/web/app/governance/dashboard/page.tsx
// University Governance dashboard (success criterion 4) — scoped to the
// governance user's own university (RLS: university_id = current_user_university_id()).
// Civic complaint moderation, hall allocation approvals and notice broadcasts.
// Platform-wide user management and other universities' data are out of reach.

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
  SkeletonList,
  Textarea,
  useToast,
} from '@/components/modules/ui';
import { useSession } from '@/lib/modules/client';
import { useUi } from '@/lib/i18n-client';
import {
  demoInsert,
  demoList,
  demoUpdate,
  subscribeDemoRealtime,
  type DemoRealtimeEvent,
} from '@/lib/modules/demo-data';

type Row = Record<string, any>;

const COMPLAINT_ACTIONS = ['IN_REVIEW', 'ACTION_TAKEN', 'RESOLVED', 'REJECTED_WITH_REASON'];

export default function GovernanceDashboardPage() {
  const session = useSession();
  const { t } = useUi();
  const toast = useToast();
  const [tab, setTab] = React.useState<'complaints' | 'allocations' | 'notices'>('complaints');
  const [complaints, setComplaints] = React.useState<Row[]>([]);
  const [allocations, setAllocations] = React.useState<Row[]>([]);
  const [notices, setNotices] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeComplaint, setActiveComplaint] = React.useState<Row | null>(null);
  const [status, setStatus] = React.useState('IN_REVIEW');
  const [resolution, setResolution] = React.useState('');
  const [noticeOpen, setNoticeOpen] = React.useState(false);
  const [notice, setNotice] = React.useState({ title: '', body: '', audience: 'ALL' });
  const [pending, setPending] = React.useState(false);

  const isGovernance =
    session.roles.some((role) => ['GOVERNANCE', 'GOVERNING_BODY'].includes(role)) ||
    (session.demo && session.roles.includes('GOVERNANCE'));

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      if (session.demo || !session.authenticated) {
        // demoList is campus-scoped: governance never sees other universities.
        setComplaints(demoList('complaints_public'));
        setAllocations(demoList('hall_allocations'));
        setNotices(demoList('governance_notices'));
      } else {
        const [c, a, n] = await Promise.all([
          fetch('/api/governance/complaints', { cache: 'no-store' }).then((r) => r.json()),
          fetch('/api/governance/hall-allocations', { cache: 'no-store' }).then((r) => r.json()),
          fetch('/api/governance/notices', { cache: 'no-store' }).then((r) => r.json()),
        ]);
        setComplaints(c?.success && Array.isArray(c.data) ? c.data : []);
        setAllocations(a?.success && Array.isArray(a.data) ? a.data : []);
        setNotices(n?.success && Array.isArray(n.data) ? n.data : []);
      }
    } catch {
      /* keep previous rows */
    } finally {
      setLoading(false);
    }
  }, [session.demo, session.authenticated]);

  React.useEffect(() => {
    if (!isGovernance) return;
    void load();
  }, [isGovernance, load]);

  React.useEffect(() => {
    if (!isGovernance) return;
    return subscribeDemoRealtime((_event: DemoRealtimeEvent) => {
      void load();
    });
  }, [isGovernance, load]);

  if (session.loading) {
    return <div className="my-12"><SkeletonList rows={4} /></div>;
  }

  if (!isGovernance) {
    return (
      <div className="max-w-xl mx-auto my-12 space-y-4">
        <ModuleHeader icon="🛡️" title="University Governance Dashboard" blurb="University governing bodies only." demo={session.demo} />
        <Card className="p-6 text-center space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t('Sign in with a governance account to moderate your campus.')}
          </p>
          <div className="flex justify-center gap-2">
            <Link href="/signin" className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold">
              {t('Sign In')}
            </Link>
            <Link href="/demo" className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold">
              {t('Demo accounts')}
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  async function updateComplaint() {
    if (!activeComplaint) return;
    setPending(true);
    try {
      const patch = { status, resolution_summary: resolution || activeComplaint.resolution_summary };
      if (session.demo) {
        demoUpdate('complaints_public', String(activeComplaint.id), patch);
        setComplaints(demoList('complaints_public'));
      } else {
        const response = await fetch(`/api/governance/complaints/${activeComplaint.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        const payload = await response.json();
        if (!payload?.success) {
          toast.show(payload?.error?.message_en ?? t('Verification failed'), 'rose');
          setPending(false);
          return;
        }
        await load();
      }
      toast.show(t('Status updated'));
      setActiveComplaint(null);
      setResolution('');
    } catch {
      toast.show(t('Verification failed'), 'rose');
    } finally {
      setPending(false);
    }
  }

  async function decideAllocation(row: Row, decision: 'APPROVED' | 'REJECTED') {
    setPending(true);
    try {
      const patch = { status: decision, decided_at: new Date().toISOString() };
      if (session.demo) {
        demoUpdate('hall_allocations', String(row.id), patch);
        setAllocations(demoList('hall_allocations'));
      } else {
        await fetch(`/api/governance/hall-allocations/${row.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        await load();
      }
      toast.show(decision === 'APPROVED' ? t('Approved') : t('Rejected'));
    } catch {
      toast.show(t('Verification failed'), 'rose');
    } finally {
      setPending(false);
    }
  }

  async function broadcastNotice() {
    if (!notice.title.trim() || !notice.body.trim()) {
      toast.show(`${t('Required')}: ${t('Title')} / ${t('Message')}`, 'rose');
      return;
    }
    setPending(true);
    try {
      if (session.demo) {
        demoInsert('governance_notices', {
          title: notice.title,
          body: notice.body,
          audience: notice.audience,
          created_by: session.userId,
        });
        setNotices(demoList('governance_notices'));
      } else {
        const response = await fetch('/api/governance/notices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(notice),
        });
        const payload = await response.json();
        if (!payload?.success) {
          toast.show(payload?.error?.message_en ?? t('Verification failed'), 'rose');
          setPending(false);
          return;
        }
        await load();
      }
      toast.show(t('Notice broadcast to students'));
      setNoticeOpen(false);
      setNotice({ title: '', body: '', audience: 'ALL' });
    } catch {
      toast.show(t('Verification failed'), 'rose');
    } finally {
      setPending(false);
    }
  }

  const openComplaints = complaints.filter((row) => !['RESOLVED', 'CLOSED'].includes(String(row.status)));
  const pendingAllocations = allocations.filter((row) => String(row.status) === 'PENDING');

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon="🛡️"
        title="University Governance Dashboard"
        titleBn="বিশ্ববিদ্যালয় গভর্ন্যান্স ড্যাশবোর্ড"
        blurb="Moderate civic complaints, approve hall allocations and broadcast notices — scoped to your own university only."
        demo={session.demo}
      >
        <Badge tone="violet">
          🏛️ {session.profile?.universities?.code ?? t('Your campus')}
        </Badge>
      </ModuleHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-slate-500">{t('Open grievances')}</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{openComplaints.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">{t('Hall allocations pending')}</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{pendingAllocations.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">{t('Notices broadcast')}</p>
          <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">{notices.length}</p>
        </Card>
      </div>

      <SectionHeader
        icon={tab === 'complaints' ? '🛡️' : tab === 'allocations' ? '🏠' : '📣'}
        title={
          tab === 'complaints'
            ? t('Civic complaints')
            : tab === 'allocations'
              ? t('Hall allocations')
              : t('Notice broadcasts')
        }
        subtitle={t('Every action is scoped to your university.')}
        actions={
          <div className="flex overflow-x-auto no-scrollbar gap-2 pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 w-full sm:w-auto">
            {(['complaints', 'allocations', 'notices'] as const).map((key) => (
              <Button
                key={key}
                size="sm"
                variant={tab === key ? 'primary' : 'outline'}
                onClick={() => setTab(key)}
                className="shrink-0 whitespace-nowrap"
              >
                {t(key === 'complaints' ? 'Civic complaints' : key === 'allocations' ? 'Hall allocations' : 'Notice broadcasts')}
              </Button>
            ))}
            {tab === 'notices' && (
              <Button size="sm" onClick={() => setNoticeOpen(true)} className="shrink-0 whitespace-nowrap">
                ＋ {t('Broadcast notice')}
              </Button>
            )}
          </div>
        }
      />

      {loading ? (
        <SkeletonList rows={3} />
      ) : tab === 'complaints' ? (
        complaints.length === 0 ? (
          <EmptyState icon="🛡️" title={t('No complaints yet')} description={t('Civic board tickets will appear here for moderation.')} />
        ) : (
          <Card className="divide-y divide-slate-100 dark:divide-slate-800">
            {complaints.map((row) => (
              <div key={String(row.id)} className="p-4 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{String(row.title ?? '')}</p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {String(row.tracking_code ?? row.id)} · ▲ {Number(row.upvotes_count ?? 0)} {t('Upvotes')}
                  </p>
                </div>
                <Badge tone={String(row.status) === 'RESOLVED' ? 'emerald' : String(row.status) === 'REJECTED_WITH_REASON' ? 'rose' : 'amber'}>
                  {String(row.status ?? '').replace(/_/g, ' ')}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setActiveComplaint(row);
                    setStatus(COMPLAINT_ACTIONS.includes(String(row.status)) ? String(row.status) : 'IN_REVIEW');
                    setResolution('');
                  }}
                >
                  {t('Moderate')}
                </Button>
                {row.tracking_code && (
                  <Link
                    href={`/track/${encodeURIComponent(String(row.tracking_code))}`}
                    className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 underline"
                  >
                    {t('Track')} →
                  </Link>
                )}
              </div>
            ))}
          </Card>
        )
      ) : tab === 'allocations' ? (
        allocations.length === 0 ? (
          <EmptyState icon="🏠" title={t('No allocations yet')} description={t('Hall seat requests will appear here.')} />
        ) : (
          <Card className="divide-y divide-slate-100 dark:divide-slate-800">
            {allocations.map((row) => (
              <div key={String(row.id)} className="p-4 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">
                    {String(row.student_name ?? '')} · {String(row.hall_name ?? row.hall_id ?? '')}
                  </p>
                  <p className="text-[11px] text-slate-400">{String(row.student_email ?? '')} · {String(row.student_id ?? '')}</p>
                  {row.note && <p className="text-[11px] text-slate-500 mt-0.5">{String(row.note)}</p>}
                </div>
                <Badge tone={String(row.status) === 'APPROVED' ? 'emerald' : String(row.status) === 'REJECTED' ? 'rose' : 'amber'}>
                  {String(row.status ?? 'PENDING')}
                </Badge>
                {String(row.status) === 'PENDING' && (
                  <>
                    <Button size="sm" loading={pending} onClick={() => void decideAllocation(row, 'APPROVED')}>
                      {t('Approve')}
                    </Button>
                    <Button size="sm" variant="danger" loading={pending} onClick={() => void decideAllocation(row, 'REJECTED')}>
                      {t('Reject')}
                    </Button>
                  </>
                )}
              </div>
            ))}
          </Card>
        )
      ) : notices.length === 0 ? (
        <EmptyState icon="📣" title={t('No notices yet')} description={t('Broadcast your first notice to students.')} action={<Button onClick={() => setNoticeOpen(true)}>＋ {t('Broadcast notice')}</Button>} />
      ) : (
        <Card className="divide-y divide-slate-100 dark:divide-slate-800">
          {notices.map((row) => (
            <div key={String(row.id)} className="p-4">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold flex-1">{String(row.title ?? '')}</p>
                <Badge tone="violet">{String(row.audience ?? 'ALL')}</Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{String(row.body ?? '')}</p>
              <p className="text-[10px] text-slate-400 mt-1">{row.created_at ? new Date(String(row.created_at)).toLocaleString() : ''}</p>
            </div>
          ))}
        </Card>
      )}

      {/* Complaint moderation drawer */}
      <Modal
        open={Boolean(activeComplaint)}
        onClose={() => setActiveComplaint(null)}
        title={`${t('Moderate')} — ${String(activeComplaint?.tracking_code ?? '')}`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setActiveComplaint(null)}>
              {t('Cancel')}
            </Button>
            <Button loading={pending} onClick={() => void updateComplaint()}>
              {t('Save changes')}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm font-semibold">{String(activeComplaint?.title ?? '')}</p>
          <p className="text-xs text-slate-500">{String(activeComplaint?.description ?? '')}</p>
          <Field label={t('Status')}>
            <Select
              options={COMPLAINT_ACTIONS.map((value) => ({ value, label: value.replace(/_/g, ' ') }))}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            />
          </Field>
          <Field label={t('Resolution note')} hint={t('Visible on the public tracking timeline.')}>
            <Textarea value={resolution} onChange={(event) => setResolution(event.target.value)} />
          </Field>
        </div>
      </Modal>

      {/* Broadcast notice drawer */}
      <Modal
        open={noticeOpen}
        onClose={() => setNoticeOpen(false)}
        title={t('Broadcast notice')}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setNoticeOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button loading={pending} onClick={() => void broadcastNotice()}>
              {t('Broadcast notice')}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label={`${t('Title')} *`}>
            <Input value={notice.title} onChange={(event) => setNotice((prev) => ({ ...prev, title: event.target.value }))} />
          </Field>
          <Field label={`${t('Message')} *`}>
            <Textarea value={notice.body} onChange={(event) => setNotice((prev) => ({ ...prev, body: event.target.value }))} />
          </Field>
          <Field label={t('Audience')}>
            <Select
              options={[
                { value: 'ALL', label: t('All') },
                { value: 'STUDENTS', label: t('Students') },
                { value: 'FACULTY', label: t('Faculty / Staff') },
                { value: 'RESIDENTS', label: t('Residents') },
              ]}
              value={notice.audience}
              onChange={(event) => setNotice((prev) => ({ ...prev, audience: event.target.value }))}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
