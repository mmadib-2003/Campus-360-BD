'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUi } from '@/lib/i18n-client';
import { UniversityCombobox, type UniversityOption } from '@/components/auth/UniversityCombobox';
import { setDemoSession } from '@/lib/modules/demo-data';

export default function AdminLoginPage() {
  const router = useRouter();
  const { t } = useUi();
  const [universities, setUniversities] = React.useState<UniversityOption[]>([]);
  const [universityId, setUniversityId] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/universities')
      .then((response) => response.json())
      .then((payload) => {
        if (!cancelled && payload?.success) setUniversities(payload.data as UniversityOption[]);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = universities.find((university) => university.id === universityId);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!universityId) return setError(t('Select your university to continue'));
    if (!email.trim()) return setError(t('Enter your university email'));
    setLoading(true);
    try {
      const response = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          universityId,
          role: 'admin',
          signupPayload: { role: 'admin', fullName: 'University Admin' },
        }),
      });
      const payload = await response.json();
      if (!payload.success) {
        setError(payload?.error?.message_en ?? t('Verification failed'));
        return;
      }
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(
          'campus360.signup',
          JSON.stringify({
            email,
            universityId: payload.data?.universityId ?? universityId,
            role: 'admin',
            fullName: 'University Admin',
            studentId: `${selected?.code ?? 'BD'}-ADM-001`,
            demoCode: payload.data?.demoCode ?? null,
            demo: Boolean(payload.data?.demo),
            expiresAt: payload.data?.expiresAt ?? null,
          })
        );
      }
      router.push(`/verify-email?email=${encodeURIComponent(email)}&role=admin`);
    } catch {
      setError(t('Verification failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto my-12 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-2">
        <span className="text-xl" aria-hidden>
          🏛️
        </span>
        <h1 className="text-xl font-bold">{t('Admin Login')}</h1>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('University admins sign in here with their institutional email.')}</p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-sm">
        <UniversityCombobox
          universities={universities}
          value={universityId}
          onChange={setUniversityId}
          label={t('Institution')}
          placeholder={t('Search university by name, code or city…')}
          hint={t('Type to search — try “Dhaka” or “BUET”')}
        />
        <div>
          <label className="block font-medium mb-1" htmlFor="admin-email">
            {t('Admin email')}
          </label>
          <input
            id="admin-email"
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={selected?.university_email_domains?.[0] ? `admin@${selected.university_email_domains[0].domain}` : 'admin@du.ac.bd'}
            className="w-full rounded-xl p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
          />
        </div>
        {error && <p className="text-xs text-rose-500">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold disabled:opacity-60"
        >
          {loading ? t('Sending OTP…') : t('Send Admin OTP')}
        </button>
      </form>

      <p className="mt-4 text-[11px] text-slate-500 dark:text-slate-400">{t('Admin access is limited to verified university officers.')}</p>
      <Link href="/signin" className="mt-2 inline-block text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
        {t('Back to student login')}
      </Link>
    </div>
  );
}
