'use client';

// apps/web/components/theme-provider.tsx
// shadcn/ui App Router dark-mode provider (next-themes). Wraps app/layout.tsx
// with attribute="class" so the .dark CSS variable block in globals.css applies,
// and persists the preference in localStorage across sessions.

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
