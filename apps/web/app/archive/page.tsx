// apps/web/app/archive/page.tsx
'use client';

import React, { useEffect, useState } from 'react';

export default function ArchivePage() {
  const [files, setFiles] = useState<Array<Record<string, any>>>([]);
  const [courseCode, setCourseCode] = useState('');

  useEffect(() => {
    fetch(`/api/archive${courseCode ? `?courseCode=${encodeURIComponent(courseCode)}` : ''}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setFiles(res.data || []);
      });
  }, [courseCode]);

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">📚 Academic Archive / একাডেমিক আর্কাইভ</h1>
          <p className="text-xs text-slate-400">
            50 MB max per file • MIME-sniffed • ClamAV virus-scanned • 5-minute signed download URLs.
          </p>
        </div>
        <input
          placeholder="Filter by Course Code (e.g. CSE-301)..."
          value={courseCode}
          onChange={(e) => setCourseCode(e.target.value)}
          className="rounded-xl px-3.5 py-2 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {files.map((file) => (
          <div
            key={file.id}
            className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                {file.course_code}
              </span>
              <span className="text-slate-400">v{file.current_version} • {file.scan_status}</span>
            </div>
            <div className="font-bold text-sm">{file.course_title}</div>
            <div className="text-xs text-slate-400">{file.original_filename}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
