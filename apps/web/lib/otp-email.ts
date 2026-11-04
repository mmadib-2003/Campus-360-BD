// apps/web/lib/otp-email.ts
// ============================================================================
// Real-time OTP delivery through the Resend API (`resend` npm SDK).
//
//   • Client is built from `process.env.RESEND_API_KEY` (server-only — the key
//     must never appear in a `NEXT_PUBLIC_*` variable or in the bundle).
//   • Sender comes from `EMAIL_FROM_ADDRESS` and must live on a Resend-verified
//     domain (SPF/DKIM) or delivery is rejected / lands in spam.
//   • The code is rendered as a per-digit tile table (email clients collapse
//     `letter-spacing`, so tiles survive where a styled `<div>` would not).
//   • The plaintext code is never logged, and it is deliberately kept out of
//     the subject line — subject text is visible in lock-screen previews.
//   • Delivery failures are returned to the caller so `request-otp` can roll
//     the challenge back; they are never swallowed silently.
// ============================================================================

import { Resend } from 'resend';
import { OTP_TTL_SECONDS } from '@/lib/demo-otp';

export type OtpDeliveryResult =
  | { ok: true; provider: 'resend'; emailId: string | null }
  | { ok: false; provider: 'resend' | 'unconfigured'; error: string; retryable: boolean };

const BRAND = {
  name: 'Campus360 BD',
  nameBn: 'ক্যাম্পাস ৩৬০ বিডি',
  tagline: 'Multi-University Verified Super-App · Bangladesh',
  accent: '#059669',
  accentDark: '#065f46',
  tint: '#ecfdf5',
  border: '#e2e8f0',
  ink: '#0f172a',
  muted: '#64748b',
} as const;

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? 'support@campus360bd.com';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://campus360bd.com';

let cachedClient: Resend | null = null;
let cachedKey: string | null = null;

/** True when a Resend API key is present — the switch that promotes Track B
 *  (demo) traffic onto real email delivery. */
export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/** Lazily constructed, process-scoped Resend client. */
export function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new Resend(apiKey);
    cachedKey = apiKey;
  }
  return cachedClient;
}

export function otpFromAddress(): string {
  return (
    process.env.EMAIL_FROM_ADDRESS?.trim() ||
    process.env.RESEND_FROM_EMAIL?.trim() ||
    `${BRAND.name} Verification <no-reply@campus360bd.com>`
  );
}

export interface OtpEmailInput {
  /** Verified university address the code is going to. */
  to: string;
  code: string;
  /** Absolute ISO/epoch expiry used for the human deadline in the email. */
  expiresAt: string | number;
  ttlSeconds?: number;
  fullName?: string | null;
  universityName?: string | null;
  universityCode?: string | null;
}

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

/** Digits rendered the way Bengali prose reads them (5 → ৫). */
function toBnDigits(value: number | string): string {
  return String(value)
    .split('')
    .map((char) => (/\d/.test(char) ? BN_DIGITS[Number(char)] : char))
    .join('');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** "11:42 PM, 04 Nov 2026" in Bangladesh Standard Time (UTC+6). */
function formatDhakaTime(at: string | number): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Dhaka',
      hour: 'numeric',
      minute: '2-digit',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour12: true,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

function minutesOf(ttlSeconds: number): number {
  return Math.max(1, Math.round(ttlSeconds / 60));
}

/** Six one-digit tiles — the layout that survives Outlook/Gmail sanitising. */
function codeTiles(code: string): string {
  return [...code]
    .map(
      (digit) =>
        `<td align="center" style="padding:0 4px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
            <tr>
              <td
                width="44"
                height="56"
                align="center"
                valign="middle"
                bgcolor="${BRAND.tint}"
                style="width:44px;height:56px;line-height:56px;font-family:'SF Mono',ui-monospace,Menlo,Consolas,monospace;font-size:26px;font-weight:700;color:${BRAND.accentDark};background:${BRAND.tint};border:1px solid #a7f3d0;border-radius:10px;"
              >${escapeHtml(digit)}</td>
            </tr>
          </table>
        </td>`
    )
    .join('');
}

/**
 * Professional HTML body: 600px card, brand header, code tiles, deadline,
 * anti-phishing guidance and a bilingual (en/bn) footer. Inline styles only,
 * table-based, with a small dark-mode block for supporting clients.
 */
export function buildOtpEmailHtml(input: OtpEmailInput): string {
  const ttl = input.ttlSeconds ?? OTP_TTL_SECONDS;
  const minutes = minutesOf(ttl);
  const deadline = formatDhakaTime(input.expiresAt);
  const firstName = (input.fullName ?? '').trim().split(/\s+/)[0] ?? '';
  const university = (input.universityName ?? '').trim();
  const universityCode = (input.universityCode ?? '').trim();
  const code = escapeHtml(input.code);
  const appUrl = escapeHtml(APP_URL);
  const preheader = `Your ${BRAND.name} verification code is ${input.code}. It expires in ${minutes} minutes.`;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${BRAND.name} — email verification code</title>
  <style>
    a { color: ${BRAND.accent}; text-decoration: none; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
    u + #body a { color: inherit; text-decoration: none; }
    @media only screen and (max-width: 620px) {
      .c360-card { width: 100% !important; border-radius: 0 !important; }
      .c360-pad { padding: 20px 16px !important; }
      .c360-tile { width: 38px !important; min-width: 38px !important; height: 48px !important; line-height: 48px !important; font-size: 22px !important; }
      .c360-code { font-size: 30px !important; }
    }
    @media (prefers-color-scheme: dark) {
      body, .c360-body { background: #0b1220 !important; }
      .c360-card { background: #111827 !important; border-color: #1f2937 !important; }
      .c360-ink { color: #f1f5f9 !important; }
      .c360-muted { color: #94a3b8 !important; }
      .c360-note { background: #0f1a2b !important; border-color: #1f2f45 !important; }
    }
  </style>
</head>
<body id="body" class="c360-body" style="margin:0;padding:0;width:100%;background:#f1f5f9;-webkit-text-size-adjust:100%;">
  <!-- Preheader (hidden preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f1f5f9;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table
          role="presentation"
          cellpadding="0"
          cellspacing="0"
          border="0"
          width="600"
          class="c360-card"
          style="width:600px;max-width:600px;background:#ffffff;border:1px solid ${BRAND.border};border-radius:18px;overflow:hidden;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;"
        >
          <!-- Brand header -->
          <tr>
            <td class="c360-pad" style="padding:24px 32px;background:linear-gradient(135deg,${BRAND.accent} 0%,#0d9488 100%);">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="left" valign="middle" style="color:#ffffff;font-size:17px;font-weight:700;letter-spacing:.2px;">
                    <span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.35);border-radius:8px;font-size:12px;font-weight:800;vertical-align:middle;margin-right:10px;">C3</span>
                    <span style="vertical-align:middle;">${BRAND.name}</span>
                  </td>
                  <td align="right" valign="middle" style="color:#e7fff6;font-size:11px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;">
                    ${universityCode ? escapeHtml(universityCode) : 'Email Verification'}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td class="c360-pad c360-ink" style="padding:32px;color:${BRAND.ink};font-size:15px;line-height:1.6;">
              <h1 style="margin:0 0 6px;font-size:21px;line-height:1.3;font-weight:700;color:${BRAND.ink};">
                ${firstName ? `Hi ${escapeHtml(firstName)},` : 'Verify your university email'}
              </h1>
              <p style="margin:0 0 4px;color:${BRAND.muted};font-size:13px;">
                ${university
                  ? `Enter this code on <strong style="color:${BRAND.ink};">${escapeHtml(university)}</strong> to continue.`
                  : 'Enter this code in the Campus360 BD app to continue.'}
              </p>
              <p style="margin:6px 0 0;color:${BRAND.muted};font-size:13px;direction:ltr;">
                অনুগ্রহ করে নিচের ৬-সংখ্যার কোডটি লিখুন — এটি ${toBnDigits(minutes)} মিনিট পর্যন্ত কার্যকর।
              </p>

              <!-- Code tiles -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:24px auto 8px;">
                <tr>${codeTiles(code)}</tr>
              </table>
              <div class="c360-code" style="text-align:center;font-family:'SF Mono',ui-monospace,Menlo,Consolas,monospace;font-size:13px;color:${BRAND.muted};margin-bottom:22px;letter-spacing:0;">
                Code: ${code}
              </div>

              <!-- Deadline strip -->
              <table
                role="presentation"
                cellpadding="0"
                cellspacing="0"
                border="0"
                width="100%"
                class="c360-note"
                style="background:${BRAND.tint};border:1px solid #a7f3d0;border-radius:12px;"
              >
                <tr>
                  <td style="padding:14px 16px;font-size:13px;color:${BRAND.accentDark};line-height:1.55;">
                    <strong>⏱ Expires in ${minutes} minutes</strong>${deadline ? ` — ${escapeHtml(deadline)} (BST, UTC+6)` : ''}.
                    After that the code stops working and you will need to request a new one.
                  </td>
                </tr>
              </table>

              <!-- Security notes -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:22px;">
                <tr>
                  <td style="font-size:13px;color:${BRAND.muted};line-height:1.7;">
                    <strong style="color:${BRAND.ink};font-size:13px;">Keep this code private.</strong>
                    <ul style="margin:8px 0 0;padding-left:18px;">
                      <li style="margin-bottom:6px;">Campus360 BD staff will never ask for this code by phone, SMS, or social media.</li>
                      <li style="margin-bottom:6px;">Do not forward this email or share a screenshot of it.</li>
                      <li>Did not request it? You can safely ignore this email — no account is created until the code is verified.</li>
                    </ul>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:26px;">
                <tr>
                  <td align="center">
                    <a
                      href="${appUrl}/signin"
                      style="display:inline-block;padding:12px 26px;background:${BRAND.accent};color:#ffffff;font-size:14px;font-weight:600;border-radius:12px;text-decoration:none;"
                    >Open Campus360 BD</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="c360-pad c360-muted" style="padding:18px 32px;border-top:1px solid ${BRAND.border};background:#f8fafc;font-size:11px;line-height:1.6;color:${BRAND.muted};">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="left" style="color:${BRAND.muted};">
                    ${BRAND.name} — ${BRAND.tagline}<br />
                    <span style="direction:ltr;">${BRAND.nameBn}</span>
                  </td>
                  <td align="right" style="color:${BRAND.muted};">
                    Automated message — please do not reply.<br />
                    <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}" style="color:${BRAND.accent};">${escapeHtml(SUPPORT_EMAIL)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;">
          <tr>
            <td align="center" style="padding:14px 8px 0;font-size:10px;color:#94a3b8;line-height:1.6;">
              Requested from the Campus360 BD verification flow for ${escapeHtml(input.to)}.
              This message contains a one-time code and must not be shared.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Plain-text alternative part (also what screen readers / basic clients get). */
export function buildOtpEmailText(input: OtpEmailInput): string {
  const minutes = minutesOf(input.ttlSeconds ?? OTP_TTL_SECONDS);
  const deadline = formatDhakaTime(input.expiresAt);
  const university = (input.universityName ?? '').trim();
  const firstName = (input.fullName ?? '').trim().split(/\s+/)[0] ?? '';

  return [
    `${BRAND.name} — email verification`,
    '',
    firstName ? `Hi ${firstName},` : 'Verify your university email.',
    university ? `Requested for ${university}.` : null,
    `Your one-time 6-digit code is: ${input.code}`,
    `It expires in ${minutes} minutes${deadline ? ` (${deadline}, BST/UTC+6)` : ''}.`,
    `আপনার ৬-সংখ্যার ওটিপি কোড: ${input.code} (মেয়াদ ${toBnDigits(minutes)} মিনিট)`,
    '',
    'Enter it on the verification screen. The code is single-use.',
    'Campus360 BD staff will never ask you for this code.',
    'Did not request it? Ignore this email — nothing is created until it is verified.',
    '',
    `${APP_URL}`,
    `Support: ${SUPPORT_EMAIL}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function otpEmailSubject(input: OtpEmailInput): string {
  const minutes = minutesOf(input.ttlSeconds ?? OTP_TTL_SECONDS);
  const university = (input.universityCode ?? input.universityName ?? '').trim();
  const prefix = university ? `${BRAND.name} · ${university} — ` : `${BRAND.name} — `;
  // No code in the subject: it is visible in lock-screen/inbox previews.
  return `${prefix}Your ${minutes}-minute verification code / আপনার যাচাইকরণ কোড`;
}

/**
 * Send the OTP email. Returns a structured result — the caller decides whether
 * to roll the challenge back, so a failed send can never leave a live OTP that
 * the user never received.
 */
export async function sendOtpEmail(
  input: OtpEmailInput & { idempotencyKey?: string }
): Promise<OtpDeliveryResult> {
  const client = getResendClient();
  if (!client) {
    return {
      ok: false,
      provider: 'unconfigured',
      error: 'RESEND_API_KEY is not configured on this server.',
      retryable: false,
    };
  }

  const from = otpFromAddress();
  // Unique per message so Gmail never threads two OTP emails together.
  const nonce = globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Date.now().toString(36);
  const refDomain = (from.split('@')[1] ?? 'campus360bd.com').replace(/[>"]/g, '');

  const payload = {
    from,
    to: [input.to],
    subject: otpEmailSubject(input),
    html: buildOtpEmailHtml(input),
    text: buildOtpEmailText(input),
    tags: [{ name: 'category', value: 'auth-otp' }],
    headers: {
      'Auto-Submitted': 'auto-generated',
      'X-Entity-Ref-ID': `<otp-${nonce}@${refDomain}>`,
      'X-Complaints-To': APP_URL.replace(/^https?:\/\//, ''),
    },
  };

  try {
    const result = await client.emails.create(
      payload,
      input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined
    );

    if (result.error || !result.data) {
      const statusCode = result.error?.statusCode ?? null;
      return {
        ok: false,
        provider: 'resend',
        error: result.error?.message ?? 'Resend rejected the send request.',
        // Quota/rate/5xx are worth another attempt; auth and domain errors are not.
        retryable: statusCode === null || statusCode === 429 || statusCode >= 500,
      };
    }

    return { ok: true, provider: 'resend', emailId: result.data.id ?? null };
  } catch (error) {
    return {
      ok: false,
      provider: 'resend',
      error: error instanceof Error ? error.message : 'Resend request failed.',
      retryable: true,
    };
  }
}
