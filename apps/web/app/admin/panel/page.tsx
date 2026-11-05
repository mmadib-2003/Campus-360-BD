'use client';

// apps/web/app/admin/panel/page.tsx
// Platform Admin panel (success criterion 4) — full CRUD over every managed
// model: users, universities, halls, marketplace listings, civic tickets,
// events, blood requests, lost items, housing listings, career posts,
// cafeteria menus and disputes. Custom DataTable + Modal/drawer forms built on
// the existing components/modules/ui.tsx primitives. Platform-admin only:
// non-admin sessions get a sign-in prompt instead of data.

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
import { ADMIN_SECTIONS, getAdminSection, type AdminField, type AdminSection } from '@/lib/admin/models';
import {
  demoDelete,
  demoInsert,
  demoTable,
  demoUpdate,
  subscribeDemoRealtime,
  type DemoRealtimeEvent,
} from '@/lib/modules/demo-data';

type Row = Record<string, any>;

function fieldLabel(column: string): string {
  return column
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function AdminPanelPage() {
  const session = useSession();
  const { t } = useUi();
  const toast = useToast();
  const [sectionKey, setSectionKey] = React.useState(ADMIN_SECTIONS[0].key);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [editor, setEditor] = React.useState<{ mode: 'create' | 'edit'; row?: Row } | null>(null);
  const [form, setForm] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<Row | null>(null);

  const section = getAdminSection(sectionKey) as AdminSection;
  const isAdmin =
    session.roles.some((role) => ['ADMIN', 'SUPER_ADMIN', 'UNIVERSITY_ADMIN'].includes(role)) ||
    (session.demo && session.isAdmin);

  const load = React.useCallback(async () => {
    if (!section) return;
    setLoading(true);
    try {
      if (session.demo || !session.authenticated) {
        setRows(demoTable(section.demoTable));
      } else {
        const response = await fetch(`/api/admin/models/${section.key}`, { cache: 'no-store' });
        const payload = await response.json();
        setRows(payload?.success && Array.isArray(payload.data) ? payload.data : []);
      }
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [section, session.demo, session.authenticated]);

  React.useEffect(() => {
    if (!isAdmin) return;
    void load();
  }, [isAdmin, load]);

  React.useEffect(() => {
    if (!isAdmin) return;
    return subscribeDemoRealtime((_event: DemoRealtimeEvent) => {
      void load();
    });
  }, [isAdmin, load]);

  if (session.loading) {
    return <div className="my-12"><SkeletonList rows={4} /></div>;
  }

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto my-12 space-y-4">
        <ModuleHeader icon="🏛️" title="Platform Admin Panel" blurb="Platform operators only." demo={session.demo} />
        <Card className="p-6 text-center space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">{t('Sign in with a platform admin account to manage the registry.')}</p>
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

  const filtered = rows.filter((row) => {
    if (!search.trim()) return true;
    const needle = search.trim().toLowerCase();
    return section.columns.some((column) => String(row[column] ?? '').toLowerCase().includes(needle));
  });

  function openCreate() {
    const initial: Record<string, string> = {};
    for (const field of section.fields) initial[field.column] = '';
    setForm(initial);
    setEditor({ mode: 'create' });
  }

  function openEdit(row: Row) {
    const initial: Record<string, string> = {};
    for (const field of section.fields) {
      const value = row[field.column];
      initial[field.column] = value === null || value === undefined ? '' : String(value);
    }
    setForm(initial);
    setEditor({ mode: 'edit', row });
  }

  async function submitEditor() {
    if (!editor) return;
    setPending(true);
    try {
      for (const field of section.fields) {
        if (field.required && !String(form[field.column] ?? '').trim()) {
          toast.show(`${t('Required')}: ${t(fieldLabel(field.column))}`, 'rose');
          setPending(false);
          return;
        }
      }
      const values: Record<string, unknown> = {};
      for (const field of section.fields) {
        const raw = form[field.column] ?? '';
        if (field.type === 'number') values[field.column] = raw === '' ? null : Number(raw);
        else if (field.type === 'bool') values[field.column] = raw === 'true';
        else if (raw !== '' || field.required) values[field.column] = raw;
      }

      if (session.demo) {
        if (editor.mode === 'create') demoInsert(section.demoTable, values);
        else demoUpdate(section.demoTable, String(editor.row?.id), values);
        setRows(demoTable(section.demoTable));
      } else {
        const response =
          editor.mode === 'create'
            ? await fetch(`/api/admin/models/${section.key}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
              })
            : await fetch(`/api/admin/models/${section.key}/${editor.row?.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
              });
        const payload = await response.json();
        if (!payload?.success) {
          toast.show(payload?.error?.message_en ?? t('Verification failed'), 'rose');
          setPending(false);
          return;
        }
        await load();
      }
      toast.show(editor.mode === 'create' ? t('Created') : t('Updated'));
      setEditor(null);
    } catch {
      toast.show(t('Verification failed'), 'rose');
    } finally {
      setPending(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setPending(true);
    try {
      if (session.demo) {
        demoDelete(section.demoTable, String(toDelete.id));
        setRows(demoTable(section.demoTable));
      } else {
        await fetch(`/api/admin/models/${section.key}/${toDelete.id}`, { method: 'DELETE' });
        await load();
      }
      toast.show(t('Deleted'));
      setToDelete(null);
    } catch {
      toast.show(t('Verification failed'), 'rose');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon="🏛️"
        title="Platform Admin Panel"
        titleBn="প্ল্যাটফর্ম অ্যাডমিন প্যানেল"
        blurb="Full create, edit and delete control over every registry model — users, universities, halls, marketplace, civic tickets, events, blood requests, lost items, housing, careers, cafeteria menus and disputes."
        demo={session.demo}
      >
        <Link href="/admin/console" className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 text-white border border-white/20">
          {t('Administration Console')}
        </Link>
      </ModuleHeader>

      <Card className="p-3">
        {/* Section tabs swipe horizontally on touch, wrap from sm upward. */}
        <div className="flex overflow-x-auto no-scrollbar gap-2 pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap">
          {ADMIN_SECTIONS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setSectionKey(item.key);
                setSearch('');
              }}
              className={`shrink-0 whitespace-nowrap min-h-[44px] sm:min-h-0 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition ${
                item.key === sectionKey
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/40'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {t(item.label)}
            </button>
          ))}
        </div>
      </Card>

      <SectionHeader
        icon="🗄️"
        title={t(section.label)}
        subtitle={t('Create, edit and delete rows. Changes propagate live over Supabase Realtime.')}
        actions={
          <>
            <Input
              aria-label={t('Search')}
              placeholder={t('Search')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full sm:!w-56"
            />
            <Button onClick={openCreate}>＋ {t('Create')}</Button>
          </>
        }
      />

      {loading ? (
        <SkeletonList rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🗄️"
          title={t('Nothing here yet')}
          description={t('Create the first row for this section.')}
          action={<Button onClick={openCreate}>＋ {t('Create')}</Button>}
        />
      ) : (
        <Card>
          {/* Wide moderation queues scroll inside their own container so the
              mobile page itself never scrolls horizontally. */}
          <div className="w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[640px] text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-300 text-left">
                {section.columns.map((column) => (
                  <th key={column} className="px-4 py-2.5 font-semibold">
                    {t(fieldLabel(column))}
                  </th>
                ))}
                <th className="px-4 py-2.5 font-semibold text-right">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={String(row.id)} className="border-t border-slate-100 dark:border-slate-800">
                  {section.columns.map((column, index) => (
                    <td key={column} className={`px-4 py-2.5 ${index === 0 ? 'font-semibold' : ''}`}>
                      {column === 'status' || column === 'trust_level' || column === 'type' ? (
                        <Badge tone={String(row[column]).toUpperCase().includes('REJECT') || String(row[column]) === 'CLOSED' ? 'rose' : 'emerald'}>
                          {String(row[column] ?? '—').replace(/_/g, ' ')}
                        </Badge>
                      ) : (
                        <span className="line-clamp-2">{String(row[column] ?? '—')}</span>
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                      {t('Edit')}
                    </Button>{' '}
                    <Button size="sm" variant="danger" onClick={() => setToDelete(row)}>
                      {t('Delete')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
      )}

      {/* Create / edit drawer */}
      <Modal
        open={Boolean(editor)}
        onClose={() => setEditor(null)}
        title={editor?.mode === 'create' ? `${t('Create')} — ${t(section.label)}` : `${t('Edit')} — ${t(section.label)}`}
        wide
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditor(null)}>
              {t('Cancel')}
            </Button>
            <Button loading={pending} onClick={() => void submitEditor()}>
              {editor?.mode === 'create' ? t('Create') : t('Save changes')}
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {section.fields.map((field) => (
            <Field
              key={field.column}
              label={`${t(fieldLabel(field.column))}${field.required ? ' *' : ''}`}
              className={field.type === 'longtext' ? 'md:col-span-2' : undefined}
            >
              {field.type === 'longtext' ? (
                <Textarea
                  value={form[field.column] ?? ''}
                  onChange={(event) => setForm((prev) => ({ ...prev, [field.column]: event.target.value }))}
                />
              ) : field.type === 'enum' ? (
                <Select
                  options={(field.values ?? []).map((value) => ({ value, label: value.replace(/_/g, ' ') }))}
                  placeholder={t('Select')}
                  value={form[field.column] ?? ''}
                  onChange={(event) => setForm((prev) => ({ ...prev, [field.column]: event.target.value }))}
                />
              ) : field.type === 'bool' ? (
                <Select
                  options={[
                    { value: 'true', label: t('Yes') },
                    { value: 'false', label: t('No') },
                  ]}
                  value={form[field.column] ?? ''}
                  onChange={(event) => setForm((prev) => ({ ...prev, [field.column]: event.target.value }))}
                />
              ) : (
                <Input
                  type={field.type === 'number' ? 'number' : 'text'}
                  value={form[field.column] ?? ''}
                  onChange={(event) => setForm((prev) => ({ ...prev, [field.column]: event.target.value }))}
                />
              )}
            </Field>
          ))}
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title={t('Delete this row?')}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setToDelete(null)}>
              {t('Cancel')}
            </Button>
            <Button variant="danger" loading={pending} onClick={() => void confirmDelete()}>
              {t('Delete')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {t('This permanently removes the row. This action cannot be undone.')}
        </p>
        <p className="mt-2 text-xs font-mono text-slate-400">
          {section.columns.map((column) => String(toDelete?.[column] ?? '')).filter(Boolean).join(' · ')}
        </p>
      </Modal>
    </div>
  );
}
