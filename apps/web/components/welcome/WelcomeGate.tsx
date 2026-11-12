'use client';

// apps/web/components/welcome/WelcomeGate.tsx
// Root-entry gate: signed-in visitors land on the existing dashboard
// (HomeView, untouched); unauthenticated visitors and SSR crawlers receive the
// full Welcome experience immediately with server-supplied universities and
// zero client skeleton flash.

import React from 'react';
import { useSession } from '@/lib/modules/client';
import { HomeView } from '@/components/HomeView';
import { WelcomeView, type RegistryUniversity } from './WelcomeView';

export function WelcomeGate({
  initialUniversities,
}: {
  initialUniversities?: RegistryUniversity[];
}) {
  const session = useSession();
  return session.authenticated ? (
    <HomeView />
  ) : (
    <WelcomeView initialUniversities={initialUniversities} />
  );
}
