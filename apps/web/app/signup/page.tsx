'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUi } from '@/lib/i18n-client';
import { UniversityCombobox, type UniversityOption } from '@/components/auth/UniversityCombobox';
import { HallCombobox, type HallOption } from '@/components/auth/HallCombobox';
import { DEMO_ACADEMIC_PROGRAMS, getStaticJuDepartments } from '@/lib/modules/demo-data';
import { RoleSelector } from '@/components/auth/RoleSelector';
import { RoleEmailField } from '@/components/auth/RoleEmailField';
import { ProgramSessionCombobox } from '@/components/auth/ProgramSessionCombobox';
import { approvedDomains, hallForRole, matchesUniversityDomain, requiresHall } from '@/lib/auth-rules';
import { ProgramSessionSchema, RequestOtpSchema } from '@campus360/shared';

interface DepartmentOption {
  id: string;
  code: string;
  name_en: string;
  name_bn: string;
  faculty_en?: string | null;
  faculty_bn?: string | null;
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
async function fetchRegistryOnce<T>(
  url: string,
  locale: string
): Promise<{ data: T[]; error: string | null; retryable: boolean }> {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    const payload = await response.json().catch(() => null);
    if (payload?.success && Array.isArray(payload.data)) {
      return { data: payload.data as T[], error: null, retryable: false };
    }
    if (!payload?.error) {
      // No envelope at all: a 5xx whose body was not our JSON, i.e. the handler
      // threw before it could answer. `HTTP 500` alone told nobody anything, so
      // point at the probe that names the variable, and treat it as retryable
      // (a cold start can genuinely produce one of these).
      const reason =
        response.status >= 500
          ? `The server could not answer this request (HTTP ${response.status}). GET /api/health/registry names the exact cause.`
          : `HTTP ${response.status}`;
      return { data: [], error: reason, retryable: response.status >= 500 };
    }
    const err = payload?.error;
    const message = err
      ? (locale === 'bn' ? err.message_bn || err.message_en : err.message_en || err.message_bn)
      : `HTTP ${response.status}`;
    // FETCH_FAILED / SUPABASE_URL_INVALID are the route telling us *its* upstream
    // call did not complete. That is worth exactly one more try from here, and
    // nothing else is (a 400 or an empty list will not change by asking again).
    const retryable = err?.code === 'FETCH_FAILED';
    return { data: [], error: String(message || 'Request failed'), retryable };
  } catch (cause) {
    // A rejected `fetch()` is a browser-side transport failure (offline, DNS,
    // TLS, an aborted cold start). Distinct from the server's own upstream
    // failure, which arrives as a JSON envelope above.
    return {
      data: [],
      error: cause instanceof Error ? cause.message : 'Network error',
      retryable: true,
    };
  }
}

async function fetchRegistry<T>(url: string, locale: string): Promise<{ data: T[]; error: string | null }> {
  const first = await fetchRegistryOnce<T>(url, locale);
  if (!first.error || !first.retryable) return { data: first.data, error: first.error };
  await new Promise((resolve) => setTimeout(resolve, 400));
  const second = await fetchRegistryOnce<T>(url, locale);
  return { data: second.data, error: second.error };
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
          className="w-full max-w-full min-h-[44px] rounded-xl p-2.5 text-base sm:text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
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

export default function SignUpPage() {
  const router = useRouter();
  const { locale, t } = useUi();
  const [universities, setUniversities] = React.useState<UniversityOption[]>([]);
  const [loadingUniversities, setLoadingUniversities] = React.useState(true);
  const [universitiesError, setUniversitiesError] = React.useState<string | null>(null);
  // Bumped by every "Try again" link: one control that re-runs all four reads.
  const [reloadKey, setReloadKey] = React.useState(0);
  const [role, setRole] = React.useState('');
  const [programSession, setProgramSession] = React.useState('');
  const [universityId, setUniversityId] = React.useState('');

  const [halls, setHalls] = React.useState<HallOption[]>([]);
  const [hallId, setHallId] = React.useState('');
  const [loadingHalls, setLoadingHalls] = React.useState(false);
  const [hallsError, setHallsError] = React.useState<string | null>(null);

  const [departments, setDepartments] = React.useState<DepartmentOption[]>([]);
  const [selectedFaculty, setSelectedFaculty] = React.useState('');
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
    fetchRegistry<ProgramOption>('/api/programs?v=ju38', locale).then(({ data, error }) => {
      if (cancelled) return;
      setPrograms(data.length > 0 ? data : DEMO_ACADEMIC_PROGRAMS);
      setProgramsError(data.length > 0 ? error : null);
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
    if (!universityId || !requiresHall(role)) {
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
  }, [universityId, role, locale, reloadKey]);

  // Departments & Institutes of the selected university.
  React.useEffect(() => {
    setSelectedFaculty('');
    setDepartmentId('');
    setDepartmentsError(null);
    if (!universityId) {
      setDepartments([]);
      return;
    }
    const matchedUni = universities.find((u) => u.id === universityId);
    const uniCode = matchedUni?.code ?? '';
    let cancelled = false;
    setLoadingDepartments(true);
    fetchRegistry<DepartmentOption>(
      `/api/departments?universityId=${encodeURIComponent(universityId)}&universityCode=${encodeURIComponent(uniCode)}&v=ju38`,
      locale
    ).then(({ data, error }) => {
      if (cancelled) return;
      if (data.length === 0 && uniCode.toUpperCase() === 'JU') {
        setDepartments(getStaticJuDepartments(universityId));
        setDepartmentsError(null);
      } else {
        setDepartments(data);
        setDepartmentsError(error);
      }
      setLoadingDepartments(false);
    });
    return () => {
      cancelled = true;
    };
  }, [universityId, universities, locale, reloadKey]);

  const facultyOptions = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const dept of departments) {
      const key = dept.faculty_en?.trim();
      if (!key || seen.has(key)) continue;
      seen.set(key, bn && dept.faculty_bn ? dept.faculty_bn : key);
    }
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
  }, [departments, bn]);

  const visibleDepartments = React.useMemo(() => {
    if (!selectedFaculty) return departments;
    return departments.filter((dept) => (dept.faculty_en ?? '') === selectedFaculty);
  }, [departments, selectedFaculty]);

  // Registry-backed fields are only enforced when their list actually loaded:
  // an outage must not turn into an unsolvable form, only into a hint.
  const departmentRequired = (role === 'student' || role === 'faculty') && departments.length > 0;
  const programRequired = role === 'student' && programs.length > 0;

  const selectedUniversity = universities.find((university) => university.id === universityId);
  const domains = approvedDomains(selectedUniversity);
  const domainApproved = !requiresHall(role) || matchesUniversityDomain(email, domains);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMsg(null);

    if (!role) return setErrorMsg(t('Select your role to continue'));
    if (!universityId) return setErrorMsg(t('Select your university to continue'));
    if (requiresHall(role) && (loadingHalls || !hallId || !halls.some((hall) => hall.id === hallId))) {
      return setErrorMsg(t('Select your residential hall to continue'));
    }
    if (!ProgramSessionSchema.safeParse(programSession).success) {
      return setErrorMsg(t('Enter consecutive years in YYYY-YY format, for example 2023-24.'));
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
    if (requiresHall(role) && !domainApproved) return setErrorMsg(t('This email domain is not approved for the selected university.'));
    if (!consentTerms || !consentPrivacy || !consentGuidelines) {
      return setErrorMsg(t('Please accept Terms, Privacy Policy, and Community Guidelines.'));
    }

    const signupPayload = {
      fullName: fullName.trim(), studentId: studentId.trim(), role,
      hallId: hallForRole(role, hallId), programSession: programSession.trim(),
      departmentId: departmentId || null,
      programId: role === 'student' ? programId || null : null,
    };
    const request = { email, universityId, role, purpose: 'signup',
      hallId: signupPayload.hallId, programSession: signupPayload.programSession, signupPayload };
    if (!RequestOtpSchema.safeParse(request).success) return setErrorMsg(t('Check your email, role and university details'));
    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
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
            hallId: signupPayload.hallId,
            hallName: signupPayload.hallId ? halls.find((hall) => hall.id === hallId)?.name ?? '' : null,
            programSession: signupPayload.programSession,
            purpose: 'signup',
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
    <div className="w-full max-w-2xl mx-auto my-8 px-3 sm:px-6 space-y-5">
      <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/logos/campus360-logo.jpg"
              alt="Campus360 BD"
              className="h-12 w-12 rounded-full object-cover bg-white p-0.5 shadow-sm shrink-0"
            />
            <div>
              <h1 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{t('Join Your Campus')}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('Create your verified campus account')}</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 text-[11px] font-semibold">
            {universities.length || 12}+ {t('Public University')}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5 text-sm">
          <RoleSelector id="signup-role" value={role} disabled={submitting}
            onChange={(next) => { setRole(next); setHallId(''); setErrorMsg(null); }} />

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

          {requiresHall(role) && universityId && (
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
                  hint={t('Select your residential hall for this university.')}
                  invalid={Boolean(errorMsg && !hallId)}
                />
              )}
            </div>
          )}

          <ProgramSessionCombobox value={programSession} onChange={setProgramSession} disabled={submitting} />

          {universityId && role ? (
            <div className="space-y-4">
              {facultyOptions.length > 1 ? (
                <div>
                  <label className="block font-medium mb-1" htmlFor="signup-faculty">
                    {bn ? 'অনুষদ / ইনস্টিটিউট' : 'Faculty / Institute'}
                  </label>
                  <select
                    id="signup-faculty"
                    value={selectedFaculty}
                    onChange={(event) => {
                      const nextFaculty = event.target.value;
                      setSelectedFaculty(nextFaculty);
                      if (nextFaculty && departmentId) {
                        const stillMatches = departments.some(
                          (d) => d.id === departmentId && (d.faculty_en ?? '') === nextFaculty
                        );
                        if (!stillMatches) setDepartmentId('');
                      }
                    }}
                    className="w-full max-w-full min-h-[44px] rounded-xl p-2.5 text-base sm:text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                  >
                    <option value="">
                      {bn
                        ? `সকল অনুষদ ও ইনস্টিটিউট (${departments.length})`
                        : `All Faculties & Institutes (${departments.length})`}
                    </option>
                    {facultyOptions.map((faculty) => (
                      <option key={faculty.value} value={faculty.value}>
                        {faculty.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <RegistrySelect
                  id="signup-department"
                  label={bn ? 'বিভাগ / ইনস্টিটিউট' : t('Department')}
                  value={departmentId}
                  onChange={setDepartmentId}
                  loading={loadingDepartments}
                  error={departmentsError}
                  onRetry={() => setReloadKey((key) => key + 1)}
                  required={departmentRequired}
                  placeholder={t('Select your department…')}
                  hint={t('Routes department notices and course requests to the right office.')}
                  options={visibleDepartments.map((department) => ({
                    value: department.id,
                    label: `${pick(department)} (${department.code})`,
                    group:
                      bn && department.faculty_bn
                        ? department.faculty_bn
                        : (department.faculty_en ?? undefined),
                  }))}
                />
                {role === 'student' || role === '' ? (
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
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                className="w-full max-w-full min-h-[44px] rounded-xl p-2.5 text-base sm:text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block font-medium mb-1" htmlFor="signup-student-id">
                {t(role === 'student' || !role ? 'Student ID' : 'Campus ID')}
              </label>
              <input
                id="signup-student-id"
                required
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                placeholder={selectedUniversity ? `${selectedUniversity.code}-2026-12345` : 'DU-2026-12345'}
                className="w-full max-w-full min-h-[44px] rounded-xl p-2.5 text-base sm:text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
              />
            </div>
          </div>

          <RoleEmailField id="signup-email" value={email} onChange={setEmail} role={role} domains={domains} disabled={submitting} />

          <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
            <label className="flex items-center gap-2 min-h-[44px]">
              <input type="checkbox" className="h-5 w-5 shrink-0" checked={consentTerms} onChange={(event) => setConsentTerms(event.target.checked)} />
              <span>{t('I agree to the Terms of Service')}</span>
            </label>
            <label className="flex items-center gap-2 min-h-[44px]">
              <input type="checkbox" className="h-5 w-5 shrink-0" checked={consentPrivacy} onChange={(event) => setConsentPrivacy(event.target.checked)} />
              <span>{t('I agree to the Privacy & Data Retention Policy')}</span>
            </label>
            <label className="flex items-center gap-2 min-h-[44px]">
              <input
                type="checkbox"
                className="h-5 w-5 shrink-0"
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
            disabled={submitting || (requiresHall(role) && loadingHalls)}
            className="w-full min-h-[44px] py-3 rounded-xl font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow disabled:opacity-60"
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
        <p className="font-semibold text-emerald-700 dark:text-emerald-300">{t('Email OTP is required for every account.')}</p>
        <p className="mt-1">{t('Your data stays inside your university tenant.')}</p>
      </div>
    </div>
  );
}
