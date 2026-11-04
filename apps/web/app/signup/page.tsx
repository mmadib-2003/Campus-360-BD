'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUi } from '@/lib/i18n-client';
import { UniversityCombobox, type UniversityOption } from '@/components/auth/UniversityCombobox';
import { HallCombobox, type HallOption } from '@/components/auth/HallCombobox';

type DemoRole = 'student' | 'faculty' | 'alumni' | 'admin';

const ROLES: Array<{ value: DemoRole; icon: string; key: string }> = [
  { value: 'student', icon: '🎓', key: 'Student' },
  { value: 'faculty', icon: '🏫', key: 'Faculty / Staff' },
  { value: 'alumni', icon: '🤝', key: 'Alumni' },
  { value: 'admin', icon: '🏛️', key: 'University Admin' },
];

export default function SignUpPage() {
  const router = useRouter();
  const { locale, t } = useUi();
  const [universities, setUniversities] = React.useState<UniversityOption[]>([]);
  const [loadingUniversities, setLoadingUniversities] = React.useState(true);
  const [role, setRole] = React.useState<DemoRole | ''>('');
  const [universityId, setUniversityId] = React.useState('');
  const [halls, setHalls] = React.useState<HallOption[]>([]);
  const [hallId, setHallId] = React.useState('');
  const [loadingHalls, setLoadingHalls] = React.useState(false);
  const [fullName, setFullName] = React.useState('');
  const [studentId, setStudentId] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [consentTerms, setConsentTerms] = React.useState(false);
  const [consentPrivacy, setConsentPrivacy] = React.useState(false);
  const [consentGuidelines, setConsentGuidelines] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/universities')
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return;
        if (payload?.success && Array.isArray(payload.data)) {
          setUniversities(payload.data as UniversityOption[]);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoadingUniversities(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Residential halls for the selected university (mandatory for students).
  React.useEffect(() => {
    setHallId('');
    if (!universityId) {
      setHalls([]);
      return;
    }
    let cancelled = false;
    setLoadingHalls(true);
    fetch(`/api/halls?universityId=${encodeURIComponent(universityId)}`)
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return;
        if (payload?.success && Array.isArray(payload.data)) {
          setHalls(payload.data as HallOption[]);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoadingHalls(false);
      });
    return () => {
      cancelled = true;
    };
  }, [universityId]);

  const selectedUniversity = universities.find((university) => university.id === universityId);
  const emailDomain = email.includes('@') ? email.split('@')[1]?.toLowerCase() ?? '' : '';
  const domainApproved = Boolean(
    selectedUniversity?.university_email_domains?.some((domain) => domain.domain.toLowerCase() === emailDomain)
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMsg(null);

    if (!role) return setErrorMsg(t('Select your role to continue'));
    if (!universityId) return setErrorMsg(t('Select your university to continue'));
    if (role === 'student' && !hallId) {
      return setErrorMsg(t('Select your residential hall to continue'));
    }
    if (!fullName.trim()) return setErrorMsg(t('Enter your full name'));
    if (!studentId.trim()) return setErrorMsg(t('Enter your student ID'));
    if (!email.trim()) return setErrorMsg(t('Enter your university email'));
    if (!domainApproved) return setErrorMsg(t('This email domain is not approved for the selected university.'));
    if (!consentTerms || !consentPrivacy || !consentGuidelines) {
      return setErrorMsg(t('Please accept Terms, Privacy Policy, and Community Guidelines.'));
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          universityId,
          role,
          signupPayload: { fullName, studentId, role, hallId: role === 'student' ? hallId : '' },
        }),
      });
      const payload = await response.json();
      if (!payload.success) {
        setErrorMsg(payload?.error?.message_en ?? t('Verification failed'));
        return;
      }
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(
          'campus360.signup',
          JSON.stringify({
            email,
            universityId: payload.data?.universityId ?? universityId,
            role,
            fullName,
            studentId,
            hallId: role === 'student' ? hallId : '',
            demoCode: payload.data?.demoCode ?? null,
            demo: Boolean(payload.data?.demo),
            expiresAt: payload.data?.expiresAt ?? null,
          })
        );
      }
      router.push(`/verify-email?email=${encodeURIComponent(email)}&role=${role}`);
    } catch {
      setErrorMsg(t('Verification failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto my-8 space-y-5">
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{t('Join Your Campus')}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('Create your verified campus account')}</p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 text-[11px] font-semibold">
            {universities.length || 12}+ {t('Public University')}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5 text-sm">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">{t('I am a')}</span>
              <span className="text-[11px] text-slate-400">1 / 3</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {ROLES.map((option) => {
                const active = role === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRole(option.value)}
                    aria-pressed={active}
                    className={`rounded-xl border p-3 text-left transition ${
                      active
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-700 hover:border-emerald-500/40'
                    }`}
                  >
                    <span className="text-base" aria-hidden>
                      {option.icon}
                    </span>
                    <span className="block text-xs font-semibold mt-1">{t(option.key)}</span>
                  </button>
                );
              })}
            </div>
            {role === 'admin' && (
              <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-300">
                {t('Admin accounts are verified through the institution')}{' '}
                <Link href="/admin/login" className="font-semibold underline">
                  {t('Go to admin login')}
                </Link>
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">{t('Public University')}</span>
              <span className="text-[11px] text-slate-400">2 / 3</span>
            </div>
            {loadingUniversities ? (
              <div className="h-10 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
            ) : (
              <UniversityCombobox
                universities={universities}
                value={universityId}
                onChange={setUniversityId}
                label={t('Public University')}
                placeholder={t('Search university by name, code or city…')}
                hint={t('Type to search — try “Dhaka” or “BUET”')}
                invalid={Boolean(errorMsg && !universityId)}
              />
            )}
          </div>

          {role === 'student' && universityId && (
            <div>
              {loadingHalls ? (
                <div className="h-10 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
              ) : (
                <HallCombobox
                  halls={halls}
                  value={hallId}
                  onChange={setHallId}
                  label={t('Residential Hall')}
                  placeholder={t('Search your residential hall…')}
                  hint={t('Required for students — your hall allocation is verified by the hall office.')}
                  invalid={Boolean(errorMsg && !hallId)}
                />
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium mb-1" htmlFor="signup-name">
                {t('Full Name')}
              </label>
              <input
                id="signup-name"
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder={locale === 'bn' ? 'নুসরাত জাহান' : 'Nusrat Jahan'}
                className="w-full rounded-xl p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block font-medium mb-1" htmlFor="signup-student-id">
                {t('Student ID')}
              </label>
              <input
                id="signup-student-id"
                required
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                placeholder={selectedUniversity ? `${selectedUniversity.code}-2026-12345` : 'DU-2026-12345'}
                className="w-full rounded-xl p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium mb-1" htmlFor="signup-email">
              {t('University Email')}
            </label>
            <input
              id="signup-email"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={
                selectedUniversity?.university_email_domains?.[0]
                  ? `name@${selectedUniversity.university_email_domains[0].domain}`
                  : 'name@du.ac.bd'
              }
              className={`w-full rounded-xl p-2.5 bg-slate-100 dark:bg-slate-800 border ${
                email && !domainApproved ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'
              }`}
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {t('Use your institutional email — for example')}{' '}
              {selectedUniversity?.university_email_domains?.[0]
                ? `name@${selectedUniversity.university_email_domains[0].domain}`
                : 'name@du.ac.bd'}
            </p>
            {email && !domainApproved && (
              <p className="text-[11px] text-rose-500 mt-1">{t('This email domain is not approved for the selected university.')}</p>
            )}
          </div>

          <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={consentTerms} onChange={(event) => setConsentTerms(event.target.checked)} />
              <span>{t('I agree to the Terms of Service')}</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={consentPrivacy} onChange={(event) => setConsentPrivacy(event.target.checked)} />
              <span>{t('I agree to the Privacy & Data Retention Policy')}</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={consentGuidelines}
                onChange={(event) => setConsentGuidelines(event.target.checked)}
              />
              <span>{t('I pledge to uphold the Campus Community Guidelines')}</span>
            </label>
          </div>

          {errorMsg && (
            <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow disabled:opacity-60"
          >
            {submitting ? t('Sending OTP…') : t('Send 6-Digit Verification OTP')}
          </button>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <Link href="/signin" className="text-emerald-600 dark:text-emerald-400 hover:underline">
              {t('Already have an account? Sign in')}
            </Link>
            <Link href="/admin/login" className="text-slate-500 hover:underline">
              {t('Admin Login')}
            </Link>
          </div>
        </form>
      </div>

      <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-[11px] text-slate-600 dark:text-slate-300">
        <p className="font-semibold text-emerald-700 dark:text-emerald-300">{t('University email OTP is required for every account.')}</p>
        <p className="mt-1">{t('Your data stays inside your university tenant.')}</p>
      </div>
    </div>
  );
}
