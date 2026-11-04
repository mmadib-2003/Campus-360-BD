import { cookies } from 'next/headers';
import en from '../messages/en.json';
import bn from '../messages/bn.json';
import { LOCALE_COOKIE, resolveLocale } from '../i18n';
import { sanitizeMessages } from '../lib/messages';

/**
 * next-intl request configuration. The Next.js plugin aliases `next-intl/config`
 * to this module, so it must expose a default async function.
 */
export default async function requestConfig() {
  const cookieStore = cookies();
  const locale = resolveLocale(undefined, cookieStore.get(LOCALE_COOKIE)?.value);
  return {
    locale,
    messages: sanitizeMessages((locale === 'bn' ? bn : en) as { ui?: Record<string, string> }),
  };
}
