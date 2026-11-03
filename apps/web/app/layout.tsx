// apps/web/app/layout.tsx
import React from 'react';
import './globals.css';
import { AppShell } from '@/components/shell/AppShell';

export const metadata = {
  title: 'Campus360 BD — Multi-University Verified Super-App',
  description: 'Verified academic archive, tracked grievance resolution, live campus events map, and student services across all public universities in Bangladesh.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}