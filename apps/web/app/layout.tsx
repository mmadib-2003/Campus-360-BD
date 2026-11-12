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
// phones, and a theme color that matches the true-black shell.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#000000',
};

const MESSAGES = { en, bn } as const;

// TRUE DARK — parser-blocking bootstrap. Inlined as a plain <script> in
// <head> (never next/script beforeInteractive, which App Router defers past
// first paint; never useEffect, which flashes by definition). Runs before
// any stylesheet is parsed, pins .dark + color-scheme on <html>, and is
// idempotent — safe alongside the static className="dark" the server ships.
// Note: this product is dark-only by design (no light theme exists), so the
// script always resolves dark rather than re-deriving from localStorage /
// prefers-color-scheme.
const THEME_SCRIPT = `(function(){try{var d=document.documentElement;d.classList.remove('light');d.classList.add('dark');d.style.colorScheme='dark';}catch(e){}})();`;

// Painted even if globals.css is still loading (slow networks, cold cache):
// kills the white UA-default flash before the first stylesheet link.
const THEME_STYLE = 'html{background-color:#000;color-scheme:dark}body{background-color:#000}';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const headerStore = headers();
  const cookieStore = cookies();
  const host = headerStore.get('host');
  const locale = resolveLocale(host, cookieStore.get(LOCALE_COOKIE)?.value);
  const messages = sanitizeMessages(MESSAGES[locale] as { ui?: Record<string, string> });

  return (
    // TRUE DARK is forced: static class + inline color-scheme on <html> so the
    // very first paint (and any no-JS crawl of the page) is #000. next-themes
    // is pinned with forcedTheme below so a stored "light" preference can
    // never reintroduce the light theme.
    <html lang={locale} className="dark" style={{ colorScheme: 'dark' }} suppressHydrationWarning>
      <head>
        {/* 1. Theme bootstrap (synchronous) — before any stylesheet.
            2. Pre-CSS background — paints #000 even if globals.css is late. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <style dangerouslySetInnerHTML={{ __html: THEME_STYLE }} />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" enableSystem={false} disableTransitionOnChange>
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
