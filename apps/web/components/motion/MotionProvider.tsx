// apps/web/components/motion/MotionProvider.tsx
'use client';

import React from 'react';
import { MotionConfig } from 'framer-motion';

/**
 * App-wide motion settings. `reducedMotion="user"` makes every transform /
 * opacity animation collapse to a fade (or nothing) when the visitor has asked
 * their operating system for less motion — the delight stays, the vestibular
 * cost does not.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
