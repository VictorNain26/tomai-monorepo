/**
 * ConversationSeparator - Séparateur visuel entre conversations
 *
 * Affiche une ligne avec le topic et la raison de la séparation
 * Utilise les couleurs du design system pour chaque type de détection
 */

import { type ReactElement } from 'react';
import { Clock, Lightbulb, MessageSquare, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ConversationSeparatorProps {
  topic?: string | null;
  reason: 'initial' | 'temporal' | 'semantic' | 'intentional';
  confidence?: number;
  className?: string;
}

// Configuration visuelle par type de détection
const REASON_CONFIG = {
  initial: {
    label: 'Nouvelle conversation',
    icon: Sparkles,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800'
  },
  temporal: {
    label: 'Reprise après pause',
    icon: Clock,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    borderColor: 'border-purple-200 dark:border-purple-800'
  },
  semantic: {
    label: 'Changement de sujet',
    icon: Lightbulb,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-200 dark:border-amber-800'
  },
  intentional: {
    label: 'Nouveau sujet demandé',
    icon: MessageSquare,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    borderColor: 'border-green-200 dark:border-green-800'
  }
} as const;

export function ConversationSeparator({
  topic,
  reason,
  confidence,
  className
}: ConversationSeparatorProps): ReactElement {
  const config = REASON_CONFIG[reason];
  const Icon = config.icon;

  return (
    <div className={cn('my-6 flex items-center gap-4', className)}>
      {/* Ligne gauche */}
      <div className="flex-1 h-px bg-border" />

      {/* Badge central */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-full border',
          'transition-colors duration-200',
          config.bgColor,
          config.borderColor
        )}
      >
        <Icon className={cn('h-4 w-4', config.color)} />
        <div className="flex flex-col items-start gap-0.5">
          <span className={cn('text-xs font-medium', config.color)}>
            {config.label}
          </span>
          {topic && (
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
              {topic}
            </span>
          )}
        </div>
        {confidence !== undefined && confidence < 1.0 && (
          <span className="text-[10px] text-muted-foreground ml-1">
            {Math.round(confidence * 100)}%
          </span>
        )}
      </div>

      {/* Ligne droite */}
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}
