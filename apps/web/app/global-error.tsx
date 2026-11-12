// apps/web/app/global-error.tsx
// ============================================================================
// Last line of defence: it renders <html>/<body> itself because a root-layout
// failure means there is no shell left to render into. This is what stops a
// broken AppShell (the profile chips read `profile.halls.name`,
// `profile.universities.code` -- both NULL-able embeds) from taking the whole
// deployment down with it.
// ============================================================================

'use client';

import React from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#000000' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: 520,
              width: '100%',
              background: '#ffffff',
              borderRadius: 16,
              padding: '32px 28px',
              textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0,0,0,.35)',
            }}
          >
            <div style={{ fontSize: 28 }} aria-hidden>
              🎓
            </div>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: '10px 0 4px' }}>Campus360 hit an unexpected error</h1>
            <p style={{ fontSize: 13, color: '#475569', margin: '0 0 14px' }}>
              অ্যাপটি সাময়িকভাবে ঠিকমতো চলছে না। পেজটি রিলোড করলেই সাধারণত ঠিক হয়ে যায়।
            </p>
            <p
              style={{
                fontSize: 11,
                color: '#94a3b8',
                fontFamily: 'ui-monospace, monospace',
                wordBreak: 'break-word',
                margin: '0 0 16px',
              }}
            >
              {error?.digest || error?.message || 'unknown error'}
            </p>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                background: '#059669',
                color: '#fff',
                border: 0,
                borderRadius: 12,
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reload / রিলোড করুন
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
