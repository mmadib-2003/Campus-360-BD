// apps/web/components/motion/Stagger.tsx
'use client';

import React from 'react';
import { motion, type HTMLMotionProps, type Variants } from 'framer-motion';

/** Parent: fades in, then reveals children one after another. */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

/** Child: a small rise + fade. Used for cards, list rows and grid cells. */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
  },
};

type GroupProps = HTMLMotionProps<'div'> & { children: React.ReactNode };

export function StaggerGroup({ children, className, ...rest }: GroupProps) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

type ItemProps = HTMLMotionProps<'div'> & { children: React.ReactNode };

export function StaggerItem({ children, className, ...rest }: ItemProps) {
  return (
    <motion.div variants={staggerItem} className={className} {...rest}>
      {children}
    </motion.div>
  );
}

/** Shared hover lift for cards that are links. */
export const cardHover = {
  whileHover: { scale: 1.02, y: -3 },
  whileTap: { scale: 0.985 },
  transition: { type: 'spring' as const, stiffness: 320, damping: 24 },
};
