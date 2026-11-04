// apps/web/app/template.tsx
// Re-mounted on every navigation, which is exactly what a page transition
// needs. The motion itself lives in a tiny client component so this file can
// stay a server component.
import React from 'react';
import { PageTransition } from '@/components/motion/PageTransition';

export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
