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

// Parser-blocking theme bootstrap. Inlined as a plain <script> in <head>
// (never next/script beforeInteractive, which App Router defers past first
// paint; never useEffect, which flashes by definition). Resolves the stored
// theme BEFORE first paint — next-themes' own injected script reconciles
// again at the top of <body>, but this head script guarantees the very first
// paint is never the wrong color. Mirrors next-themes: localStorage key
// "theme", default dark, system preference not consulted (the provider sets
// enableSystem={false}). Idempotent alongside the static className="dark".
const THEME_SCRIPT = `(function(){try{var t=null;try{t=window.localStorage.getItem('theme')}catch(e){}var light=(t==='light');var d=document.documentElement;d.classList.remove(light?'dark':'light');d.classList.add(light?'light':'dark');d.style.colorScheme=light?'light':'dark';}catch(e){}})();`;

// Pre-CSS background with !important so a late-loading external stylesheet
// can never win the cascade. Theme-aware (the inverse of the old hard-coded
// #000 rule, which would have made the light theme unswitchable): dark is
// the default, white paints only when the bootstrap above resolved .light.
const THEME_STYLE = `html, body { margin: 0; padding: 0; }
html:not(.light), html:not(.light) body { background-color: #000000 !important; color-scheme: dark !important; }
html.light, html.light body { background-color: #ffffff !important; color-scheme: light !important; }`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const headerStore = headers();
  const cookieStore = cookies();
  const host = headerStore.get('host');
  const locale = resolveLocale(host, cookieStore.get(LOCALE_COOKIE)?.value);
  const messages = sanitizeMessages(MESSAGES[locale] as { ui?: Record<string, string> });

  return (
    // Static dark class + suppressHydrationWarning: the head bootstrap and
    // next-themes both mutate this element's class before/at hydration —
    // suppressHydrationWarning is the officially supported escape hatch.
    <html lang={locale} className="dark" style={{ colorScheme: 'dark' }} suppressHydrationWarning>
      <head>
        {/* Pre-CSS background (theme-aware, !important) — wins the cascade
            against any late-loading external stylesheet. */}
        <style dangerouslySetInnerHTML={{ __html: THEME_STYLE }} />
        {/* Theme bootstrap (synchronous, resolves stored theme before paint). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
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
