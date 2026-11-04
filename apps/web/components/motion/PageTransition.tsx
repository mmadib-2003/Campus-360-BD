// apps/web/components/motion/PageTransition.tsx
'use client';

import React from 'react';
import { motion } from 'framer-motion';

/**
 * Wraps every route (via app/template.tsx) in a short fade-and-rise. The
 * template remounts on navigation, so this is the cheapest possible page
 * transition: no layout shift, no scroll jump, no extra provider.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
