// apps/web/app/civic/page.tsx
'use client';

import React from 'react';
import Link from 'next/link';
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
import { useApiList, useRealtimeTable, useSession, useModuleMutation, Row } from '@/lib/modules/client';
import { trySupabaseBrowser } from '@/lib/supabase-browser';
import { timeAgo } from '@/lib/utils';
import { useUi } from '@/lib/i18n-client';
import { demoUpdate } from '@/lib/modules/demo-data';
import { asArray } from '@/lib/render-safe';

const CATEGORIES = [
  'INFRASTRUCTURE',
  'SECURITY',
  'TRANSPORT',
  'HALL_RESIDENCE',
  'HEALTH',
  'ACADEMIC',
  'OTHER',
];

const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const CATEGORY_LABELS: Record<string, string> = {
  INFRASTRUCTURE: 'Infrastructure',
  SECURITY: 'Security',
  TRANSPORT: 'Transport',
  HALL_RESIDENCE: 'Hall / Residence',
  HEALTH: 'Health',
  ACADEMIC: 'Academic',
  OTHER: 'Other',
};

const SEVERITY_LABELS: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: 'Submitted',
  ACKNOWLEDGED: 'Acknowledged',
  IN_REVIEW: 'In Review',
  ACTION_TAKEN: 'Action Taken',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  REJECTED_WITH_REASON: 'Rejected',
};

export default function CivicPage() {
  const session = useSession();
  const { t } = useUi();
  const [category, setCategory] = React.useState('ALL');
  const [severity, setSeverity] = React.useState('ALL');
  const [search, setSearch] = React.useState('');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [upvoted, setUpvoted] = React.useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState({
    title: '',
    category: 'INFRASTRUCTURE',
    severity: 'HIGH',
    description: '',
    location_hint: '',
    evidence_urls: '',
  });
  const [created, setCreated] = React.useState<{ trackingCode?: string; complaint?: Row } | null>(null);
  const toast = useToast();

  const tickets = useApiList('/api/civic/tickets', {
    query: { limit: 60 },
    table: 'complaints_public',
    enabled: !!session.authenticated,
  });
  const upvoteMutation = useModuleMutation('complaint-upvotes');

  // Live status/upvote propagation for the public board.
  useRealtimeTable(
    'complaints',
    {
      onInsert: () => tickets.refresh(),
      onUpdate: () => tickets.refresh(),
    },
    { enabled: !!session.authenticated && !tickets.demo }
  );

  const filtered = React.useMemo(
    () =>
      asArray(tickets.data).filter((ticket) => {
        if (ticket.is_public_issue === false) return false;
        if (category !== 'ALL' && String(ticket.category) !== category) return false;
        if (severity !== 'ALL' && String(ticket.severity) !== severity) return false;
        if (search) {
          const needle = search.toLowerCase();
          const haystack = `${ticket.title ?? ''} ${ticket.description ?? ''} ${ticket.tracking_code ?? ''}`.toLowerCase();
          if (!haystack.includes(needle)) return false;
        }
        return true;
      }),
    [tickets.data, category, severity, search]
  );

  const stats = React.useMemo(() => {
    const open = asArray(tickets.data).filter((ticket) => !['RESOLVED', 'CLOSED'].includes(String(ticket.status))).length;
    const resolved = asArray(tickets.data).filter((ticket) => ['RESOLVED', 'CLOSED'].includes(String(ticket.status))).length;
    const critical = asArray(tickets.data).filter((ticket) => String(ticket.severity) === 'CRITICAL').length;
    const upvotes = asArray(tickets.data).reduce((sum, ticket) => sum + Number(ticket.upvotes_count ?? 0), 0);
    return { open, resolved, critical, upvotes };
  }, [tickets.data]);

  async function toggleUpvote(ticket: Row) {
    const id = String(ticket.id);
    if (upvoted[id]) {
      toast.show(t('You already upvoted this issue.'), 'amber');
      return;
    }
    if (session.demo) {
      const updated = demoUpdate('complaints_public', id, {
        upvotes_count: Number(ticket.upvotes_count ?? 0) + 1,
      });
      setUpvoted((prev) => ({ ...prev, [id]: true }));
      if (updated) {
        tickets.setData((prev) =>
          prev.map((item) => (String(item.id) === id ? { ...item, ...updated } : item))
        );
      }
      toast.show(t('Upvoted — this pushes the issue up the admin queue.'));
      return;
    }
    const result = await upvoteMutation.create({ complaint_id: id });
    if (result.ok) {
      setUpvoted((prev) => ({ ...prev, [id]: true }));
      tickets.setData((prev) =>
        prev.map((item) =>
          String(item.id) === id ? { ...item, upvotes_count: Number(item.upvotes_count ?? 0) + 1 } : item
        )
      );
      toast.show(t('Upvoted — this pushes the issue up the admin queue.'));
      return;
    }
    if (result.error?.toLowerCase().includes('already')) {
      setUpvoted((prev) => ({ ...prev, [id]: true }));
      toast.show(t('You already upvoted this issue.'), 'amber');
      return;
    }
    toast.show(result.error ?? t('Could not upvote.'), 'rose');
  }

  async function submitTicket(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (session.demo) {
        // Preview mode: record locally so the full flow is explorable.
        const { demoInsert } = await import('@/lib/modules/demo-data');
        const code = `JU-CASE-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 899999)}`;
        demoInsert('complaints_public', {
          tracking_code: code,
          title: form.title,
          category: form.category,
          severity: form.severity,
          status: 'SUBMITTED',
          upvotes_count: 0,
          is_public_issue: true,
          location_hint: form.location_hint,
          evidence_urls: form.evidence_urls ? form.evidence_urls.split(',').map((v) => v.trim()).filter(Boolean) : [],
          sla_due_at: new Date(Date.now() + 96 * 3600_000).toISOString(),
        });
        setCreated({ trackingCode: code });
        tickets.refresh();
        toast.show(`${t('Case Filed Successfully')} — ${code}`);
        setCreateOpen(false);
        return;
      }

      const res = await fetch('/api/civic/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          category: form.category,
          severity: form.severity,
          description: form.description,
          location_hint: form.location_hint,
          evidence_urls: form.evidence_urls
            ? form.evidence_urls.split(',').map((value) => value.trim()).filter(Boolean)
            : [],
        }),
      });
      const payload = await res.json();
      if (!payload.success) {
        toast.show(payload?.error?.message_en ?? t('Could not submit ticket.'), 'rose');
        return;
      }
      setCreated({
        trackingCode: payload.data?.tracking_code ?? payload.meta?.trackingCode,
        complaint: payload.data as Row,
      });
      setCreateOpen(false);
      tickets.refresh();
      toast.show(t('Case Filed Successfully'));
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Network error', 'rose');
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadEvidence(file: File) {
    const supabase = trySupabaseBrowser();
    if (!supabase || session.demo) {
      toast.show(t('Photo evidence'), 'amber');
      return;
    }
    const path = `${session.profile?.university_id ?? 'campus'}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]+/g, '-')}`;
    const { error } = await supabase.storage.from('campus-media').upload(path, file, { upsert: false });
    if (error) {
      toast.show(error.message, 'rose');
      return;
    }
    const { data } = supabase.storage.from('campus-media').getPublicUrl(path);
    setForm((prev) => ({
      ...prev,
      evidence_urls: [prev.evidence_urls, data.publicUrl].filter(Boolean).join(', '),
    }));
    toast.show(t('Photo evidence'));
  }

  if (!session.loading && !session.authenticated) {
    return (
      <div className="space-y-6">
        <ModuleHeader
          icon="🛡️"
          title="Civic Ticketing & Complaint Box"
          titleBn="সিভিক টিকিটিং ও অভিযোগ বক্স"
          blurb="Report broken infrastructure or unsafe areas with photo evidence, upvote to prioritise, and track admin resolution live."
        />
        <SignInPrompt moduleName="civic ticketing" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        icon="🛡️"
        title={t('Civic Ticketing & Complaint Box')}
        titleBn={t('Civic Ticketing & Complaint Box')}
        blurb={t('Report campus infrastructure or security issues with photo evidence. Upvotes decide the priority queue, and the moment an administrator resolves a ticket the status updates here — no refresh needed.')}
        live
        demo={tickets.demo}
      >
        <Button onClick={() => setCreateOpen(true)}>+ {t('Report an issue')}</Button>
      </ModuleHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label={t('Open tickets')} value={stats.open} hint={t('In queue')} tone="amber" />
        <Stat label={t('Resolved')} value={stats.resolved} hint={t('Resolved')} />
        <Stat label={t('Critical')} value={stats.critical} hint={t('Needs escalation')} tone="rose" />
        <Stat label={t('Citizen upvotes')} value={stats.upvotes} hint={t('Upvotes')} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/admin/console"
          className="px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 text-white"
        >
          🏛️ {t('Admin resolution console')}
        </Link>
        <Link
          href="/complaints"
          className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-300 dark:border-slate-700"
        >
          {t('Formal grievance (SLA tracked)')}
        </Link>
        <Link
          href="/complaints/track"
          className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-300 dark:border-slate-700"
        >
          {t('Track a case')}
        </Link>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-2">
          <Input
            placeholder={t('Search tickets by title or tracking code…')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label={t('Search')}
          />
          <Select
            aria-label={t('Severity')}
            value={severity}
            onChange={(event) => setSeverity(event.target.value)}
            placeholder={t('All severities')}
            className="md:max-w-[200px]"
            options={SEVERITIES.map((value) => ({ value, label: t(SEVERITY_LABELS[value]) }))}
          />
        </div>
        <FilterChips
          label={t('Category')}
          value={category}
          onChange={setCategory}
          options={CATEGORIES.map((value) => ({ value, label: t(CATEGORY_LABELS[value]) }))}
        />
      </Card>

      {tickets.loading ? (
        <SkeletonList rows={3} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🛠️"
          title={t('No public tickets match your filters')}
          description={t('Report campus infrastructure or security issues with photo evidence. Upvotes decide the priority queue, and the moment an administrator resolves a ticket the status updates here — no refresh needed.')}
          action={<Button onClick={() => setCreateOpen(true)}>{t('Report the first issue')}</Button>}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((ticket) => {
            const id = String(ticket.id);
            const hasUpvoted = Boolean(upvoted[id]);
            return (
              <Card key={id} className="p-4">
                <div className="flex gap-4">
                  <div className="flex flex-col items-center shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleUpvote(ticket)}
                      aria-pressed={hasUpvoted}
                      aria-label={`Upvote ${ticket.title}`}
                      className={`w-12 py-2 rounded-xl border text-center transition ${
                        hasUpvoted
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="block text-base leading-none">▲</span>
                      <span className="block text-xs font-bold mt-1">{Number(ticket.upvotes_count ?? 0)}</span>
                    </button>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={statusTone(ticket.status)}>{t(STATUS_LABELS[String(ticket.status)] ?? String(ticket.status))}</Badge>
                      <Badge tone={statusTone(ticket.severity)}>{t(SEVERITY_LABELS[String(ticket.severity)] ?? String(ticket.severity))}</Badge>
                      <Badge tone="slate">{t(CATEGORY_LABELS[String(ticket.category)] ?? String(ticket.category))}</Badge>
                      <span className="text-[11px] font-mono text-slate-400">{ticket.tracking_code}</span>
                      <Link
                        href={`/track/${encodeURIComponent(String(ticket.tracking_code ?? ''))}`}
                        className="ml-auto text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        {t('Track')} →
                      </Link>
                    </div>
                    <h3 className="font-bold text-sm">{ticket.title}</h3>
                    {ticket.location_hint && (
                      <p className="text-[11px] text-slate-400">📍 {ticket.location_hint}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                      <span>🕒 {timeAgo(ticket.created_at)}</span>
                      {ticket.sla_due_at && <span>⏳ SLA due {new Date(String(ticket.sla_due_at)).toLocaleDateString('en-GB')}</span>}
                      {ticket.sla_breached && <Badge tone="rose">SLA breached</Badge>}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="p-4">
        <SectionHeader
          icon="ℹ️"
          title={t('How Civic Ticketing differs from a formal grievance')}
          subtitle={t('Civic tickets are public, upvote-driven maintenance/security reports.')}
        />
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          {t('Anything involving harassment, ragging or discrimination belongs in the SLA-tracked formal grievance system, where anonymity and escalation are enforced by the database.')}
        </p>
        <Link href="/complaints" className="inline-block mt-1 text-xs text-emerald-500 font-semibold">
          {t('Formal grievance (SLA tracked)')} →
        </Link>
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t('Report a campus issue')} wide>
        <form onSubmit={submitTicket} className="space-y-3">
          <Field label={t('Issue title')}>
            <Input
              required
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder={t('Location on campus')}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t('Category')}>
              <Select
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                options={CATEGORIES.map((value) => ({ value, label: t(CATEGORY_LABELS[value]) }))}
              />
            </Field>
            <Field label={t('Severity')}>
              <Select
                value={form.severity}
                onChange={(event) => setForm((prev) => ({ ...prev, severity: event.target.value }))}
                options={SEVERITIES.map((value) => ({ value, label: t(SEVERITY_LABELS[value]) }))}
              />
            </Field>
          </div>
          <Field label={t('What is happening?')}>
            <textarea
              required
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              className="w-full rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 min-h-[110px]"
              placeholder={t('What is happening?')}
            />
          </Field>
          <Field label={t('Location on campus')}>
            <Input
              value={form.location_hint}
              onChange={(event) => setForm((prev) => ({ ...prev, location_hint: event.target.value }))}
              placeholder={t('Location on campus')}
            />
          </Field>
          <Field label={t('Photo evidence')} hint={t('Optional — adds a second verification factor')}>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadEvidence(file);
              }}
              className="text-xs"
            />
          </Field>
          {form.evidence_urls && (
            <p className="text-[11px] text-emerald-500 break-all">Attached: {form.evidence_urls}</p>
          )}
          <div className="flex items-center gap-2">
            <Button type="submit" loading={submitting}>
              {t('Submit ticket')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              {t('Cancel')}
            </Button>
          </div>
        </form>
      </Modal>

      {created && (
        <Modal open onClose={() => setCreated(null)} title={t('Case Filed Successfully')}>
          <div className="space-y-3 text-sm">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('Paste your ticket ID to see the live status timeline.')}
            </p>
            <div className="p-3 rounded-xl bg-emerald-500/10 font-mono text-center text-emerald-600 dark:text-emerald-300 font-bold">
              {created.trackingCode}
            </div>
            <div className="flex gap-2">
              <Link
                href={`/complaints/track?code=${created.trackingCode ?? ''}`}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 text-white"
              >
                {t('Track a case')}
              </Link>
              <Button variant="secondary" onClick={() => setCreated(null)}>
                {t('Continue')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {toast.node}
    </div>
  );
}
