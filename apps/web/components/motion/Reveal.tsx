'use client';

// apps/web/components/motion/Reveal.tsx
// Scroll-triggered section reveal (framer-motion whileInView). Wrap any
// section in <Reveal> to fade + rise it as it enters the viewport, once.
// Reduced-motion visitors get a plain fade via the app-wide MotionConfig.

import React from 'react';
import { motion } from 'framer-motion';

export function Reveal({
  children,
  className,
  delay = 0,
  y = 28,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  // whileInView needs IntersectionObserver; without it (bare test renderers)
  // fall back to a mount animation so content is never stuck invisible.
  const canObserve =
    typeof window !== 'undefined' && typeof (window as { IntersectionObserver?: unknown }).IntersectionObserver !== 'undefined';

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      {...(canObserve
        ? { whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.2 as const } }
        : { animate: { opacity: 1, y: 0 } })}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
