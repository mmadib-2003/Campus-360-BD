import React from 'react';
import { WelcomeView } from '@/components/welcome/WelcomeView';
import { loadWelcomeUniversities } from '@/lib/welcome-registry';

/**
 * The Welcome screen is also reachable from inside the app ("Welcome /
 * Overview" in the sidebar and the mobile drawer) so any visitor can revisit
 * the platform overview without signing out, rendered standalone without
 * duplicate shell chrome.
 */
export default async function WelcomePage() {
  const initialUniversities = await loadWelcomeUniversities();
  return <WelcomeView initialUniversities={initialUniversities} />;
}
