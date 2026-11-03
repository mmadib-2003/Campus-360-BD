// apps/web/app/signin/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleOtpSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/auth/request-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const payload = await res.json();
    if (!payload.success) {
      setError(`${payload.error?.message_en} / ${payload.error?.message_bn}`);
      return;
    }
    router.push(`/verify-email?email=${encodeURIComponent(email)}`);
  }

  return (
    <div className="max-w-md mx-auto my-12 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <h1 className="text-xl font-bold">Sign In with University Email OTP / লগইন</h1>
      <form onSubmit={handleOtpSignIn} className="mt-4 space-y-4 text-sm">
        <input
          required
          type="email"
          placeholder="student@juniv.edu or student@du.ac.bd"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
        />
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <button type="submit" className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-semibold">
          Send 6-Digit Login OTP / ওটিপি পাঠান
        </button>
      </form>
    </div>
  );
}
