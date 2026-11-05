import React from 'react';
import type { Viewport } from 'next';
import { headers, cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import en from '../messages/en.json';
import bn from '../messages/bn.json';
import { LOCALE_COOKIE, resolveLocale } from '@/i18n';
import { ThemeProvider } from '@/components/theme-provider';
import { AppShell } from '@/components/shell/AppShell';
import { SessionProvider } from '@/lib/modules/session';
import { MotionProvider } from '@/components/motion/MotionProvider';
import { sanitizeMessages } from '@/lib/messages';
import { SafeSection } from '@/components/SafeSection';
import './globals.css';

export const metadata = {
  metadataBase: new URL('https://campus-360-bd.vercel.app'),
  title: 'Campus360 BD — Multi-University Verified Super-App',
  description:
    'Verified academic archive, tracked grievance resolution, live campus events map, and student services across all public universities in Bangladesh.',
  // Official brand mark (user-supplied asset, docs/IMAGE_ATTRIBUTION.md):
  // browser-tab favicon, Apple touch icon and link-preview image.
  icons: { icon: '/logos/campus360-logo.jpg', apple: '/logos/campus360-logo.jpg' },
  openGraph: {
    title: 'Campus360 BD — Multi-University Verified Super-App',
    description:
      'Verified academic archive, tracked grievance resolution, live campus events map, and student services across all public universities in Bangladesh.',
    images: ['/logos/campus360-logo.jpg'],
  },
};

// Mobile-first viewport: device-width rendering, pinch-zoom still allowed
// (maximumScale 5 keeps accessibility), safe-area coverage for notched
// phones, and a theme color that matches the dark shell.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#020617',
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
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <NextIntlClientProvider locale={locale} messages={messages}>
            {/* The boundary sits inside the shell on purpose: a page that throws --
                a null embed, a JSONB array that arrived as a string -- used to take
                the header, the nav and every other section down with it. Now the
                module area degrades and the campus stays navigable. */}
            <MotionProvider>
              <SessionProvider>
                <AppShell profile={null}>
                  <SafeSection label="This page">{children}</SafeSection>
                </AppShell>
              </SessionProvider>
            </MotionProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
