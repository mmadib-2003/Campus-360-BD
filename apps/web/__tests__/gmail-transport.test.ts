// apps/web/__tests__/gmail-transport.test.ts
// Wiring of the Nodemailer transport: Gmail service + app-password auth, the
// serverless-safe pooling default, the From-header rules, and what the message
// handed to SMTP actually contains. `nodemailer` is mocked, so nothing here
// touches the network and no real credentials are involved.
import { afterEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted so the mock factory (which is hoisted above module scope) can
// share the spy with the assertions below.
const { mockSendMail, mockTransportCalls } = vi.hoisted(() => ({
  mockSendMail: vi.fn(),
  mockTransportCalls: [] as Array<Record<string, unknown>>,
}));

vi.mock('nodemailer', () => ({
  createTransport: (options: Record<string, unknown>) => {
    mockTransportCalls.push(options);
    return { sendMail: mockSendMail };
  },
}));

const CREDENTIALS = {
  GMAIL_USER: 'campus360.test@gmail.com',
  GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop',
};

async function loadModule() {
  vi.resetModules();
  return import('../lib/otp-email');
}

function setEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

afterEach(() => {
  setEnv({
    GMAIL_USER: undefined,
    GMAIL_APP_PASSWORD: undefined,
    EMAIL_FROM_ADDRESS: undefined,
    SMTP_POOL: undefined,
  });
  mockTransportCalls.length = 0;
  mockSendMail.mockReset();
  vi.restoreAllMocks();
});

describe('gmail smtp transport', () => {
  it('reports "cannot mail" while either credential is missing', async () => {
    setEnv({ GMAIL_USER: CREDENTIALS.GMAIL_USER, GMAIL_APP_PASSWORD: undefined });
    const mod = await loadModule();
    expect(mod.isSmtpConfigured()).toBe(false);
    expect(mod.createOtpMailer()).toBeNull();

    const result = await mod.sendOtpEmail({ to: 'a@du.ac.bd', code: '123456', expiresAt: Date.now() + 300000 });
    expect(result.ok).toBe(false);
    expect(mockTransportCalls).toHaveLength(0);
  });

  it('configures service gmail with the app password, without pooling by default', async () => {
    setEnv(CREDENTIALS);
    const mod = await loadModule();
    expect(mod.isSmtpConfigured()).toBe(true);

    const mailer = mod.createOtpMailer();
    expect(mailer).not.toBeNull();
    expect(mockTransportCalls).toHaveLength(1);

    const options = mockTransportCalls[0];
    expect(options.service).toBe('gmail');
    expect(options.auth).toEqual({ user: 'campus360.test@gmail.com', pass: 'abcd efgh ijkl mnop' });
    // Serverless: no pooled sockets held across requests.
    expect(options.pool).toBeUndefined();
    expect(Number(options.connectionTimeout)).toBeGreaterThan(0);
    expect(Number(options.socketTimeout)).toBeGreaterThan(0);
  });

  it('enables a pooled, cached transport when SMTP_POOL=1', async () => {
    setEnv({ ...CREDENTIALS, SMTP_POOL: '1' });
    const mod = await loadModule();
    mod.createOtpMailer();

    expect(mockTransportCalls[0].pool).toBe(true);
    expect(Number(mockTransportCalls[0].maxConnections)).toBeGreaterThan(0);
  });

  it('sends the full OTP message and returns the Message-ID', async () => {
    setEnv(CREDENTIALS);
    mockSendMail.mockResolvedValue({ messageId: '<real-message-id@gmail.com>', rejected: [] });

    const mod = await loadModule();
    const result = await mod.sendOtpEmail({
      to: 'student.du@du.ac.bd',
      code: '482913',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      universityName: 'University of Dhaka',
      universityCode: 'DU',
      idempotencyKey: 'challenge-42',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe('gmail');
      expect(result.messageId).toBe('<real-message-id@gmail.com>');
    }

    const mail = mockSendMail.mock.calls[0][0] as Record<string, unknown>;
    expect(mail.to).toBe('student.du@du.ac.bd');
    // Gmail only sends as the authenticated account.
    expect(mail.from).toBe('Campus360 BD Verification <campus360.test@gmail.com>');
    expect(String(mail.subject)).not.toContain('482913');
    expect(String(mail.html)).toContain('University of Dhaka');
    expect(String(mail.html)).toContain('>4</td>');
    expect(String(mail.text)).toContain('482913');
    expect(mail.messageId).toBe('<otp-challenge-42@gmail.com>');
    expect((mail.headers as Record<string, string>)['Auto-Submitted']).toBe('auto-generated');
  });

  it('keeps the display name but never a foreign sender address', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setEnv({ ...CREDENTIALS, EMAIL_FROM_ADDRESS: 'Campus360 BD <no-reply@campus360bd.com>' });
    const mod = await loadModule();

    expect(mod.otpMailFrom()).toBe('Campus360 BD <campus360.test@gmail.com>');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('only sends as the authenticated account'));
  });

  it('maps SMTP failures onto the API contract', async () => {
    setEnv(CREDENTIALS);
    mockSendMail.mockRejectedValue(Object.assign(new Error('Invalid login: 535-5.7.8 Username and Password not accepted'), {
      code: 'EAUTH',
      responseCode: '535',
    }));

    const mod = await loadModule();
    const result = await mod.sendOtpEmail({
      to: 'student.du@du.ac.bd',
      code: '123456',
      expiresAt: new Date(Date.now() + 300000).toISOString(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.provider).toBe('gmail');
      expect(result.retryable).toBe(false);
      expect(result.error).toContain('GMAIL_APP_PASSWORD');
    }
  });

  it('treats a rejected recipient as a failed delivery', async () => {
    setEnv(CREDENTIALS);
    mockSendMail.mockResolvedValue({ messageId: '<x@gmail.com>', rejected: ['gone@du.ac.bd'] });

    const mod = await loadModule();
    const result = await mod.sendOtpEmail({
      to: 'gone@du.ac.bd',
      code: '123456',
      expiresAt: new Date(Date.now() + 300000).toISOString(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('gone@du.ac.bd');
  });
});
