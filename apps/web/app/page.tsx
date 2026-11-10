import React from 'react';
import { HomeView } from '@/components/HomeView';
import { WelcomeGate } from '@/components/welcome/WelcomeGate';

export default function HomePage() {
  return (
    <WelcomeGate>
      <HomeView />
    </WelcomeGate>
  );
}
