import React from 'react';
import { WelcomeGate } from '@/components/welcome/WelcomeGate';
import { loadWelcomeUniversities } from '@/lib/welcome-registry';

export default async function HomePage() {
  const initialUniversities = await loadWelcomeUniversities();
  return <WelcomeGate initialUniversities={initialUniversities} />;
}
