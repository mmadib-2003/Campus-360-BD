// apps/web/lib/demo-session-edge.ts
// Edge-Runtime-safe HMAC-SHA256 signing & verification for `campus360_demo_session`.
// Uses only Web Crypto (`globalThis.crypto.subtle`) so Next.js `middleware.ts`
// and Node.js Route Handlers verify the exact same token format.

export const DEMO_SESSION_COOKIE = 'campus360_demo_session';

export type SignedDemoRole = 'student' | 'faculty' | 'alumni' | 'admin' | 'governance';

export interface SignedDemoSessionPayload {
  id: string;
  email: string;
  role: SignedDemoRole;
  name: string;
  fullName: string;
  studentId: string;
  university_id: string;
  universityId: string;
  universityCode: string;
  department_id: string | null;
  departmentCode: string | null;
  hall_id?: string | null;
  hall_name?: string | null;
  program_session?: string | null;
  email_verified: true;
  is_demo: true;
  iat: number;
  exp: number;
}

export function isDemoEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return (
    normalized.endsWith('@demo.campus360.bd') ||
    normalized.endsWith('@demo.campus360.test')
  );
}

export function getDemoSessionSecret(): string {
  return (
    process.env.CSRF_SIGNING_SECRET?.trim() ||
    process.env.SUPABASE_JWT_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    'campus360-bd-demo-session-secret-v1'
  );
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(input: string): Uint8Array | null {
  try {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    if (typeof atob === 'function') {
      const binary = atob(padded);
      const out = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        out[i] = binary.charCodeAt(i);
      }
      return out;
    }
    return new Uint8Array(Buffer.from(padded, 'base64'));
  } catch {
    return null;
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function hmacBase64UrlEdge(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await globalThis.crypto.subtle.sign('HMAC', key, enc.encode(data));
  return bytesToBase64Url(new Uint8Array(sig));
}

export async function verifyDemoSessionTokenEdge(
  rawCookie: string | null | undefined
): Promise<SignedDemoSessionPayload | null> {
  if (!rawCookie) return null;
  const dot = rawCookie.indexOf('.');
  if (dot <= 0) return null;
  const payloadPart = rawCookie.slice(0, dot);
  const sigPart = rawCookie.slice(dot + 1);
  if (!payloadPart || !sigPart) return null;

  try {
    const expectedSig = await hmacBase64UrlEdge(payloadPart, getDemoSessionSecret());
    if (!constantTimeEqual(sigPart, expectedSig)) return null;

    const bytes = base64UrlToBytes(payloadPart);
    if (!bytes) return null;
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as Partial<SignedDemoSessionPayload>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.id || !parsed.email || !parsed.role) return null;
    if (typeof parsed.exp === 'number' && Date.now() > parsed.exp) return null;
    return parsed as SignedDemoSessionPayload;
  } catch {
    return null;
  }
}
