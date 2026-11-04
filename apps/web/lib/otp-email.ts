// apps/web/lib/otp-email.ts
// ============================================================================
// Real-time OTP delivery over SMTP with Nodemailer (Gmail service preset).
//
// Why Nodemailer + Gmail instead of a transactional provider API: providers such
// as Resend only deliver to arbitrary inboxes once you have verified a custom
// domain (SPF/DKIM). Gmail's SMTP relay needs no domain of your own, so any
// institutional address can be reached on a free plan. Everything else in the
// OTP flow — CSPRNG codes, HMAC digests in `verification_attempts`, the 5-minute
// TTL, single-use consumption — is provider-agnostic and unchanged.
//
//   • Transport is configured with `service: 'gmail'` and authenticated from
//     `process.env.GMAIL_USER` + `process.env.GMAIL_APP_PASSWORD` (server-only
//     env; neither may ever be exposed as `NEXT_PUBLIC_*`).
//   • `GMAIL_APP_PASSWORD` must be the 16-character app password from
//     https://myaccount.google.com/apppasswords (2-Step Verification on). A real
//     account password is rejected by Gmail — and must never be pasted here.
//   • Gmail only sends *as* the authenticated account, so `EMAIL_FROM_ADDRESS`
//     contributes the display name only (see `otpMailFrom()`).
//   • The code is rendered as a per-digit tile table (email clients collapse
//     `letter-spacing`, so tiles survive where a styled `<div>` would not).
//   • The plaintext code is never logged, and it is deliberately kept out of
//     the subject line — subject text is visible in lock-screen previews.
//   • Delivery failures are classified and returned to the caller so
//     `request-otp` can roll the challenge back; they are never swallowed, and
//     each one is written to the runtime log through lib/auth-log.ts (which
//     redacts the app password and any OTP-shaped digits) so a Vercel log
//     reader sees the SMTP reply code, not just "delivery failed".
//
// Gmail's own ceilings apply: ~500 recipients/day on a personal account (and a
// lower effective rate while the address is new). See §6 of
// docs/OTP_DIAGNOSIS.md for the escalation path.
// ============================================================================

import * as nodemailer from 'nodemailer';
import { OTP_TTL_SECONDS, redactEmail } from '@/lib/demo-otp';
import { authError, authLog, authLogTransportConfig, authWarn } from '@/lib/auth-log';

/**
 * Result of one delivery attempt. `messageId` is the SMTP Message-ID, stored on
 * `verification_attempts.email_message_id` so support can trace a message.
 */
export type OtpDeliveryResult =
  | { ok: true; provider: 'gmail'; messageId: string | null }
  | { ok: false; provider: 'gmail' | 'unconfigured'; error: string; retryable: boolean };

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

/** Positive-integer env reader, so a typo in Vercel cannot yield NaN. */
function envNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Milliseconds allowed for the SMTP handshake / greeting and for one send. */
const SMTP_CONNECT_TIMEOUT_MS = envNumber(process.env.SMTP_TIMEOUT_MS, 15000);
const SMTP_SOCKET_TIMEOUT_MS = envNumber(process.env.SMTP_SEND_TIMEOUT_MS, 20000);

const DEFAULT_FROM = `${BRAND.name} Verification <no-reply@campus360bd.com>`;

/**
 * Both values are required — a missing one means "this deployment cannot mail",
 * which is what puts Track B (demo codes) in play.
 */
export function gmailCredentials(): { user: string; pass: string } | null {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.trim();
  if (!user || !pass) return null;
  return { user, pass };
}

/** True when Gmail SMTP credentials are present. */
export function isSmtpConfigured(): boolean {
  return gmailCredentials() !== null;
}

/**
 * Pooling keeps SMTP sockets open between messages — the right trade-off for a
 * long-running (Docker) server, the wrong one for a serverless function that can
 * be frozen mid-command holding a half-used socket. So the default is a fresh
 * connection per message, and `SMTP_POOL=1` opts in for persistent deployments
 * (which also caches the transporter on the module).
 */
function smtpPoolingEnabled(): boolean {
  return /^(1|true|yes|on)$/i.test(String(process.env.SMTP_POOL ?? '').trim());
}

/**
 * The slice of a Nodemailer transporter this module needs. Structural on purpose:
 * it puts the pooled and unpooled overloads behind one return type and lets a
 * test inject a double without touching the network.
 */
export interface OtpMailer {
  sendMail(options: nodemailer.SendMailOptions): Promise<nodemailer.SentMessageInfo>;
}

let transportConfigLogged = false;

/**
 * One line per cold start saying how the transport was wired. `credentialsPresent`
 * is a boolean rather than the value, and `auth-log` drops any key that looks like
 * a secret — so this line is safe to leave in production logs permanently.
 */
function logTransportConfigOnce(creds: { user: string; pass: string }): void {
  if (transportConfigLogged) return;
  transportConfigLogged = true;
  authLogTransportConfig({
    service: 'gmail',
    user: creds.user,
    credentialsPresent: creds.pass.length > 0,
    pool: smtpPoolingEnabled(),
    connectionTimeoutMs: SMTP_CONNECT_TIMEOUT_MS,
    socketTimeoutMs: SMTP_SOCKET_TIMEOUT_MS,
    from: otpMailFrom(),
  });
}

export function createOtpMailer(): OtpMailer | null {
  const creds = gmailCredentials();
  if (!creds) return null;
  logTransportConfigOnce(creds);

  const base = {
    service: 'gmail',
    auth: { user: creds.user, pass: creds.pass },
    connectionTimeout: SMTP_CONNECT_TIMEOUT_MS,
    greetingTimeout: SMTP_CONNECT_TIMEOUT_MS,
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
  };

  if (smtpPoolingEnabled()) {
    return nodemailer.createTransport({
      ...base,
      pool: true,
      maxConnections: envNumber(process.env.SMTP_MAX_CONNECTIONS, 3),
      maxMessages: envNumber(process.env.SMTP_MAX_MESSAGES, 50),
    });
  }
  return nodemailer.createTransport(base);
}

let cachedMailer: OtpMailer | null = null;
let cachedMailerKey: string | null = null;

/** Cached pooled transporter in pooling mode; a fresh one per message otherwise. */
export function getOtpMailer(): OtpMailer | null {
  const creds = gmailCredentials();
  if (!creds) return null;
  if (!smtpPoolingEnabled()) return createOtpMailer();

  if (!cachedMailer || cachedMailerKey !== creds.user) {
    cachedMailer = createOtpMailer();
    cachedMailerKey = creds.user;
  }
  return cachedMailer;
}

/**
 * The `From` header. Gmail validates the sender against the authenticated
 * account, so a foreign address in `EMAIL_FROM_ADDRESS` would be refused by the
 * relay — keep its display name, substitute `GMAIL_USER` as the address.
 */
export function otpMailFrom(): string {
  const creds = gmailCredentials();
  const configured = process.env.EMAIL_FROM_ADDRESS?.trim();
  if (!creds) return configured || DEFAULT_FROM;

  const configuredAddress = configured?.match(/<\s*([^>]+?)\s*>/)?.[1] ?? configured;
  if (configuredAddress && configuredAddress.toLowerCase() !== creds.user.toLowerCase()) {
    console.warn(
      `[otp] EMAIL_FROM_ADDRESS "${configuredAddress}" is not GMAIL_USER — Gmail only sends as the authenticated account, so ${creds.user} is used instead.`
    );
  }
  const displayName = configured?.match(/^([^<]+)/)?.[1]?.trim() || `${BRAND.name} Verification`;
  return `${displayName} <${creds.user}>`;
}

/** Address-safe domain for the synthetic Message-ID. */
function refDomain(from: string): string {
  const raw = from.includes('@') ? from.slice(from.lastIndexOf('@') + 1) : 'gmail.com';
  return raw.replace(/[>"'\s)(]/g, '') || 'gmail.com';
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
 * Turn a Nodemailer/SMTP failure into something the API can act on:
 * `retryable: true` means "a fresh request may work", `false` means an operator
 * has to change something (credentials, quota, recipient policy).
 */
export function classifySmtpError(error: unknown): { message: string; retryable: boolean } {
  const err = (error ?? {}) as {
    message?: string;
    code?: string;
    response?: string;
    responseCode?: number | string;
  };
  const message = String(err.message ?? error ?? 'SMTP send failed.').trim();
  const code = String(err.code ?? '');
  const response = String(err.responseCode ?? '');
  // Gmail puts the useful text in the raw SMTP reply, so match on both sides.
  const haystack = `${message} ${String(err.response ?? '')}`;

  if (
    code === 'EAUTH' ||
    /^(530|534|535)/.test(response) ||
    /Username and Password not accepted|Invalid login/i.test(haystack)
  ) {
    return {
      message: 'Gmail rejected the SMTP credentials. Check GMAIL_USER and GMAIL_APP_PASSWORD (an app password is required).',
      retryable: false,
    };
  }
  if (/daily sending quota|too many recipients|rate limit exceeded|quota/i.test(haystack)) {
    return { message: 'The Gmail account hit its sending quota. Try again later.', retryable: false };
  }
  if (code === 'ECONNECTION' || code === 'ESOCKET' || code === 'ETIMEDOUT' || code === 'EHARDERROR') {
    return { message, retryable: true };
  }
  // 4xx = transient relay refusal, 5xx = hard rejection of this message.
  if (response.startsWith('4')) return { message, retryable: true };
  if (response.startsWith('5')) return { message, retryable: false };
  return { message, retryable: true };
}

/**
 * Send the OTP email over Gmail SMTP. Returns a structured result — the caller
 * decides whether to roll the challenge back, so a failed send can never leave a
 * live OTP that the user never received.
 */
export async function sendOtpEmail(
  input: OtpEmailInput & { idempotencyKey?: string }
): Promise<OtpDeliveryResult> {
  if (!isSmtpConfigured()) {
    authWarn('smtp.unconfigured', {
      reason: 'GMAIL_USER and/or GMAIL_APP_PASSWORD are absent from this runtime',
      to: redactEmail(input.to),
    });
    return {
      ok: false,
      provider: 'unconfigured',
      error: 'GMAIL_USER / GMAIL_APP_PASSWORD are not configured on this server.',
      retryable: false,
    };
  }

  const mailer = getOtpMailer();
  if (!mailer) {
    authError('smtp.transport-create-failed', new Error('createTransport returned no transporter for gmail'), {
      to: redactEmail(input.to),
    });
    return { ok: false, provider: 'unconfigured', error: 'The SMTP transport could not be created.', retryable: false };
  }

  const from = otpMailFrom();
  const domain = refDomain(from);
  // Derived from the challenge id: a retried request reuses the same Message-ID,
  // so mail clients recognise it as the same message instead of threading two
  // OTP emails together (SMTP itself has no idempotency key).
  const messageId = input.idempotencyKey
    ? `<otp-${input.idempotencyKey}@${domain}>`
    : `<otp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@${domain}>`;

  try {
    const info = await mailer.sendMail({
      from,
      to: input.to,
      subject: otpEmailSubject(input),
      html: buildOtpEmailHtml(input),
      text: buildOtpEmailText(input),
      messageId,
      headers: {
        'Auto-Submitted': 'auto-generated',
        'X-Entity-Ref-ID': messageId,
        'X-Complaints-To': domain,
      },
    });

    const rejected: unknown[] = Array.isArray(info?.rejected) ? info.rejected : [];
    if (rejected.length > 0) {
      // Gmail accepted the TCP session but refused this mailbox — usually a
      // disabled/forwarding address. Distinct from an auth or quota fault.
      authError('smtp.recipient-rejected', new Error(`rejected: ${rejected.map(String).join(', ')}`), {
        to: redactEmail(input.to),
        messageId,
        response: info?.response,
      });
      return {
        ok: false,
        provider: 'gmail',
        error: `Gmail refused the recipient address (${rejected.map(String).join(', ')}).`,
        retryable: false,
      };
    }

    authLog('smtp.sent', {
      to: redactEmail(input.to),
      messageId: info?.messageId ?? messageId,
      response: info?.response,
      acceptedCount: Array.isArray(info?.accepted) ? info.accepted.length : null,
    });
    return { ok: true, provider: 'gmail', messageId: info?.messageId ?? messageId };
  } catch (error) {
    const classified = classifySmtpError(error);
    // Full fault detail lives here, not in the API response: the caller only sees
    // `message` + `retryable`. Includes the SMTP reply code (535 vs 454 etc.),
    // which is what separates "fix the credentials" from "try again".
    authError('smtp.send-failed', error, {
      to: redactEmail(input.to),
      messageId,
      retryable: classified.retryable,
      classification: classified.message,
    });
    return { ok: false, provider: 'gmail', error: classified.message, retryable: classified.retryable };
  }
}
