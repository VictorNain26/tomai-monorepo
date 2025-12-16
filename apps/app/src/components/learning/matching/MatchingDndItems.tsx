/**
 * Matching DnD Items - Composants drag & drop réutilisables pour MatchingViewer
 */

import type { ReactElement, ReactNode } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Check, X, GripVertical, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DraggableItemProps {
  id: string;
  text: string;
  isMatched: boolean;
  disabled: boolean;
}

export interface DroppableTargetProps {
  id: string;
  text: string;
  matchedText: string | null;
  matchedLeftIndex: number | null;
  isCorrect: boolean | null;
  hasValidated: boolean;
  disabled: boolean;
  onRemove?: () => void;
}

/**
 * Composant draggable pour un élément de gauche
 */
export function DraggableItem({ id, text, isMatched, disabled }: DraggableItemProps): ReactElement {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id,
    disabled: disabled || isMatched,
  });

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
  } : undefined;

  if (isMatched) {
    return <div className="hidden" />;
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'p-3 rounded-lg border-2 bg-background transition-all flex items-center gap-2',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-primary',
        !isDragging && 'border-primary/30 hover:border-primary hover:bg-primary/5',
        !disabled && 'cursor-grab active:cursor-grabbing touch-none',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      aria-label="Glisser pour associer"
    >
      <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <span className="font-medium text-foreground">{text}</span>
    </div>
  );
}

/**
 * Composant draggable pour un élément déjà placé dans une zone de drop
 */
export function PlacedItem({ id, text, disabled }: { id: string; text: string; disabled: boolean }): ReactElement {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id,
    disabled,
  });

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'mt-2 pt-2 border-t flex items-center gap-2',
        !disabled && 'cursor-grab active:cursor-grabbing touch-none',
        isDragging && 'opacity-50'
      )}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      <Link2 className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      <span className="text-sm text-blue-700">{text}</span>
    </div>
  );
}

/**
 * Composant droppable pour un élément de droite (cible)
 */
export function DroppableTarget({ id, text, matchedText, matchedLeftIndex, isCorrect, hasValidated, disabled }: DroppableTargetProps): ReactElement {
  const { isOver, setNodeRef } = useDroppable({
    id,
    disabled: disabled || (!!matchedText && !hasValidated), // Allow drop when empty or after validation
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'p-3 rounded-lg border-2 transition-all min-h-[56px] flex flex-col justify-center',
        isOver && !matchedText && 'border-primary bg-primary/10 ring-2 ring-primary/30',
        !matchedText && !isOver && 'border-dashed border-muted-foreground/30 bg-muted/20',
        matchedText && !hasValidated && 'border-blue-500 bg-blue-500/10',
        hasValidated && isCorrect === true && 'border-green-500 bg-green-500/10',
        hasValidated && isCorrect === false && 'border-red-500 bg-red-500/10'
      )}
    >
      {/* Target text (always visible) */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">{text}</span>
        {hasValidated && isCorrect !== null && (
          isCorrect
            ? <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
            : <X className="h-4 w-4 text-red-600 flex-shrink-0" />
        )}
      </div>

      {/* Matched item - draggable before validation, static after */}
      {matchedText && !hasValidated && matchedLeftIndex !== null && (
        <PlacedItem
          id={`placed-${matchedLeftIndex}`}
          text={matchedText}
          disabled={hasValidated}
        />
      )}

      {/* Matched item - static after validation */}
      {matchedText && hasValidated && (
        <div className={cn(
          'mt-2 pt-2 border-t flex items-center gap-2',
          hasValidated && isCorrect && 'border-green-300',
          hasValidated && !isCorrect && 'border-red-300'
        )}>
          <Link2 className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <span className={cn(
            'text-sm',
            hasValidated && isCorrect && 'text-green-700',
            hasValidated && !isCorrect && 'text-red-700'
          )}>
            {matchedText}
          </span>
        </div>
      )}

      {/* Drop hint */}
      {!matchedText && !hasValidated && (
        <span className="text-xs text-muted-foreground italic">
          Déposer ici
        </span>
      )}
    </div>
  );
}

/**
 * Zone droppable pour la colonne de gauche (pour remettre les éléments)
 */
export function LeftColumnDropZone({ children, isActive }: { children: ReactNode; isActive: boolean }): ReactElement {
  const { isOver, setNodeRef } = useDroppable({
    id: 'left-column',
    disabled: !isActive,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'space-y-2 p-2 -m-2 rounded-lg transition-all',
        isActive && isOver && 'bg-primary/5 ring-2 ring-primary/30'
      )}
    >
      {children}
    </div>
  );
}

/**
 * Overlay pendant le drag
 */
export function DragOverlayContent({ text }: { text: string }): ReactElement {
  return (
    <div className="p-3 rounded-lg border-2 border-primary bg-background shadow-xl">
      <span className="font-medium text-foreground">{text}</span>
    </div>
  );
}
