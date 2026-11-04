'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUi } from '@/lib/i18n-client';
import { UniversityCombobox, type UniversityOption } from '@/components/auth/UniversityCombobox';
import { HallCombobox, type HallOption } from '@/components/auth/HallCombobox';

type DemoRole = 'student' | 'faculty' | 'alumni' | 'admin';

interface DepartmentOption {
  id: string;
  code: string;
  name_en: string;
  name_bn: string;
  faculty_en?: string | null;
}

interface ProgramOption {
  id: string;
  code: string;
  name_en: string;
  name_bn: string;
  cycle: 'UNDERGRADUATE' | 'GRADUATE' | 'DOCTORAL' | 'DIPLOMA';
  duration_years?: number | null;
}

/**
 * Registry reads used to be `.catch(() => undefined)`-swallowed, which made a
 * server-side fault (missing env, RLS change, unapplied migration) look exactly
 * like an empty database: a combobox saying "No options found" with nothing in
 * the runtime logs. This returns the *reason* so the form can show it and offer
 * a retry. `cache: 'no-store'` mirrors the server's own Cache-Control.
 */
async function fetchRegistry<T>(
  url: string,
  locale: string
): Promise<{ data: T[]; error: string | null }> {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    const payload = await response.json().catch(() => null);
    if (payload?.success && Array.isArray(payload.data)) {
      return { data: payload.data as T[], error: null };
    }
    const err = payload?.error;
    const message = err
      ? (locale === 'bn' ? err.message_bn || err.message_en : err.message_en || err.message_bn)
      : `HTTP ${response.status}`;
    return { data: [], error: String(message || 'Request failed') };
  } catch (cause) {
    return { data: [], error: cause instanceof Error ? cause.message : 'Network error' };
  }
}

const CYCLE_LABEL: Record<ProgramOption['cycle'], string> = {
  UNDERGRADUATE: 'Undergraduate',
  GRADUATE: "Master's",
  DOCTORAL: 'Doctorate',
  DIPLOMA: 'Diploma',
};

interface RegistrySelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; group?: string }>;
  placeholder: string;
  hint: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  required?: boolean;
}

/** Native <select> (37+ departments per campus) grouped by faculty / cycle. */
function RegistrySelect({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  hint,
  loading,
  error,
  onRetry,
  required,
}: RegistrySelectProps) {
  const { t } = useUi();
  const groups = Array.from(new Set(options.map((option) => option.group ?? '')));

  if (loading) {
    return <div className="h-[70px] rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />;
  }

  return (
    <div>
      <label className="block font-medium mb-1" htmlFor={id}>
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </label>
      {options.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-3 text-xs text-slate-500 dark:text-slate-400">
          {error ?? t('Nothing to pick from yet for this university.')}
        </div>
      ) : (
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
        >
          <option value="">{placeholder}</option>
          {groups.map((group) =>
            group ? (
              <optgroup key={group} label={group}>
                {options
                  .filter((option) => (option.group ?? '') === group)
                  .map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
              </optgroup>
            ) : (
              options
                .filter((option) => !option.group)
                .map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))
            )
          )}
        </select>
      )}
      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
        {error ? (
          <span className="text-rose-500">
            {error}{' '}
            <button type="button" onClick={onRetry} className="font-semibold underline">
              {t('Try again')}
            </button>
          </span>
        ) : (
          hint
        )}
      </p>
    </div>
  );
}

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
  const [universitiesError, setUniversitiesError] = React.useState<string | null>(null);
  // Bumped by every "Try again" link: one control that re-runs all four reads.
  const [reloadKey, setReloadKey] = React.useState(0);
  const [role, setRole] = React.useState<DemoRole | ''>('');
  const [universityId, setUniversityId] = React.useState('');

  const [halls, setHalls] = React.useState<HallOption[]>([]);
  const [hallId, setHallId] = React.useState('');
  const [loadingHalls, setLoadingHalls] = React.useState(false);
  const [hallsError, setHallsError] = React.useState<string | null>(null);

  const [departments, setDepartments] = React.useState<DepartmentOption[]>([]);
  const [departmentId, setDepartmentId] = React.useState('');
  const [loadingDepartments, setLoadingDepartments] = React.useState(false);
  const [departmentsError, setDepartmentsError] = React.useState<string | null>(null);

  const [programs, setPrograms] = React.useState<ProgramOption[]>([]);
  const [programId, setProgramId] = React.useState('');
  const [loadingPrograms, setLoadingPrograms] = React.useState(true);
  const [programsError, setProgramsError] = React.useState<string | null>(null);

  const [fullName, setFullName] = React.useState('');
  const [studentId, setStudentId] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [consentTerms, setConsentTerms] = React.useState(false);
  const [consentPrivacy, setConsentPrivacy] = React.useState(false);
  const [consentGuidelines, setConsentGuidelines] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const bn = locale === 'bn';
  const pick = React.useCallback(
    (row: { name_en: string; name_bn?: string | null }) => (bn && row.name_bn ? row.name_bn : row.name_en),
    [bn]
  );

  // The two campus-independent registries. `programs` is served from
  // public.academic_programs (migration 0012); a deployment whose migration has
  // not run yet just sees the select fall back to "nothing to pick from yet".
  React.useEffect(() => {
    let cancelled = false;
    setLoadingUniversities(true);
    setLoadingPrograms(true);
    fetchRegistry<UniversityOption>('/api/universities', locale).then(({ data, error }) => {
      if (cancelled) return;
      setUniversities(data);
      setUniversitiesError(error);
      setLoadingUniversities(false);
    });
    fetchRegistry<ProgramOption>('/api/programs', locale).then(({ data, error }) => {
      if (cancelled) return;
      setPrograms(data);
      setProgramsError(error);
      setLoadingPrograms(false);
    });
    return () => {
      cancelled = true;
    };
  }, [locale, reloadKey]);

  // Residential halls for the selected university (mandatory for students).
  React.useEffect(() => {
    setHallId('');
    setHallsError(null);
    if (!universityId) {
      setHalls([]);
      return;
    }
    let cancelled = false;
    setLoadingHalls(true);
    fetchRegistry<HallOption>(`/api/halls?universityId=${encodeURIComponent(universityId)}`, locale).then(
      ({ data, error }) => {
        if (cancelled) return;
        setHalls(data);
        setHallsError(error);
        setLoadingHalls(false);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [universityId, locale, reloadKey]);

  // Departments of the selected university (optional: not every campus has a
  // seeded roster yet, and a wrong department is fixable in the profile).
  React.useEffect(() => {
    setDepartmentId('');
    setDepartmentsError(null);
    if (!universityId) {
      setDepartments([]);
      return;
    }
    let cancelled = false;
    setLoadingDepartments(true);
    fetchRegistry<DepartmentOption>(
      `/api/departments?universityId=${encodeURIComponent(universityId)}`,
      locale
    ).then(({ data, error }) => {
      if (cancelled) return;
      setDepartments(data);
      setDepartmentsError(error);
      setLoadingDepartments(false);
    });
    return () => {
      cancelled = true;
    };
  }, [universityId, locale, reloadKey]);

  // Registry-backed fields are only enforced when their list actually loaded:
  // an outage must not turn into an unsolvable form, only into a hint.
  const departmentRequired = (role === 'student' || role === 'faculty') && departments.length > 0;
  const programRequired = role === 'student' && programs.length > 0;

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
    if (departmentRequired && !departmentId) {
      return setErrorMsg(t('Select your department to continue'));
    }
    if (programRequired && !programId) {
      return setErrorMsg(t('Select your academic program to continue'));
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
          signupPayload: {
            fullName,
            studentId,
            role,
            hallId: role === 'student' ? hallId : '',
            departmentId: role === 'admin' ? '' : departmentId,
            programId: role === 'student' ? programId : '',
          },
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
            departmentId,
            programId,
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
            {universitiesError && universities.length === 0 ? (
              <div className="mb-2 rounded-xl border border-rose-500/40 bg-rose-500/5 p-3 text-xs text-rose-600 dark:text-rose-300">
                {universitiesError}{' '}
                <button
                  type="button"
                  onClick={() => setReloadKey((key) => key + 1)}
                  className="font-semibold underline"
                >
                  {t('Try again')}
                </button>
              </div>
            ) : null}
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

          {universityId && role !== 'admin' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <RegistrySelect
                id="signup-department"
                label={t('Department')}
                value={departmentId}
                onChange={setDepartmentId}
                loading={loadingDepartments}
                error={departmentsError}
                onRetry={() => setReloadKey((key) => key + 1)}
                required={departmentRequired}
                placeholder={t('Select your department…')}
                hint={t('Routes department notices and course requests to the right office.')}
                options={departments.map((department) => ({
                  value: department.id,
                  label: `${pick(department)} (${department.code})`,
                  group: department.faculty_en ?? undefined,
                }))}
              />
              {role === 'student' ? (
                <RegistrySelect
                  id="signup-program"
                  label={t('Academic Program')}
                  value={programId}
                  onChange={setProgramId}
                  loading={loadingPrograms}
                  error={programsError}
                  onRetry={() => setReloadKey((key) => key + 1)}
                  required={programRequired}
                  placeholder={t('Select your academic program…')}
                  hint={t('Honors, Degree, professional B.Sc., Master\'s or Ph.D. — it sets your term structure.')}
                  options={programs.map((program) => ({
                    value: program.id,
                    label: program.duration_years
                      ? `${pick(program)} · ${program.duration_years} ${t('yr')}`
                      : pick(program),
                    group: t(CYCLE_LABEL[program.cycle]),
                  }))}
                />
              ) : null}
            </div>
          ) : null}

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
