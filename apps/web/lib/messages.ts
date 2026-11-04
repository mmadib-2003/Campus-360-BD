import type { Locale } from '@/i18n';

type MessageTree = Record<string, unknown>;

/**
 * next-intl reserves "." for nesting, so flat UI keys that contain a period
 * (for example a full sentence used as a key) must be normalised before the
 * provider sees them.
 */
export function normalizeUiKey(key: string): string {
  return key.replace(/\./g, '_');
}

export function sanitizeMessages<T extends { ui?: Record<string, string> }>(messages: T): T {
  const ui = messages.ui ?? {};
  const normalized = Object.fromEntries(
    Object.entries(ui).map(([key, value]) => [normalizeUiKey(key), value])
  );
  return { ...messages, ui: normalized };
}

export function getMessagesForLocale(locale: Locale, en: unknown, bn: unknown) {
  return sanitizeMessages((locale === 'bn' ? bn : en) as { ui?: Record<string, string> });
}
