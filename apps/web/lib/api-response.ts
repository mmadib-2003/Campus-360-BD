// apps/web/lib/api-response.ts
import { NextResponse } from 'next/server';

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message_en: string;
    message_bn: string;
    details?: unknown;
  };
  meta?: Record<string, unknown>;
}

export function apiSuccess<T>(
  data: T,
  status = 200,
  meta?: Record<string, unknown>,
  rateLimitHeaders?: Record<string, string>
) {
  return NextResponse.json<ApiEnvelope<T>>(
    { success: true, data, meta },
    { status, headers: rateLimitHeaders }
  );
}

export function apiError(
  code: string,
  message_en: string,
  message_bn: string,
  status = 400,
  details?: unknown,
  rateLimitHeaders?: Record<string, string>
) {
  return NextResponse.json<ApiEnvelope<never>>(
    {
      success: false,
      error: { code, message_en, message_bn, details },
    },
    { status, headers: rateLimitHeaders }
  );
}
