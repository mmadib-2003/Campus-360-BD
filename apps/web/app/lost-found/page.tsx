// apps/web/app/lost-found/page.tsx
'use client';

import React from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
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
import { timeAgo, toStringArray} from '@/lib/utils';
import { useUi } from '@/lib/i18n-client';
import { CampusBadge } from '@/components/CampusBadge';

const CATEGORIES = ['ID Card', 'Bag', 'Phone', 'Laptop', 'Keys', 'Wallet', 'Books', 'Cycle', 'Gadget', 'Other'];

export default function LostFoundPage() {
  const session = useSession();
  const { t } = useUi();
  const [kind, setKind] = React.useState<'LOST' | 'FOUND'>('LOST');
  const [category, setCategory] = React.useState('ALL');
  const [search, setSearch] = React.useState('');
  const [postOpen, setPostOpen] = React.useState(false);
  const [matchBanner, setMatchBanner] = React.useState<Row | null>(null);
  const toast = useToast();

  const items = useRealtimeModuleList('lost-found', {
    filters: { kind, category },
    search,
    limit: 60,
  });
  const matches = useRealtimeModuleList('lost-item-matches', { limit: 50, enabled: !!session.authenticated });
  const itemMutation = useModuleMutation('lost-found');

  // Instant banner when anyone posts an item in this university.
  useRealtimeTable(
    'lost_items',
    {
      onInsert: (row) => {
        if (String(row.reporter_id) !== String(session.userId)) {
          setMatchBanner(row);
          setTimeout(() => setMatchBanner(null), 10000);
        }
      },
    },
    { enabled: !!session.authenticated }
  );

  const stats = React.useMemo(
    () => ({
      lost: items.data.filter((item) => String(item.kind) === 'LOST' && String(item.status) === 'OPEN').length,
      found: items.data.filter((item) => String(item.kind) === 'FOUND' && String(item.status) === 'OPEN').length,
      resolved: items.data.filter((item) => String(item.status) === 'RESOLVED').length,
    }),
    [items.data]
  );

  async function resolve(item: Row) {
    const result = await itemMutation.update(String(item.id), { status: 'RESOLVED' });
    if (result.ok) {
      items.refresh();
      toast.show('Marked as resolved — thank you for updating the board.');
    } else {
      toast.show(result.error ?? 'Could not update item.', 'rose');
    }
  }

  if (!session.loading && !session.authenticated) {
    return (
      <div className="space-y-6">
        <ModuleHeader
          icon="🔍"
          title={t('Lost & Found')}
          titleBn={t('Lost & Found')}
          blurb={t('Report lost items and reunite them with verified campus finders.')}
        />
        <SignInPrompt moduleName="Lost & Found" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        icon="🔍"
        title="Lost & Found"
        titleBn="হারানো ও প্রাপ্তি"
        blurb={t('Report lost items and reunite them with verified campus finders.')}
        live
        demo={items.demo}
      >
        <Button onClick={() => setPostOpen(true)}>+ Post an item</Button>
      </ModuleHeader>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Lost (open)" value={stats.lost} tone="amber" />
        <Stat label="Found (open)" value={stats.found} />
        <Stat label="Reunited" value={stats.resolved} hint="Marked resolved" />
      </div>

      {matchBanner && (
        <div role="alert" className="p-3 rounded-2xl bg-violet-500/10 border border-violet-500/40 text-xs font-semibold text-violet-700 dark:text-violet-300">
          🔔 New {String(matchBanner.kind).toLowerCase()} item posted: “{String(matchBanner.title)}” —{' '}
          {String(matchBanner.location_en ?? 'campus')}. If it is yours, open the board now.
        </div>
      )}

      <Card className="p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-2">
          <Input
            placeholder="Search “blue backpack”, “ID card”…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search items"
          />
          <Select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="Category"
            placeholder="All categories"
            className="md:max-w-[200px]"
            options={CATEGORIES.map((value) => ({ value, label: value }))}
          />
        </div>
        <div className="flex gap-2">
          {(['LOST', 'FOUND'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setKind(value)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${
                kind === value
                  ? 'bg-violet-500/15 text-violet-600 dark:text-violet-300 border-violet-500/40'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
              }`}
            >
              {value === 'LOST' ? t('Lost') + ' 😟' : t('Found') + ' 🙌'}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {items.loading ? (
            <SkeletonList rows={3} />
          ) : items.data.length === 0 ? (
            <EmptyState
              icon="🔍"
              title={`${t('No listings found')}`}
              description={t('Report lost items and reunite them with verified campus finders.')}
              action={<Button onClick={() => setPostOpen(true)}>{t('New listing')}</Button>}
            />
          ) : (
            items.data.map((item) => (
              <Card key={String(item.id)} className="p-4 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={String(item.kind) === 'LOST' ? 'amber' : 'emerald'}>{String(item.kind)}</Badge>
                  <Badge tone="slate">{String(item.category)}</Badge>
                  <CampusBadge universityId={item.university_id} />
                  <Badge tone={statusTone(item.status)}>{String(item.status)}</Badge>
                  <span className="text-[11px] text-slate-400 ml-auto">🕒 {timeAgo(item.created_at)}</span>
                </div>
                <h3 className="font-bold text-sm">{item.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{item.description}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                  <span>📍 {item.location_en || 'Campus'}</span>
                  {item.occurred_on && <span>• 📅 {String(item.occurred_on)}</span>}
                  <span>• 👤 {(item.profiles as Row)?.full_name ?? 'Student'}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {toStringArray(item.keywords).map((keyword) => (
                    <span key={keyword} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 dark:text-slate-300">
                      #{keyword}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  {item.contact_note && <span className="text-[11px] text-slate-400">📞 {item.contact_note}</span>}
                  {String(item.status) === 'OPEN' && String(item.reporter_id) === String(session.userId) && (
                    <Button size="sm" variant="secondary" onClick={() => resolve(item)}>
                      Mark resolved
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSearch(String(item.title).split(' ').slice(0, 2).join(' '));
                      toast.show(t('Lost & Found'));
                    }}
                  >
                    Find similar
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-4 space-y-2">
            <SectionHeader icon="✨" title={t('Lost & Found')} subtitle={t('Lost & Found')} />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Every new post is tokenised against open reports of the opposite type. A match needs two shared keywords
              or one shared keyword plus the same category — then both students get a notification.
            </p>
            {matches.data.length === 0 ? (
              <p className="text-[11px] text-slate-400">No matches recorded yet.</p>
            ) : (
              <div className="space-y-1.5">
                {matches.data.slice(0, 6).map((match) => (
                  <div key={String(match.id)} className="p-2 rounded-xl bg-emerald-500/10 text-[11px] flex items-center justify-between">
                    <span>Possible match (score {match.score})</span>
                    <Badge tone="emerald">Notified</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4 text-xs space-y-1.5">
            <div className="font-bold text-sm">Where to hand items in</div>
            <ul className="list-disc list-inside text-slate-500 dark:text-slate-400 space-y-1">
              <li>Central Library help desk (ID cards & books)</li>
              <li>TSC security desk (gadgets & bags)</li>
              <li>Your hall provost office (keys & wallets)</li>
            </ul>
          </Card>
        </div>
      </div>

      <Modal open={postOpen} onClose={() => setPostOpen(false)} title={t('New listing')} wide>
        <ModuleForm
          moduleKey="lost-found"
          omit={['status']}
          submitLabel="Publish to the board"
          onSubmit={async (values) => {
            const result = await itemMutation.create({ ...values, kind: values.kind || kind });
            if (result.ok) {
              setPostOpen(false);
              items.refresh();
              toast.show('Posted — matching students have been notified.');
              return { ok: true };
            }
            return { ok: false, error: result.error };
          }}
          onCancel={() => setPostOpen(false)}
        />
      </Modal>

      {toast.node}
    </div>
  );
}
