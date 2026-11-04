import React from 'react';
import { headers, cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import en from '../messages/en.json';
import bn from '../messages/bn.json';
import { LOCALE_COOKIE, resolveLocale } from '@/i18n';
import { AppShell } from '@/components/shell/AppShell';
import { sanitizeMessages } from '@/lib/messages';
import './globals.css';

export const metadata = {
  title: 'Campus360 BD — Multi-University Verified Super-App',
  description:
    'Verified academic archive, tracked grievance resolution, live campus events map, and student services across all public universities in Bangladesh.',
};

const MESSAGES = { en, bn } as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const headerStore = headers();
  const cookieStore = cookies();
  const host = headerStore.get('host');
  const locale = resolveLocale(host, cookieStore.get(LOCALE_COOKIE)?.value);
  const messages = sanitizeMessages(MESSAGES[locale] as { ui?: Record<string, string> });

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AppShell profile={null}>{children}</AppShell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
