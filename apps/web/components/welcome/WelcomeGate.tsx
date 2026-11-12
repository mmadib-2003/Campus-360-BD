'use client';

// apps/web/components/welcome/WelcomeGate.tsx
// Root-entry gate: signed-in visitors land on the existing dashboard
// (HomeView, untouched); everyone else gets the one-page Welcome experience.
// While the session resolves, a neutral skeleton avoids flashing either view.

import React from 'react';
import { useSession } from '@/lib/modules/client';
import { HomeView } from '@/components/HomeView';
import { WelcomeView } from './WelcomeView';

export function WelcomeGate() {
  const session = useSession();

  if (session.loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading">
        <div className="h-44 rounded-2xl bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-28 rounded-2xl bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return session.authenticated ? <HomeView /> : <WelcomeView />;
}
