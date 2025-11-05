/**
 * TypingIndicator - Indicateur de frappe/streaming moderne
 *
 * ✨ UX MODERNE: Animation fluide 3 points avec pulse effect
 */

import { type ReactElement } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface TypingIndicatorProps {
  className?: string;
}

// 🎨 Animation des points - Effet wave professionnel
const dotVariants = {
  initial: { y: 0, scale: 1, opacity: 0.6 },
  animate: {
    y: [-4, 0, -4],
    scale: [1, 1.2, 1],
    opacity: [0.6, 1, 0.6]
  }
};

const dotTransition = {
  duration: 1.4,
  repeat: Infinity,
  ease: 'easeInOut' as const
};

export function TypingIndicator({ className }: TypingIndicatorProps): ReactElement {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 py-2',
        className
      )}
      role="status"
      aria-label="L'assistant est en train d'écrire"
    >
      {[0, 1, 2].map((index) => (
        <motion.div
          key={index}
          className="w-2 h-2 rounded-full bg-assistant/70"
          variants={dotVariants}
          initial="initial"
          animate="animate"
          transition={{
            ...dotTransition,
            delay: index * 0.2 // Délai progressif pour effet wave
          }}
        />
      ))}
    </div>
  );
}
