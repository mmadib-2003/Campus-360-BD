export const locales = ['en', 'bn'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';
export const LOCALE_COOKIE = 'NEXT_LOCALE';

/**
 * Locale resolution order:
 *   1. explicit NEXT_LOCALE cookie (the toggle writes this)
 *   2. .bd hostnames default to Bangla
 *   3. English for every other host
 */
export function resolveLocale(host: string | null | undefined, cookieValue?: string | null): Locale {
  if (cookieValue === 'bn' || cookieValue === 'en') return cookieValue;
  const normalized = (host ?? '').toLowerCase();
  if (normalized.endsWith('.bd') || normalized.includes('.bd:') || normalized === 'bd') return 'bn';
  return defaultLocale;
}

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'en' || value === 'bn';
}
