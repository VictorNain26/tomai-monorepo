/**
 * MessagesList - Molecule liste messages
 *
 * Container scrollable avec messages organisés chronologiquement
 * ✨ UX MODERNE: Animations Framer Motion + Smooth scroll + Stagger effect
 */

import { type ReactElement, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ChatMessage } from './ChatMessage';
import type { IMessage } from '@/types';

export interface MessagesListProps {
  messages: IMessage[];
  isAudioEnabled?: boolean;
  className?: string;
}

// 🎨 Variants d'animation - Apparition fluide et professionnelle
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08, // Délai entre chaque message (80ms)
      delayChildren: 0.02
    }
  }
};

const messageVariants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.95
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 260,
      damping: 20,
      mass: 0.8
    }
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: {
      duration: 0.2
    }
  }
};

export function MessagesList({
  messages,
  isAudioEnabled = false,
  className
}: MessagesListProps): ReactElement {
  const bottomRef = useRef<HTMLDivElement>(null);

  // 🎯 Auto-scroll en bas - TOUJOURS
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages]);

  return (
    <div className={cn('h-full overflow-y-auto p-4 md:p-6', className)}>
      <motion.div
        className="flex flex-col gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <AnimatePresence mode="popLayout">
          {messages.map((message) => (
            <motion.div
              key={message.id}
              variants={messageVariants}
              layout
            >
              <ChatMessage
                message={message}
                isAudioEnabled={isAudioEnabled}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Élément invisible en bas pour scroll automatique */}
      <div ref={bottomRef} className="h-0" />
    </div>
  );
}
