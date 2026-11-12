// apps/web/app/archive/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  SectionHeader,
  Select,
  SkeletonList,
  Stat,
  statusTone,
  useToast,
} from '@/components/modules/ui';
import { useSession } from '@/lib/modules/client';
import { useUi } from '@/lib/i18n-client';
import { CampusBadge } from '@/components/CampusBadge';
import { useCampusScope } from '@/lib/use-campus-scope';
import { isSupabaseConfigured, trySupabaseBrowser } from '@/lib/supabase-browser';

const CATEGORIES = [
  'LECTURE_NOTES',
  'PAST_EXAMS',
  'QUESTION_BANKS',
  'ASSIGNMENTS',
  'LAB_MANUALS',
  'SYLLABUS',
  'REFERENCE_BOOKS',
  'THESIS_PROJECT_REPORTS',
  'COURSE_OUTLINES',
];

export default function ArchivePage() {
  const session = useSession();
  const { scope } = useCampusScope();
  const { t } = useUi();
  const [files, setFiles] = useState<Array<Record<string, any>>>([]);
  const [courseCode, setCourseCode] = useState('');
  const [category, setCategory] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isSupabaseConfigured()) {
        if (!cancelled) {
          setFiles([]);
          setError(null);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ scope: scope === 'all' ? 'all_campuses' : 'my_campus' });
        if (courseCode) params.set('courseCode', courseCode);
        if (category !== 'ALL') params.set('category', category);
        const res = await fetch(`/api/archive?${params.toString()}`, { cache: 'no-store' });
        const payload = await res.json();
        if (cancelled) return;
        if (payload.success) {
          setFiles(payload.data || []);
        } else {
          setError(payload?.error?.message_en ?? 'Could not load archive.');
          setFiles([]);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Network error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [courseCode, category, session.loading, session.userId, scope]);

  async function download(file: Record<string, any>) {
    setDownloading(String(file.id));
    try {
      if (!isSupabaseConfigured()) {
        toast.show('Downloads need a connected Supabase project.', 'amber');
        return;
      }
      const res = await fetch(`/api/archive/${file.id}/download-url`, { method: 'POST' });
      const payload = await res.json();
      if (!payload.success) {
        toast.show(payload?.error?.message_en ?? 'Could not create download link.', 'rose');
        return;
      }
      window.open(payload.data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Network error', 'rose');
    } finally {
      setDownloading(null);
    }
  }

  const stats = useMemo(() => {
    const quarantined = files.filter((file) => file.scan_status === 'QUARANTINED').length;
    const downloads = files.reduce((sum, file) => sum + Number(file.downloads_count ?? 0), 0);
    return { total: files.length, quarantined, downloads };
  }, [files]);

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">📚 {t('Academic Archive')}</h1>
          <p className="text-xs text-slate-400">
            50 MB max per file • MIME-sniffed • ClamAV virus-scanned • 5-minute signed download URLs.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            placeholder="Filter by Course Code (e.g. CSE-301)..."
            value={courseCode}
            onChange={(e) => setCourseCode(e.target.value)}
            aria-label="Filter by course code"
            className="rounded-xl px-3.5 py-2 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
          />
          <Select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="Filter by category"
            placeholder="All categories"
            options={CATEGORIES.map((value) => ({ value, label: value.replace(/_/g, ' ') }))}
            className="sm:max-w-[190px]"
          />
          <Button onClick={() => setUploadOpen(true)}>+ Upload</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Files indexed" value={stats.total} />
        <Stat label="Total downloads" value={stats.downloads} />
        <Stat label="Quarantined" value={stats.quarantined} tone="rose" hint="Awaiting review" />
        <Stat
          label="My uploads"
          value={files.filter((file) => String(file.uploader_id) === String(session.userId)).length}
        />
      </div>

      {loading ? (
        <SkeletonList rows={3} />
      ) : error ? (
        <EmptyState icon="⚠️" title="Archive unavailable" description={error} />
      ) : files.length === 0 ? (
        <EmptyState
          icon="📚"
          title="No archive files yet"
          description="Upload lecture sheets, hand notes or past exam questions to help your juniors."
          action={<Button onClick={() => setUploadOpen(true)}>Upload the first file</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {files.map((file) => (
            <Card key={String(file.id)} className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 font-mono">
                  {file.course_code}
                </span>
                <div className="flex items-center gap-1.5">
                  <Badge tone={statusTone(file.scan_status)}>{String(file.scan_status ?? 'PENDING')}</Badge>
                  <CampusBadge universityId={file.university_id} />
                  <span className="text-slate-400">v{file.current_version ?? 1}</span>
                </div>
              </div>
              <div className="font-bold text-sm">{file.course_title}</div>
              <div className="text-xs text-slate-400 truncate">{file.original_filename}</div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                <span>{String(file.category ?? '').replace(/_/g, ' ')}</span>
                {file.academic_year && <span>• {file.academic_year}</span>}
                <span>• ⬇ {Number(file.downloads_count ?? 0)}</span>
                <span>• 👁 {Number(file.views_count ?? 0)}</span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  loading={downloading === String(file.id)}
                  disabled={file.scan_status === 'QUARANTINED' || file.dmca_quarantined}
                  onClick={() => download(file)}
                >
                  {file.scan_status === 'QUARANTINED' ? 'Quarantined' : 'Download'}
                </Button>
                <a
                  href={`/reviews?targetType=ARCHIVE_FILE&targetId=${file.id}`}
                  className="text-[11px] text-emerald-500 font-semibold"
                >
                  Review this file →
                </a>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload to the academic archive" wide>
        <UploadForm
          onDone={() => {
            setUploadOpen(false);
            setCourseCode((prev) => prev);
            window.location.reload();
          }}
          onCancel={() => setUploadOpen(false)}
        />
      </Modal>

      {toast.node}
    </div>
  );
}

function UploadForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [values, setValues] = useState({
    courseCode: '',
    courseTitle: '',
    semester: 'Spring',
    academicYear: String(new Date().getFullYear()),
    category: 'LECTURE_NOTES',
    visibility: 'PRIVATE_TO_UNIVERSITY',
    tags: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function set(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!file) {
      setError('Choose a file to upload.');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('Maximum file size is 50 MB.');
      return;
    }
    if (!isSupabaseConfigured()) {
      setError('Archive uploads require a connected Supabase project.');
      return;
    }

    setPending(true);
    try {
      setProgress('Requesting a signed upload URL…');
      const presign = await fetch('/api/archive/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mimeType: file.type || 'application/pdf',
          fileSizeBytes: file.size,
          courseCode: values.courseCode,
          filename: file.name,
          departmentId: '00000000-0000-0000-0000-000000000000',
        }),
      });
      const presignData = await presign.json();
      if (!presignData.success) {
        setError(presignData?.error?.message_en ?? 'Could not start upload.');
        return;
      }

      setProgress('Uploading your file to private storage…');
      const supabase = trySupabaseBrowser();
      if (!supabase) {
        setError('Supabase client is not configured.');
        return;
      }
      const { error: uploadError } = await supabase.storage
        .from('academic-archive')
        .uploadToSignedUrl(presignData.data.storagePath, presignData.data.token, file);
      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      setProgress('Registering file metadata & checksum…');
      const checksum = await crypto.subtle
        .digest('SHA-256', await file.arrayBuffer())
        .then((buffer) =>
          Array.from(new Uint8Array(buffer))
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('')
        )
        .catch(() => 'unavailable');

      const res = await fetch('/api/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseCode: values.courseCode,
          courseTitle: values.courseTitle,
          semester: values.semester,
          academicYear: values.academicYear,
          category: values.category,
          visibility: values.visibility,
          tags: values.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
          storagePath: presignData.data.storagePath,
          originalFilename: file.name,
          mimeType: file.type || 'application/pdf',
          fileSizeBytes: file.size,
          checksumSha256: checksum,
          departmentId: '00000000-0000-0000-0000-000000000000',
        }),
      });
      const payload = await res.json();
      if (!payload.success) {
        setError(payload?.error?.message_en ?? 'Metadata registration failed.');
        return;
      }
      setProgress('Uploaded — the file is queued for virus scanning.');
      setTimeout(onDone, 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Course code">
          <Input required value={values.courseCode} onChange={(event) => set('courseCode', event.target.value)} placeholder="CSE-301" />
        </Field>
        <Field label="Course title">
          <Input required value={values.courseTitle} onChange={(event) => set('courseTitle', event.target.value)} placeholder="Data Structures" />
        </Field>
        <Field label="Semester">
          <Select
            value={values.semester}
            onChange={(event) => set('semester', event.target.value)}
            options={['Spring', 'Summer', 'Fall', 'Winter'].map((value) => ({ value, label: value }))}
          />
        </Field>
        <Field label="Academic year">
          <Input type="number" min={1970} max={2100} value={values.academicYear} onChange={(event) => set('academicYear', event.target.value)} />
        </Field>
        <Field label="Category">
          <Select
            value={values.category}
            onChange={(event) => set('category', event.target.value)}
            options={CATEGORIES.map((value) => ({ value, label: value.replace(/_/g, ' ') }))}
          />
        </Field>
        <Field label="Visibility">
          <Select
            value={values.visibility}
            onChange={(event) => set('visibility', event.target.value)}
            options={[
              { value: 'PRIVATE_TO_UNIVERSITY', label: 'My university only' },
              { value: 'PUBLIC', label: 'Public metadata' },
            ]}
          />
        </Field>
      </div>
      <Field label="Tags" hint="Comma separated">
        <Input value={values.tags} onChange={(event) => set('tags', event.target.value)} placeholder="midterm, solution, handwritten" />
      </Field>
      <Field label="File" hint="PDF, DOCX, PPTX, XLSX, TXT, ZIP or images up to 50 MB">
        <input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="text-xs" />
      </Field>
      {progress && <p className="text-[11px] text-emerald-500">{progress}</p>}
      {error && <p className="text-xs text-rose-500">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          Upload file
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
