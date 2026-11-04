// apps/web/app/skills/page.tsx
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
  statusTone,
  useToast,
} from '@/components/modules/ui';
import { ModuleForm } from '@/components/modules/ModuleForm';
import { useModuleMutation, useRealtimeModuleList, useRealtimeTable, useSession, Row } from '@/lib/modules/client';
import { formatBdt, timeAgo, toStringArray} from '@/lib/utils';
import { useUi } from '@/lib/i18n-client';
import { CampusBadge } from '@/components/CampusBadge';

const TYPE_META: Record<string, { icon: string; label: string }> = {
  TUTORING: { icon: '📘', label: 'Tutoring' },
  FREELANCE: { icon: '🎨', label: 'Freelance' },
  PART_TIME_JOB: { icon: '💼', label: 'Part-time job' },
  INTERNSHIP: { icon: '🚀', label: 'Internship' },
};

export default function SkillsPage() {
  const session = useSession();
  const { t } = useUi();
  const [type, setType] = React.useState('ALL');
  const [availability, setAvailability] = React.useState('ALL');
  const [search, setSearch] = React.useState('');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [alertOpen, setAlertOpen] = React.useState(false);
  const [applyTarget, setApplyTarget] = React.useState<Row | null>(null);
  const [alertKeywords, setAlertKeywords] = React.useState('');
  const [alertCategories, setAlertCategories] = React.useState('');
  const [alertPrefilled, setAlertPrefilled] = React.useState(false);
  const [alertPending, setAlertPending] = React.useState(false);
  const toast = useToast();

  const postings = useRealtimeModuleList('skills', {
    filters: { type, availability },
    search,
    limit: 60,
    enabled: !!session.authenticated,
  });
  const alerts = useRealtimeModuleList('skill-alerts', { limit: 5, enabled: !!session.authenticated });
  const { create } = useModuleMutation('skills');
  const applicationMutation = useModuleMutation('skill-applications');
  const alertMutation = useModuleMutation('skill-alerts');

  const [liveBanner, setLiveBanner] = React.useState<string | null>(null);

  // Realtime notification toast for brand-new postings (per university).
  useRealtimeTable(
    'skill_postings',
    {
      onInsert: (row) => {
        setLiveBanner(`New ${TYPE_META[String(row.type)]?.label ?? 'posting'}: ${row.title}`);
        setTimeout(() => setLiveBanner(null), 6000);
      },
    },
    { enabled: !!session.authenticated }
  );

  const myAlert = alerts.data[0] ?? null;

  async function handleCreate(values: Row) {
    const result = await create(values);
    if (result.ok) {
      setCreateOpen(false);
      postings.refresh();
      toast.show('Posting published — students will be alerted if it matches their skills.');
      return { ok: true };
    }
    return { ok: false, error: result.error };
  }

  async function saveAlert() {
    setAlertPending(true);
    const result = await alertMutation.create({
      keywords: alertKeywords
        ? alertKeywords
        : (toStringArray(myAlert?.keywords).join(', ')),
      categories: alertCategories
        ? alertCategories
        : (toStringArray(myAlert?.categories).join(', ')),
    });
    setAlertPending(false);
    if (result.ok) {
      setAlertOpen(false);
      alerts.refresh();
      toast.show('Skill alert saved — you will be notified instantly on new matches.');
    } else {
      toast.show(result.error ?? 'Could not save alert.', 'rose');
    }
  }

  async function applyWithMessage(message: string): Promise<{ ok: boolean }> {
    if (!applyTarget) return { ok: false };
    const result = await applicationMutation.create({ posting_id: applyTarget.id, message });
    if (result.ok) {
      toast.show('Application sent.');
      setApplyTarget(null);
      postings.refresh();
      return { ok: true };
    }
    toast.show(result.error ?? 'Could not apply.', 'rose');
    return { ok: false };
  }

  if (!session.loading && !session.authenticated) {
    return (
      <div className="space-y-6">
        <ModuleHeader
          icon="🎓"
          title={t('Skill Hub & Jobs')}
          titleBn={t('Skill Hub & Jobs')}
          blurb={t('Peer tutoring, freelance skills and part-time campus jobs.')}
        />
        <SignInPrompt moduleName="the Skill Hub" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        icon="🎓"
        title="Skill Hub, Tutoring & Part-Time Jobs"
        titleBn="স্কিল হাব, টিউটরিং ও পার্ট-টাইম কাজ"
        blurb={t('Peer tutoring, freelance skills and part-time campus jobs.')}
        live
        demo={postings.demo}
      >
        <Badge tone="teal">{postings.total} open postings</Badge>
        <Button
          variant="secondary"
          onClick={() => {
            if (!alertPrefilled && myAlert) {
              setAlertKeywords(toStringArray(myAlert.keywords).join(', '));
              setAlertCategories(toStringArray(myAlert.categories).join(', '));
              setAlertPrefilled(true);
            }
            setAlertOpen(true);
          }}
        >
          🔔 Skill alerts
        </Button>
        <Button onClick={() => setCreateOpen(true)}>+ Post an opportunity</Button>
      </ModuleHeader>

      {liveBanner && (
        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          🔔 {liveBanner}
        </div>
      )}

      {myAlert && (
        <Card className="p-3 text-xs flex flex-wrap items-center gap-2">
          <span className="font-semibold">Active alert:</span>
          {toStringArray(myAlert.keywords).map((keyword) => (
            <Badge key={keyword} tone="teal">
              {keyword}
            </Badge>
          ))}
          {toStringArray(myAlert.categories).map((category) => (
            <Badge key={category} tone="amber">
              {category}
            </Badge>
          ))}
          {!toStringArray(myAlert.keywords).length && !toStringArray(myAlert.categories).length && (
            <span className="text-slate-400">Add keywords to start matching.</span>
          )}
          <button type="button" onClick={() => setAlertOpen(true)} className="ml-auto text-emerald-500 font-semibold">
            Edit
          </button>
        </Card>
      )}

      <Card className="p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-2">
          <Input
            placeholder="Search “python”, “IELTS”, “design”…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search postings"
          />
          <Select
            value={availability}
            onChange={(event) => setAvailability(event.target.value)}
            aria-label="Availability"
            placeholder="Any availability"
            className="md:max-w-[220px]"
            options={[
              { value: 'FLEXIBLE', label: 'Flexible' },
              { value: 'WEEKDAYS', label: 'Weekdays' },
              { value: 'WEEKENDS', label: 'Weekends' },
              { value: 'EVENINGS', label: 'Evenings' },
              { value: 'MORNING', label: 'Morning' },
            ]}
          />
        </div>
        <FilterChips
          label="Type"
          value={type}
          onChange={setType}
          options={[
            { value: 'TUTORING', label: '📘 Tutoring' },
            { value: 'FREELANCE', label: '🎨 Freelance' },
            { value: 'PART_TIME_JOB', label: '💼 Part-time' },
            { value: 'INTERNSHIP', label: '🚀 Internship' },
          ]}
        />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {postings.loading ? (
            <SkeletonList rows={3} />
          ) : postings.error ? (
            <EmptyState icon="⚠️" title="Could not load postings" description={postings.error} action={<Button onClick={postings.refresh}>Retry</Button>} />
          ) : postings.data.length === 0 ? (
            <EmptyState
              icon="🎓"
              title="No postings match your filters"
              description="Try a different category, or publish your own tutoring or freelance offer."
              action={<Button onClick={() => setCreateOpen(true)}>Post an opportunity</Button>}
            />
          ) : (
            postings.data.map((posting) => (
              <Card key={String(posting.id)} className="p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="teal">
                    {TYPE_META[String(posting.type)]?.icon} {TYPE_META[String(posting.type)]?.label ?? posting.type}
                  </Badge>
                  <Badge tone={statusTone(posting.status)}>{String(posting.status)}</Badge>
                  <CampusBadge universityId={posting.university_id} />
                  {posting.is_remote && <Badge tone="sky">Remote</Badge>}
                  <span className="text-[11px] text-slate-400 ml-auto">🕒 {timeAgo(posting.created_at)}</span>
                </div>
                <h3 className="font-bold text-sm">{posting.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{posting.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {toStringArray(posting.skills).map((skill) => (
                    <span key={skill} className="px-2 py-0.5 rounded-lg text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300">
                      {skill}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="text-[11px] text-slate-400 space-x-3">
                    <span>📍 {posting.location_en || 'Campus'}</span>
                    <span>🕐 {posting.availability}</span>
                    <span>👥 {posting.applicants_count ?? 0} applied</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {posting.rate_bdt ? (
                      <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                        {formatBdt(posting.rate_bdt)}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Negotiable</span>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => setApplyTarget(posting)}>
                      Apply
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-4 space-y-2">
            <SectionHeader icon="🔔" title="How alerts work" />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Save keywords such as <em>python</em>, <em>physics</em> or <em>design</em>. When a new posting matches,
              Campus360 inserts a notification and Supabase Realtime pushes it to your open tabs instantly.
            </p>
            <Button size="sm" variant="secondary" onClick={() => setAlertOpen(true)}>
              Configure alerts
            </Button>
          </Card>
          <Card className="p-4 space-y-2 text-xs">
            <div className="font-bold text-sm">Fair-use policy</div>
            <p className="text-slate-500 dark:text-slate-400">
              Payments for tutoring or freelance work happen directly between students. Keep receipts and rate your
              experience in the Trust panel — repeated no-shows lose posting rights.
            </p>
          </Card>
        </div>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Post a tutoring, freelance or job opportunity" wide>
        <ModuleForm
          moduleKey="skills"
          omit={['status']}
          submitLabel="Publish posting"
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
        />
      </Modal>

      <Modal
        open={alertOpen}
        onClose={() => setAlertOpen(false)}
        title="Skill match alerts"
        footer={
          <Button onClick={saveAlert} loading={alertPending}>
            Save alerts
          </Button>
        }
      >
        <div className="space-y-3">
          <Field label="Keywords" hint="Comma separated — e.g. python, physics, IELTS">
            <Input
              value={alertKeywords}
              onChange={(event) => setAlertKeywords(event.target.value)}
              placeholder="python, physics, IELTS"
            />
          </Field>
          <Field label="Categories" hint="Comma separated — e.g. Academic, Design">
            <Input
              value={alertCategories}
              onChange={(event) => setAlertCategories(event.target.value)}
              placeholder="Academic, Design"
            />
          </Field>
          <p className="text-[11px] text-slate-400">
            Matching runs server-side on every new posting, so alerts arrive even when this page is closed.
          </p>
        </div>
      </Modal>

      {applyTarget && (
        <ApplyModal
          posting={applyTarget}
          onClose={() => setApplyTarget(null)}
          onSubmit={applyWithMessage}
        />
      )}

      {toast.node}
    </div>
  );
}

function ApplyModal({
  posting,
  onClose,
  onSubmit,
}: {
  posting: Row;
  onClose: () => void;
  onSubmit: (message: string) => Promise<{ ok: boolean }>;
}) {
  const [message, setMessage] = React.useState('');
  const [pending, setPending] = React.useState(false);

  return (
    <Modal
      open
      onClose={onClose}
      title={`Apply — ${posting.title}`}
      footer={
        <Button
          loading={pending}
          onClick={async () => {
            setPending(true);
            await onSubmit(message);
            setPending(false);
          }}
        >
          Send application
        </Button>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">{posting.description}</p>
        <Field label="Introduce yourself">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 min-h-[100px]"
            placeholder="Share your experience, availability and how you can help."
          />
        </Field>
      </div>
    </Modal>
  );
}
