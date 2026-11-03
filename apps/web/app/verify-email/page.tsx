// apps/web/app/verify-email/page.tsx
'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// ১. মূল ফর্মের লজিক একটি আলাদা কম্পোনেন্টে রাখা হলো
function VerifyEmailForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState(sp.get('email') || '');
  const [otp, setOtp] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    });
    const payload = await res.json();
    setLoading(false);

    if (!payload.success) {
      setErrorMsg(`${payload.error?.message_en} / ${payload.error?.message_bn}`);
      return;
    }

    router.push(payload.data.nextStep || '/onboarding');
  }

  return (
    <div className="max-w-md mx-auto my-16 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <h1 className="text-xl font-bold">Verify 6-Digit OTP / ওটিপি যাচাইকরণ</h1>
      <p className="text-xs text-slate-500 mt-1">
        Sent to <strong>{email}</strong> (10-minute TTL, max 5 attempts).
      </p>

      <form onSubmit={handleVerify} className="mt-5 space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl p-2.5 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
        />
        <input
          required
          maxLength={6}
          pattern="\d{6}"
          placeholder="6-digit OTP (e.g. 482910)"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          className="w-full rounded-xl p-3 text-center text-2xl tracking-[0.5em] font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
        />
        {errorMsg && <p className="text-xs text-rose-400">{errorMsg}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm"
        >
          {loading ? 'Verifying...' : 'Verify & Continue / যাচাই করুন'}
        </button>
      </form>
    </div>
  );
}

// ২. মূল পেজ কম্পোনেন্টটি এখন Suspense-এর সাহায্যে ফর্মটিকে রেন্ডার করবে
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="text-center mt-20">Loading...</div>}>
      <VerifyEmailForm />
    </Suspense>
  );
}