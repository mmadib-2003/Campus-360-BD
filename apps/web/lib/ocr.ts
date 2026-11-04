// apps/web/lib/ocr.ts
/**
 * Client-side student-ID OCR.
 *
 * Tesseract.js runs entirely in the browser (the image never leaves the
 * device). We extract the ID number and name, then compare them with the
 * values entered during signup. Confidence below 80% is never auto-rejected:
 * the account is flagged for manual review instead.
 */

export interface OcrResult {
  idNumber: string | null;
  name: string | null;
  confidence: number;
  raw: string;
}

const ID_PATTERNS: RegExp[] = [
  // DU style: DU-2019-1-2-3-456
  /\b([A-Z]{2,6})[-\s]?(\d{4})[-\s]?(\d{1,2})[-\s]?(\d{1,2})[-\s]?(\d{1,2})[-\s]?(\d{3,6})\b/,
  // JU style: JU-2026-12345
  /\b([A-Z]{2,6})[-\s]?(\d{4})[-\s]?(\d{2,6})\b/,
  // BUET style: BUET-2019-1-001
  /\b([A-Z]{2,6})[-\s]?(\d{4})[-\s]?(\d{1,2})[-\s]?(\d{2,6})\b/,
  /\b([A-Z]{2,6})[-\s]?(\d{2,6})\b/,
];

export function normalizeStudentId(value: string | null | undefined): string {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function extractStudentId(raw: string): string | null {
  const text = String(raw ?? '').toUpperCase();
  for (const pattern of ID_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const compact = match[0].replace(/\s+/g, '-');
      if (/\d{4,}/.test(compact)) return compact;
    }
  }
  return null;
}

export function extractName(raw: string): string | null {
  const lines = String(raw ?? '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines) {
    const labelled = line.match(/(?:NAME|STUDENT NAME)\s*[:\-]\s*(.+)/i);
    if (labelled?.[1]) return labelled[1].trim();
  }
  const candidate = lines.find(
    (line) => /^[A-Za-z][A-Za-z.'\s]{3,60}$/.test(line) && !/UNIVERSITY|COLLEGE|ID CARD|STUDENT|GOVERNMENT|BANGLADESH/i.test(line)
  );
  return candidate?.trim() ?? null;
}

export function studentIdMatches(extracted: string | null, entered: string): boolean {
  if (!extracted) return false;
  const a = normalizeStudentId(extracted);
  const b = normalizeStudentId(entered);
  if (!a || !b) return false;
  if (a === b) return true;
  const digitsA = a.replace(/^[A-Z]+/, '');
  const digitsB = b.replace(/^[A-Z]+/, '');
  return digitsA.length >= 4 && digitsA === digitsB;
}

export function verificationStatus(confidence: number, matches: boolean): 'VERIFIED' | 'MANUAL_REVIEW' {
  return matches && confidence >= 80 ? 'VERIFIED' : 'MANUAL_REVIEW';
}

export async function recognizeStudentId(file: File | Blob): Promise<OcrResult> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    logger: () => undefined,
  });
  try {
    const { data } = await worker.recognize(file);
    const raw = String(data?.text ?? '');
    return {
      idNumber: extractStudentId(raw),
      name: extractName(raw),
      confidence: Math.round(Number(data?.confidence ?? 0)),
      raw,
    };
  } finally {
    await worker.terminate();
  }
}

/**
 * Draws a realistic Bangladeshi student ID card on a canvas so the OCR flow
 * can be demonstrated without uploading a personal document.
 */
export async function makeSampleIdCard(studentId: string, fullName: string, universityCode: string): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 620;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#065f46';
  ctx.fillRect(0, 0, canvas.width, 120);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px Arial, sans-serif';
  ctx.fillText(`${universityCode} — STUDENT ID CARD`, 40, 58);
  ctx.font = '22px Arial, sans-serif';
  ctx.fillText('Government of Bangladesh • Public University', 40, 94);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 26px Arial, sans-serif';
  ctx.fillText('Name:', 60, 200);
  ctx.font = '30px Arial, sans-serif';
  ctx.fillText(fullName || 'Nusrat Jahan', 190, 200);

  ctx.font = 'bold 26px Arial, sans-serif';
  ctx.fillText('Student ID:', 60, 270);
  ctx.font = '30px Arial, sans-serif';
  ctx.fillText(studentId || 'JU-2026-12345', 250, 270);

  ctx.font = 'bold 26px Arial, sans-serif';
  ctx.fillText('Department:', 60, 340);
  ctx.font = '30px Arial, sans-serif';
  ctx.fillText('Computer Science and Engineering', 250, 340);

  ctx.font = 'bold 26px Arial, sans-serif';
  ctx.fillText('Batch:', 60, 410);
  ctx.font = '30px Arial, sans-serif';
  ctx.fillText('2025-26', 250, 410);

  ctx.font = '22px Arial, sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText('This card is the property of the university. If found, please return to the Registrar office.', 60, 500);
  ctx.fillText('Valid for the 2025-26 academic session.', 60, 536);

  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3;
  ctx.strokeRect(40, 150, 920, 410);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not render the sample ID card');
  return new File([blob], `sample-${universityCode}-id.png`, { type: 'image/png' });
}
