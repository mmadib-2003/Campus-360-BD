import React from 'react';
import { WelcomeView } from '@/components/welcome/WelcomeView';

/**
 * The Welcome screen is also reachable from inside the app ("Welcome /
 * Overview" in the sidebar and the mobile drawer) so any visitor can revisit
 * the platform overview without signing out.
 */
export default function WelcomePage() {
  return <WelcomeView />;
}
