// apps/web/app/signup/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface UniversityOption {
  id: string;
  code: string;
  name_en: string;
  name_bn: string;
  category: string;
  university_email_domains: { domain: string; is_primary: boolean }[];
}

export default function SignUpPage() {
  const router = useRouter();
  const [universities, setUniversities] = useState<UniversityOption[]>([]);
  const [universityId, setUniversityId] = useState('');
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState('');
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [consentGuidelines, setConsentGuidelines] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/universities')
      .then((r) => r.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setUniversities(res.data);
          if (res.data[0]) setUniversityId(res.data[0].id);
        }
      });
  }, []);

  const selectedUniv = universities.find((u) => u.id === universityId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!consentTerms || !consentPrivacy || !consentGuidelines) {
      setErrorMsg('Please accept Terms, Privacy Policy, and Community Guidelines. / সকল শর্তাবলীতে সম্মতি দিন।');
      return;
    }

    setSubmitting(true);
    const res = await fetch('/api/auth/request-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        universityId,
        signupPayload: { fullName, studentId },
      }),
    });
    const payload = await res.json();
    setSubmitting(false);

    if (!payload.success) {
      setErrorMsg(`${payload.error?.message_en} / ${payload.error?.message_bn}`);
      return;
    }

    router.push(`/verify-email?email=${encodeURIComponent(email)}`);
  }

  return (
    <div className="max-w-xl mx-auto my-10 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg">
      <h1 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
        Join Your Campus / আপনার ক্যাম্পাসে যুক্ত হোন
      </h1>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
        Strict institutional email verification across all Bangladesh public universities.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-sm">
        <div>
          <label className="block font-medium mb-1">Public University / পাবলিক বিশ্ববিদ্যালয়</label>
          <select
            value={universityId}
            onChange={(e) => setUniversityId(e.target.value)}
            className="w-full rounded-xl p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
          >
            {universities.map((u) => (
              <option key={u.id} value={u.id}>
                [{u.code}] {u.name_en} — {u.name_bn}
              </option>
            ))}
          </select>
          {selectedUniv && (
            <p className="text-xs text-emerald-500 mt-1">
              Approved domains:{' '}
              {selectedUniv.university_email_domains.map((d) => `@${d.domain}`).join(', ')}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium mb-1">Full Name / পূর্ণ নাম</label>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Student ID / স্টুডেন্ট আইডি</label>
            <input
              required
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full rounded-xl p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
            />
          </div>
        </div>

        <div>
          <label className="block font-medium mb-1">University Email / প্রাতিষ্ঠানিক ইমেইল</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@student.juniv.edu or name@du.ac.bd"
            className="w-full rounded-xl p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
          />
        </div>

        <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={consentTerms} onChange={(e) => setConsentTerms(e.target.checked)} />
            <span>I agree to the Campus360 BD Terms of Service / আমি ব্যবহারের শর্তাবলীতে সম্মত</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={consentPrivacy} onChange={(e) => setConsentPrivacy(e.target.checked)} />
            <span>I agree to the Privacy & Data Retention Policy / আমি গোপনীয়তা নীতিতে সম্মত</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={consentGuidelines} onChange={(e) => setConsentGuidelines(e.target.checked)} />
            <span>I pledge to uphold verified Campus Community Guidelines / আমি ক্যাম্পাস নীতিমালা মেনে চলব</span>
          </label>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            {errorMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow"
        >
          {submitting ? 'Sending 6-Digit OTP...' : 'Send 6-Digit Verification OTP / ওটিপি পাঠান'}
        </button>
      </form>
    </div>
  );
}
