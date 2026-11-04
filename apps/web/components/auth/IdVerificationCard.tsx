'use client';

import React from 'react';
import { useUi } from '@/lib/i18n-client';
import {
  makeSampleIdCard,
  recognizeStudentId,
  studentIdMatches,
  verificationStatus,
  type OcrResult,
} from '@/lib/ocr';

export interface IdVerificationOutcome {
  status: 'VERIFIED' | 'MANUAL_REVIEW';
  idNumber: string | null;
  name: string | null;
  confidence: number;
}

export function IdVerificationCard({
  studentId,
  fullName,
  universityCode,
  onComplete,
  onSkip,
}: {
  studentId: string;
  fullName: string;
  universityCode: string;
  onComplete: (outcome: IdVerificationOutcome) => void;
  onSkip: () => void;
}) {
  const { t } = useUi();
  const [preview, setPreview] = React.useState<string | null>(null);
  const [scanning, setScanning] = React.useState(false);
  const [result, setResult] = React.useState<(OcrResult & { matches: boolean; status: 'VERIFIED' | 'MANUAL_REVIEW' }) | null>(null);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function runOcr(file: File) {
    setScanning(true);
    setError(null);
    setResult(null);
    try {
      const ocr = await recognizeStudentId(file);
      const matches = studentIdMatches(ocr.idNumber, studentId);
      const status = verificationStatus(ocr.confidence, matches);
      const enriched = { ...ocr, matches, status };
      setResult(enriched);

      try {
        await fetch('/api/profile/id-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentIdNumber: ocr.idNumber ?? studentId,
            name: ocr.name ?? fullName,
            confidence: ocr.confidence,
            status,
            matches,
            universityCode,
            fileName: file.name,
          }),
        });
        setSubmitted(true);
        try {
          const key = 'campus360.demo.idverifications';
          const existing = JSON.parse(window.localStorage.getItem(key) ?? '[]') as unknown[];
          existing.unshift({
            id: `demo-idv-${Date.now()}`,
            student_id_number: ocr.idNumber ?? studentId,
            name: ocr.name ?? fullName,
            confidence: ocr.confidence,
            status,
            matches,
            university_code: universityCode,
            created_at: new Date().toISOString(),
          });
          window.localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));
        } catch {
          /* local review queue is best-effort */
        }
      } catch {
        // The OCR result is still shown; submission can be retried.
      }
    } catch {
      setError(t('Low confidence — sent for manual review'));
      const fallback = {
        idNumber: null,
        name: null,
        confidence: 0,
        raw: '',
        matches: false,
        status: 'MANUAL_REVIEW' as const,
      };
      setResult(fallback);
      try {
        await fetch('/api/profile/id-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentIdNumber: studentId,
            name: fullName,
            confidence: 0,
            status: 'MANUAL_REVIEW',
            matches: false,
            universityCode,
            fileName: file.name,
          }),
        });
        setSubmitted(true);
      } catch {
        /* ignore */
      }
    } finally {
      setScanning(false);
    }
  }

  async function handleFile(file: File | null | undefined) {
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    await runOcr(file);
  }

  async function useSample() {
    try {
      const file = await makeSampleIdCard(studentId, fullName, universityCode);
      await handleFile(file);
    } catch {
      setError(t('Low confidence — sent for manual review'));
    }
  }

  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
      <div>
        <h2 className="text-base font-bold">{t('Upload Student ID')}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('Upload a photo of your student ID card. We read the ID number and name on your device.')}</p>
      </div>

      {!result && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 text-white cursor-pointer">
            {t('Choose image')}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
          </label>
          <button
            type="button"
            onClick={useSample}
            disabled={scanning}
            className="px-4 py-2 rounded-xl text-xs font-semibold border border-emerald-500/40 text-emerald-600 dark:text-emerald-300 disabled:opacity-60"
          >
            {t('Use sample ID card')}
          </button>
          <button type="button" onClick={onSkip} className="px-3 py-2 text-xs text-slate-500 hover:underline">
            {t('Skip for now')}
          </button>
        </div>
      )}

      {scanning && (
        <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-300">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          {t('Scanning…')} Tesseract OCR
        </div>
      )}

      {preview && (
        <div className="flex gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Student ID preview" className="w-40 rounded-xl border border-slate-200 dark:border-slate-700" />
          <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
            <p>{t('Optional — adds a second verification factor')}</p>
            <p>{t('Your data stays inside your university tenant.')}</p>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-rose-500">{error}</p>}

      {result && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded-full font-semibold ${
                result.status === 'VERIFIED'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
              }`}
            >
              {result.status === 'VERIFIED' ? t('ID verified') : t('Manual review')}
            </span>
            <span className="text-slate-500">
              {t('OCR confidence')}: {result.confidence}%
            </span>
            {submitted && <span className="text-emerald-600 dark:text-emerald-400">✓ {t('ID verification submitted')}</span>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <span className="block text-slate-400">{t('ID number extracted')}</span>
              <span className="font-mono font-semibold">{result.idNumber ?? '—'}</span>
            </div>
            <div>
              <span className="block text-slate-400">{t('Name extracted')}</span>
              <span className="font-semibold">{result.name ?? '—'}</span>
            </div>
          </div>
          <p className={result.matches ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-300'}>
            {result.matches ? t('Matches the ID you entered') : t('Does not match — sent for manual review')}
          </p>
          {result.status === 'MANUAL_REVIEW' && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('manualReview')}</p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() =>
                onComplete({
                  status: result.status,
                  idNumber: result.idNumber,
                  name: result.name,
                  confidence: result.confidence,
                })
              }
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 text-white"
            >
              {t('Continue to dashboard')}
            </button>
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setPreview(null);
                setSubmitted(false);
              }}
              className="px-3 py-2 rounded-xl text-xs border border-slate-300 dark:border-slate-700"
            >
              {t('Choose image')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
