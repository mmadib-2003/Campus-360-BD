import React from 'react';
import type { Metadata } from 'next';
import { WelcomeView } from '@/components/welcome/WelcomeView';

export const metadata: Metadata = {
  title: 'Welcome — Campus360 BD',
  description:
    'One verified super-app for every public university campus in Bangladesh: 12 real-time modules, verified student access and a trusted campus network.',
};

export default function WelcomePage() {
  return <WelcomeView />;
}
