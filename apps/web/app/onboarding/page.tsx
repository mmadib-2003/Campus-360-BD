'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useUi } from '@/lib/i18n-client';
import { useSession } from '@/lib/modules/client';
import { notifyAuthChanged } from '@/lib/auth-events';
import { ProgramSessionCombobox } from '@/components/auth/ProgramSessionCombobox';
import { HallCombobox, type HallOption } from '@/components/auth/HallCombobox';
import { ProgramSessionSchema } from '@campus360/shared';
import { requiresHall } from '@/lib/auth-rules';
import { setDemoSession } from '@/lib/modules/demo-data';

export default function OnboardingPage() {
  const router = useRouter();
  const { t } = useUi();
  const session = useSession();
  const [programSession, setProgramSession] = React.useState('');
  const [hallId, setHallId] = React.useState('');
  const [halls, setHalls] = React.useState<HallOption[]>([]);
  const [loadingHalls, setLoadingHalls] = React.useState(false);
  const [batch, setBatch] = React.useState('');
  const [bio, setBio] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [consent, setConsent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const initializedFor = React.useRef<string | null>(null);
  const role = String(session.roles[0] ?? 'student').toLowerCase();
  const student = requiresHall(role);
  const universityId = session.profile?.university_id;

  React.useEffect(() => {
    if (session.loading) return;
    if (!session.authenticated) { router.replace('/signin'); return; }
    if (session.error) { setError(t('Could not load your profile. Please retry.')); return; }
    const profile = session.profile as (typeof session.profile & {
      program_session?: string | null; hall_id?: string | null; batch?: string | null;
      bio?: string | null; crisis_callback_phone?: string | null; crisis_callback_consent?: boolean | null;
    });
    if (profile && initializedFor.current !== session.userId) {
      initializedFor.current = session.userId;
      setProgramSession(profile.program_session ?? '');
      setHallId(profile.hall_id ?? '');
      setBatch(profile.batch ?? '');
      setBio(profile.bio ?? '');
      setPhone(profile.crisis_callback_phone ?? '');
      setConsent(Boolean(profile.crisis_callback_consent));
    }
  }, [session.loading, session.authenticated, session.error, session.profile, session.userId, router, t]);

  React.useEffect(() => {
    setHalls([]);
    if (!student || !universityId || session.demo) return;
    const controller = new AbortController();
    setLoadingHalls(true);
    fetch(`/api/halls?universityId=${encodeURIComponent(universityId)}`, { cache: 'no-store', signal: controller.signal })
      .then((response) => response.json())
      .then((payload) => {
        if (!payload.success) throw new Error(payload?.error?.message_en ?? 'Hall lookup failed');
        setHalls(Array.isArray(payload.data) ? payload.data : []);
      })
      .catch(() => { if (!controller.signal.aborted) setError(t('Could not load halls. Please retry.')); })
      .finally(() => { if (!controller.signal.aborted) setLoadingHalls(false); });
    return () => controller.abort();
  }, [student, universityId, session.demo, session.error, t]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setError(null);
    if (!ProgramSessionSchema.safeParse(programSession).success) {
      setError(t('Enter consecutive years in YYYY-YY format, for example 2023-24.')); return;
    }
    if (student && !session.demo && (loadingHalls || !hallId || !halls.some((hall) => hall.id === hallId))) {
      setError(t('Select your residential hall to continue')); return;
    }
    setSaving(true);
    try {
      const selectedHallId = student ? hallId || null : null;
      if (session.demo) {
        // Offline preview only; production always saves through the authenticated API.
        setDemoSession({ programSession: programSession.trim(), hallId: selectedHallId,
          hallName: halls.find((hall) => hall.id === selectedHallId)?.name ?? null });
      } else {
        const response = await fetch('/api/profile', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ program_session: programSession.trim(), hall_id: selectedHallId,
            batch: batch.trim(), bio: bio.trim(), crisis_callback_phone: phone.trim(),
            crisis_callback_consent: consent, onboarding_completed: true }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          setError(payload?.error?.message_en ?? t('Could not save your profile. Please try again.')); return;
        }
      }
      notifyAuthChanged();
      session.refresh();
      router.push('/');
    } catch {
      setError(t('Could not save your profile. Please try again.'));
    } finally { setSaving(false); }
  }

  if (session.loading || !session.authenticated) {
    return <div role="status" className="my-16 text-center text-sm text-slate-500">{t('Loading your profile…')}</div>;
  }
  const inputClass = 'w-full min-h-[44px] rounded-xl p-2.5 text-base sm:text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700';
  return (
    <div className="max-w-md w-full mx-auto my-8 p-4 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <h1 className="text-xl font-bold">{t('Complete Your Profile')}</h1>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {t('Your program session is required. Your verified account role determines the hall and email rules.')}
      </p>
      <div className="mt-4 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
        {t('Role')}: <strong>{t(role === 'faculty' ? 'Faculty / Staff' : role === 'alumni' ? 'Alumni' : role === 'admin' ? 'Platform Admin' : role === 'governance' ? 'University Governance' : 'Student')}</strong>
        {!student && <span className="block mt-1">{t('No residential hall is required for your role.')}</span>}
      </div>
      {session.error && <button type="button" className="mt-3 text-xs underline text-emerald-500" onClick={session.refresh}>{t('Try again')}</button>}
      <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-sm">
        <ProgramSessionCombobox id="onboarding-program-session" value={programSession} onChange={setProgramSession} disabled={saving} />
        {student && !session.demo && <HallCombobox id="onboarding-hall" halls={halls} value={hallId} onChange={setHallId}
          label={t('Residential Hall')} placeholder={t('Search your residential hall…')} disabled={saving || loadingHalls} />}
        <div>
          <label htmlFor="onboarding-batch" className="block font-medium mb-1">{t('Batch / Year')}</label>
          <input id="onboarding-batch" placeholder="2023-24" value={batch} onChange={(event) => setBatch(event.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="onboarding-bio" className="block font-medium mb-1">{t('Short Bio')}</label>
          <textarea id="onboarding-bio" rows={3} value={bio} onChange={(event) => setBio(event.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="onboarding-phone" className="block font-medium mb-1">{t('Crisis Callback Phone (Optional)')}</label>
          <input id="onboarding-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className={inputClass} />
          <label className="mt-2 flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 h-4 w-4" />
            {t('I consent to confidential crisis callback contact by authorized campus counselors.')}
          </label>
        </div>
        {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}
        <button type="submit" disabled={saving || session.error || (student && !session.demo && loadingHalls)}
          className="w-full min-h-[44px] py-2.5 rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-60">
          {saving ? t('Saving…') : t('Save & Continue')}
        </button>
      </form>
    </div>
  );
}
