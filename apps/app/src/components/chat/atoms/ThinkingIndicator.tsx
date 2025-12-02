/**
 * ThinkingIndicator - Indicateur "IA réfléchit"
 *
 * Affiche une animation élégante pendant que l'IA génère sa réponse
 * avant de recevoir le premier chunk de texte.
 */

import { type ReactElement } from 'react';
import { motion } from 'framer-motion';
import { Brain } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ThinkingIndicatorProps {
  className?: string;
}

export function ThinkingIndicator({ className }: ThinkingIndicatorProps): ReactElement {
  return (
    <div
      className={cn(
        'flex items-center gap-3 py-2 text-muted-foreground',
        className
      )}
      role="status"
      aria-label="Tom réfléchit à la réponse"
    >
      {/* Icône cerveau avec animation pulse */}
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.7, 1, 0.7]
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
      >
        <Brain className="w-5 h-5 text-primary" />
      </motion.div>

      {/* Texte avec animation fade */}
      <motion.span
        className="text-sm font-medium"
        animate={{
          opacity: [0.6, 1, 0.6]
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
      >
        Tom réfléchit...
      </motion.span>

      {/* Points animés */}
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((index) => (
          <motion.div
            key={index}
            className="w-1.5 h-1.5 rounded-full bg-primary/60"
            animate={{
              y: [-2, 2, -2],
              opacity: [0.4, 1, 0.4]
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: index * 0.15
            }}
          />
        ))}
      </div>
    </div>
  );
}
