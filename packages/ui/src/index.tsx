// packages/ui/src/index.tsx
import React from 'react';

export function TrustBadge({ level }: { level: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300">
      ✓ {level}
    </span>
  );
}
