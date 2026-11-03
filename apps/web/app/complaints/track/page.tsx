// apps/web/app/complaints/track/page.tsx
'use client';

import React, { useState } from 'react';

export default function ComplaintTrackPage() {
  const [trackingCode, setTrackingCode] = useState('');
  const [result, setResult] = useState<any>(null);

  async function handleTrack(e: React.FormEvent) {
    e.preventDefault();
    const code = trackingCode.trim().toUpperCase();
    const savedSecret =
      typeof window !== 'undefined' ? localStorage.getItem(`campus360_secret_${code}`) : null;
    const res = await fetch('/api/complaints/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackingCode: code, trackingSecret: savedSecret }),
    });
    const payload = await res.json();
    if (payload.success) setResult(payload.data);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <h1 className="text-xl font-bold">🔎 Track Grievance by Code / অভিযোগের সর্বশেষ অবস্থা জানুন</h1>
        <form onSubmit={handleTrack} className="mt-4 flex gap-2">
          <input
            required
            placeholder="JU-CASE-2026-123456"
            value={trackingCode}
            onChange={(e) => setTrackingCode(e.target.value)}
            className="flex-1 rounded-xl p-2.5 text-sm font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
          />
          <button type="submit" className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold">
            Track
          </button>
        </form>

        {result?.complaint && (
          <div className="mt-6 p-4 rounded-xl bg-slate-800/60 space-y-2 text-xs">
            <div className="flex justify-between font-bold text-sm">
              <span>{result.complaint.tracking_code}</span>
              <span className="text-emerald-400">{result.complaint.status}</span>
            </div>
            <div>Title: {result.complaint.title}</div>
            <div>SLA Due: {new Date(result.complaint.sla_due_at).toLocaleString()}</div>
          </div>
        )}
      </div>
    </div>
  );
}
