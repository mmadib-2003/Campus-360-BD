'use client';

import React from 'react';
import Link from 'next/link';
import { useUi } from '@/lib/i18n-client';
import { useSession } from '@/lib/modules/client';
import { demoInsert, getActiveDemoUniversity, getDemoProfile } from '@/lib/modules/demo-data';
import { isSupabaseConfigured } from '@/lib/supabase-browser';

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

const CATEGORY_LABELS: Record<string, string> = {
  ACADEMIC: 'Academic',
  HALL_RESIDENCE: 'Hall / Residence',
  HARASSMENT: 'Harassment',
  RAGGING_BULLYING: 'Ragging / Bullying',
  SEXUAL_HARASSMENT: 'Sexual harassment',
  FINANCIAL: 'Financial',
  INFRASTRUCTURE: 'Infrastructure',
  TRANSPORT: 'Transport',
  HEALTH: 'Health',
  DISCRIMINATION: 'Discrimination',
  OTHER: 'Other',
};

export default function ComplaintsPage() {
  const { t } = useUi();
  const categoryLabel = (value: string) => t(CATEGORY_LABELS[value] ?? value);
  const severityLabel = (value: string) => t(value.charAt(0) + value.slice(1).toLowerCase());
  const session = useSession();
  const [title, setTitle] = React.useState('');
  const [category, setCategory] = React.useState<string>('HARASSMENT');
  const [severity, setSeverity] = React.useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');
  const [description, setDescription] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [isAnonymous, setIsAnonymous] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [createdCase, setCreatedCase] = React.useState<{
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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (!isSupabaseConfigured() || session.demo) {
        const university = getActiveDemoUniversity();
        const profile = getDemoProfile();
        const trackingCode = `${university.code}-CASE-2026-${Math.floor(100000 + Math.random() * 899999)}`;
        const trackingSecret = `C360-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
        const slaHours = severity === 'CRITICAL' || severity === 'HIGH' ? 24 : 72;
        const createdAt = new Date().toISOString();
        demoInsert('complaints_public', {
          tracking_code: trackingCode,
          title,
          category,
          severity,
          description: `${description}${location ? `\n\nLocation: ${location}` : ''}`,
          status: 'SUBMITTED',
          upvotes_count: 0,
          is_public_issue: false,
          is_anonymous: isAnonymous,
          tracking_secret: trackingSecret,
          student_id: profile.id,
          location_hint: location,
          evidence_urls: [],
          sla_hours: slaHours,
          sla_due_at: new Date(Date.now() + slaHours * 3600_000).toISOString(),
          sla_breached: false,
          created_at: createdAt,
          last_activity_at: createdAt,
          resolved_at: null,
          resolution_summary: null,
          history: [
            {
              status: 'SUBMITTED',
              at: createdAt,
              note: 'Grievance filed confidentially through the campus portal.',
              by: 'Student',
            },
          ],
        });
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(`campus360_secret_${trackingCode}`, trackingSecret);
        }
        setCreatedCase({
          trackingCode,
          trackingSecret,
          slaDueAt: new Date(Date.now() + slaHours * 3600_000).toISOString(),
        });
        return;
      }

      const response = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, category, severity, description, isAnonymous, location_hint: location }),
      });
      const payload = await response.json();
      if (!payload.success) {
        setError(payload?.error?.message_en ?? t('Verification failed'));
        return;
      }
      if (payload.data?.trackingSecret && typeof window !== 'undefined') {
        window.localStorage.setItem(`campus360_secret_${payload.data.trackingCode}`, payload.data.trackingSecret);
      }
      setCreatedCase(payload.data);
    } catch {
      setError(t('Verification failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <h1 className="text-xl font-bold">🛡️ {t('Grievance & Complaint Resolution System')}</h1>
        <p className="text-xs text-slate-500 mt-1">{t('End-to-end SLA-tracked grievance routing to Proctor, Anti-Harassment Cell, Dean of Students, or Registrar.')}</p>

        {severity === 'CRITICAL' && (
          <div role="alert" className="mt-4 p-4 rounded-2xl bg-rose-950/80 border-2 border-rose-500 text-rose-100 space-y-2">
            <div className="font-bold text-sm">🚨 {t('Critical')} — {t('Immediate Crisis or Life Safety Emergency?')}</div>
            <p className="text-xs">
              {t('If you or someone on campus is in immediate physical danger, call 999 (National Emergency Service) or your Campus 24/7 Proctor Control Room immediately.')}
            </p>
            <div className="flex flex-wrap gap-2 text-xs pt-1">
              <a href="tel:999" className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold">
                📞 999
              </a>
              <a href="tel:+88027791045" className="px-3 py-1.5 rounded-xl bg-slate-800 text-white">
                📞 {t('Contact')}
              </a>
            </div>
          </div>
        )}

        {createdCase ? (
          <div className="mt-6 p-5 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 space-y-2 text-sm">
            <div className="font-bold text-emerald-300">✓ {t('Case Filed Successfully')} — {t('Tracking Code')}: {createdCase.trackingCode}</div>
            {createdCase.trackingSecret && (
              <p className="text-xs text-amber-300 font-mono break-all">
                {t('Anonymous Device Secret')}: {createdCase.trackingSecret}
              </p>
            )}
            <p className="text-xs text-slate-300">{t('SLA Resolution Target')}: {new Date(createdCase.slaDueAt).toLocaleString()}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                href={`/track/${encodeURIComponent(createdCase.trackingCode)}`}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
              >
                {t('Track a case')} →
              </Link>
              <button
                type="button"
                onClick={() => {
                  setCreatedCase(null);
                  setTitle('');
                  setDescription('');
                  setLocation('');
                }}
                className="px-4 py-2 rounded-xl border border-emerald-500/40 text-emerald-300 text-xs font-semibold"
              >
                {t('Continue')}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium mb-1">{t('Category')}</label>
                <select
                  value={category}
                  onChange={(event) => handleCategoryChange(event.target.value)}
                  className="w-full rounded-xl p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                >
                  {CATEGORIES.map((value) => (
                    <option key={value} value={value}>
                      {categoryLabel(value)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium mb-1">{t('Severity')}</label>
                <select
                  value={severity}
                  onChange={(event) => setSeverity(event.target.value as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')}
                  className="w-full rounded-xl p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                >
                  <option value="LOW">{severityLabel('LOW')}</option>
                  <option value="MEDIUM">{severityLabel('MEDIUM')}</option>
                  <option value="HIGH">{severityLabel('HIGH')}</option>
                  <option value="CRITICAL">{severityLabel('CRITICAL')}</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-medium mb-1">{t('Title')}</label>
              <input
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-xl p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
              />
            </div>

            <div>
              <label className="block font-medium mb-1">{t('Detailed Description')}</label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="w-full rounded-xl p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
              />
            </div>

            <div>
              <label className="block font-medium mb-1">{t('Location on campus')}</label>
              <input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder={t('Location on campus')}
                className="w-full rounded-xl p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
              />
            </div>

            <label className="flex items-center gap-2 text-xs font-medium text-emerald-400">
              <input type="checkbox" checked={isAnonymous} onChange={(event) => setIsAnonymous(event.target.checked)} />
              <span>{t('Submit Anonymously')}</span>
            </label>

            {error && <p className="text-xs text-rose-500">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold disabled:opacity-60"
            >
              {submitting ? t('Loading…') : t('Submit Tracked Grievance')}
            </button>
          </form>
        )}
      </div>

      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 space-y-1">
        <p className="font-semibold text-slate-700 dark:text-slate-200">{t('Your data stays inside your university tenant.')}</p>
        <p>{t('Email OTP is required for every account.')}</p>
        <Link href="/track/JU-CASE-2026-482913" className="inline-block text-emerald-600 dark:text-emerald-400 hover:underline">
          {t('Track a case')}: JU-CASE-2026-482913
        </Link>
      </div>
    </div>
  );
}
