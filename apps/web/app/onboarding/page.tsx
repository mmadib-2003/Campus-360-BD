'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useUi } from '@/lib/i18n-client';
import { useSession } from '@/lib/modules/client';
import { isSupabaseConfigured } from '@/lib/supabase-browser';

export default function OnboardingPage() {
  const router = useRouter();
  const { t } = useUi();
  const session = useSession();
  const [batch, setBatch] = React.useState('');
  const [bio, setBio] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [consentCallback, setConsentCallback] = React.useState(false);

  async function saveOnboarding(event: React.FormEvent) {
    event.preventDefault();
    if (!isSupabaseConfigured() || session.demo) {
      try {
        window.localStorage.setItem(
          'campus360.demo.onboarding',
          JSON.stringify({ batch, bio, crisis_callback_phone: phone, crisis_callback_consent: consentCallback })
        );
      } catch {
        /* ignore */
      }
      router.push('/feed');
      return;
    }
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batch,
        bio,
        crisis_callback_phone: phone || null,
        crisis_callback_consent: consentCallback,
      }),
    });
    router.push('/feed');
  }

  return (
    <div className="max-w-xl mx-auto my-10 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
      <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
        <div className="bg-emerald-500 h-full w-3/4" />
      </div>
      <div>
        <h1 className="text-xl font-bold">{t('Student Dashboard')}</h1>
        <p className="text-xs text-slate-500 mt-1">{t('Your campus at a glance')}</p>
      </div>
      <form onSubmit={saveOnboarding} className="space-y-4 text-sm">
        <input
          placeholder={t('Batch')}
          value={batch}
          onChange={(event) => setBatch(event.target.value)}
          className="w-full rounded-xl p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
        />
        <textarea
          placeholder={t('Description')}
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          className="w-full rounded-xl p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
        />
        <input
          placeholder={t('Contact')}
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className="w-full rounded-xl p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
        />
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={consentCallback} onChange={(event) => setConsentCallback(event.target.checked)} />
          <span>{t('I agree to the Privacy & Data Retention Policy')}</span>
        </label>
        <button type="submit" className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold">
          {t('Continue')}
        </button>
      </form>
    </div>
  );
}
