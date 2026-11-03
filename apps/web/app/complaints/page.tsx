// apps/web/app/complaints/page.tsx
'use client';

import React, { useState } from 'react';

const CATEGORIES = [
  'ACADEMIC',
  'HALL_RESIDENCE',
  'HARASSMENT',
  'RAGGING_BULLYING',
  'SEXUAL_HARASSMENT',
  'FINANCIAL',
  'INFRASTRUCTURE',
  'TRANSPORT',
  'HEALTH',
  'DISCRIMINATION',
  'OTHER',
] as const;

export default function ComplaintsPage() {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('HARASSMENT');
  const [severity, setSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [createdCase, setCreatedCase] = useState<{
    trackingCode: string;
    trackingSecret: string | null;
    slaDueAt: string;
  } | null>(null);

  function handleCategoryChange(nextCat: string) {
    setCategory(nextCat);
    if (['HARASSMENT', 'RAGGING_BULLYING', 'SEXUAL_HARASSMENT'].includes(nextCat)) {
      setIsAnonymous(true);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/complaints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        category,
        severity,
        description,
        isAnonymous,
      }),
    });
    const payload = await res.json();
    if (payload.success) {
      if (payload.data.trackingSecret && typeof window !== 'undefined') {
        localStorage.setItem(
          `campus360_secret_${payload.data.trackingCode}`,
          payload.data.trackingSecret
        );
      }
      setCreatedCase(payload.data);
    }
  }

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <h1 className="text-xl font-bold">
          🛡️ Grievance & Complaint Resolution System / অভিযোগ ও প্রতিকার ব্যবস্থাপনা
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          End-to-end SLA-tracked grievance routing to Proctor, Anti-Harassment Cell, Dean of Students, or Registrar.
        </p>

        {/* CRITICAL Emergency Guardrail Interstitial */}
        {severity === 'CRITICAL' && (
          <div
            role="alert"
            className="mt-4 p-4 rounded-2xl bg-rose-950/80 border-2 border-rose-500 text-rose-100 space-y-2"
          >
            <div className="font-bold text-sm">
              🚨 CRITICAL SEVERITY — IMMEDIATE SAFETY & COUNSELING INTERSTITIAL
            </div>
            <p className="text-xs">
              If you or someone on campus is in immediate physical danger, call <strong>999</strong> (National Emergency Service) or your Campus 24/7 Proctor Control Room immediately.
            </p>
            <div className="flex flex-wrap gap-2 text-xs pt-1">
              <a href="tel:999" className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold">
                📞 Call 999 Now
              </a>
              <a href="tel:+88027791045" className="px-3 py-1.5 rounded-xl bg-slate-800 text-white">
                📞 Proctor Duty Officer
              </a>
            </div>
          </div>
        )}

        {createdCase ? (
          <div className="mt-6 p-5 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 space-y-2 text-sm">
            <div className="font-bold text-emerald-300">
              ✓ Case Filed Successfully — Tracking Code: {createdCase.trackingCode}
            </div>
            {createdCase.trackingSecret && (
              <p className="text-xs text-amber-300 font-mono break-all">
                Anonymous Device Secret (saved locally; keep backup): {createdCase.trackingSecret}
              </p>
            )}
            <p className="text-xs text-slate-300">
              SLA Resolution Target: {new Date(createdCase.slaDueAt).toLocaleString()}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium mb-1">Category / ধরন</label>
                <select
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full rounded-xl p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium mb-1">Severity / মাত্রা</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')}
                  className="w-full rounded-xl p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL (Emergency Guardrail)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-medium mb-1">Title / শিরোনাম</label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
              />
            </div>

            <div>
              <label className="block font-medium mb-1">Detailed Description / বিস্তারিত বিবরণ</label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
              />
            </div>

            <label className="flex items-center gap-2 text-xs font-medium text-emerald-400">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
              />
              <span>
                Submit Anonymously (No PII stored on case; cryptographic tracking code + device secret issued)
              </span>
            </label>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold"
            >
              Submit Tracked Grievance / অভিযোগ জমা দিন
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
