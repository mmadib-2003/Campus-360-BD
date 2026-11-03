// apps/web/app/onboarding/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
  const router = useRouter();
  const [batch, setBatch] = useState('');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [consentCallback, setConsentCallback] = useState(false);

  async function saveOnboarding(e: React.FormEvent) {
    e.preventDefault();
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
    router.push('/');
  }

  return (
    <div className="max-w-xl mx-auto p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
        <div className="bg-emerald-500 h-full w-3/4" />
      </div>
      <h1 className="text-xl font-bold">Complete Campus Onboarding / প্রোফাইল সম্পূর্ণ করুন</h1>
      <form onSubmit={saveOnboarding} className="space-y-4 text-sm">
        <input
          placeholder="Batch / Session (e.g. 51st Batch / 2021-22)"
          value={batch}
          onChange={(e) => setBatch(e.target.value)}
          className="w-full rounded-xl p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
        />
        <textarea
          placeholder="Bio & Academic Interests"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="w-full rounded-xl p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
        />
        <input
          placeholder="Optional Phone (Strictly for Consented Crisis Counseling Callback)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-xl p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
        />
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={consentCallback}
            onChange={(e) => setConsentCallback(e.target.checked)}
          />
          <span>I consent to allow the University Counseling Cell to call this number during an emergency request.</span>
        </label>
        <button type="submit" className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold">
          Finish Onboarding
        </button>
      </form>
    </div>
  );
}
