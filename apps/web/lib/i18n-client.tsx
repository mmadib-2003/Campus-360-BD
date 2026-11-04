'use client';

import { useCallback } from 'react';
import { useLocale, useMessages } from 'next-intl';
import { useRouter } from 'next/navigation';
import { LOCALE_COOKIE, type Locale } from '@/i18n';
import { normalizeUiKey } from '@/lib/messages';

type Vars = Record<string, string | number>;

/**
 * Single language layer for every client component.
 *
 * All visible copy resolves through `t()` against `messages/ui` (en.json /
 * bn.json). The toggle writes the NEXT_LOCALE cookie and asks the App Router
 * to re-render the whole tree on the server, so no component keeps a stale
 * language in local state.
 */
export function useUi() {
  const locale = useLocale() as Locale;
  const messages = useMessages() as Record<string, unknown>;
  const ui = (messages.ui ?? {}) as Record<string, string>;
  const router = useRouter();

  const t = useCallback(
    (key: string, vars?: Vars) => {
      let value = ui[normalizeUiKey(key)] ?? ui[key] ?? key;
      if (vars) {
        for (const [name, replacement] of Object.entries(vars)) {
          value = value.split(`{${name}}`).join(String(replacement));
        }
      }
      return value;
    },
    [ui]
  );

  const setLocale = useCallback(
    (next: Locale) => {
      if (typeof document !== 'undefined') {
        document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        document.documentElement.lang = next;
        window.dispatchEvent(new CustomEvent('campus360:locale', { detail: next }));
      }
      router.refresh();
    },
    [router]
  );

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'en' ? 'bn' : 'en');
  }, [locale, setLocale]);

  return { locale, t, setLocale, toggleLocale, messages };
}
