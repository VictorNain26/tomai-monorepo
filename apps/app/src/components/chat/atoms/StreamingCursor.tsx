/**
 * StreamingCursor - Curseur clignotant pendant le streaming
 *
 * Affiche un curseur qui clignote à la fin du texte pendant
 * que l'IA génère sa réponse en temps réel.
 */

import { type ReactElement } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface StreamingCursorProps {
  className?: string;
}

export function StreamingCursor({ className }: StreamingCursorProps): ReactElement {
  return (
    <motion.span
      className={cn(
        'inline-block w-0.5 h-4 bg-primary ml-0.5 align-middle',
        className
      )}
      animate={{
        opacity: [1, 0, 1]
      }}
      transition={{
        duration: 0.8,
        repeat: Infinity,
        ease: 'easeInOut'
      }}
      aria-hidden="true"
    />
  );
}
