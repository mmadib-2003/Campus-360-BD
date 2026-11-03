// apps/web/lib/rate-limit.ts
import { NextRequest } from 'next/server';

interface BucketEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, BucketEntry>();

export function checkRateLimit(
  req: NextRequest,
  scope: string,
  limit: number,
  windowSeconds: number,
  identifierOverride?: string
): { allowed: boolean; headers: Record<string, string> } {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1';
  const key = `${scope}:${identifierOverride ?? ip}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  const existing = memoryStore.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    memoryStore.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      headers: {
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': String(limit - 1),
        'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
      },
    };
  }

  existing.count += 1;
  const remaining = Math.max(0, limit - existing.count);
  const allowed = existing.count <= limit;

  return {
    allowed,
    headers: {
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': String(remaining),
      'X-RateLimit-Reset': String(Math.ceil(existing.resetAt / 1000)),
    },
  };
}
