'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/modules/session';
import { hasSeenWelcome, WELCOME_ROUTE } from '@/lib/welcome';
import { SkeletonGrid } from '@/components/modules/ui';

/**
 * Wraps the dashboard at `/`. The first time a visitor (or a newly signed-in
 * account) lands here, they are sent to /welcome once; after that the
 * dashboard renders as before. Nothing else about the home route changes.
 */
export function WelcomeGate({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (session.loading) return;
    if (hasSeenWelcome(session.authenticated ? session.email : null)) {
      setReady(true);
    } else {
      setReady(false);
      router.replace(WELCOME_ROUTE);
    }
  }, [session.loading, session.authenticated, session.email, router]);

  if (!ready) {
    return (
      <div aria-busy="true" className="py-4">
        <SkeletonGrid rows={6} />
      </div>
    );
  }
  return <>{children}</>;
}
