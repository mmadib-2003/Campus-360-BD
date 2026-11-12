'use client';

// apps/web/components/theme-provider.tsx
// shadcn/ui App Router theme provider (next-themes). attribute="class" so the
// .dark variable block in globals.css applies; the preference persists in
// localStorage ("theme") and is mirrored pre-paint by the inline bootstrap in
// app/layout.tsx. Dark is the default; the system preference is NOT consulted
// (enableSystem={false}) — the campus shell is designed dark-first and the
// toggle is the only way to light.

import * as React from 'react';
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from 'next-themes';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
