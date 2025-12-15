/**
 * Classification DnD Items - Composants drag & drop réutilisables
 */

import type { ReactElement, ReactNode } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Check, X, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Composant draggable pour un élément non classé
 */
export function DraggableItem({
  id,
  text,
  isSelected,
  disabled,
  onClick,
}: {
  id: string;
  text: string;
  isSelected: boolean;
  disabled: boolean;
  onClick: () => void;
}): ReactElement {
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
      onClick={onClick}
      className={cn(
        'px-4 py-2 rounded-lg border-2 font-medium transition-all flex items-center gap-2',
        'hover:border-primary/50 hover:bg-primary/5',
        !disabled && 'cursor-grab active:cursor-grabbing touch-none',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-primary',
        isSelected && 'border-primary bg-primary/10 ring-2 ring-primary/30',
        !isSelected && !isDragging && 'border-border bg-background',
        disabled && 'cursor-default'
      )}
    >
      {!disabled && <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
      {text}
    </div>
  );
}

/**
 * Composant draggable pour un élément déjà placé dans une catégorie
 */
export function PlacedDraggableItem({
  id,
  text,
  isCorrect,
  isWrong,
  disabled,
  onRemove,
}: {
  id: string;
  text: string;
  isCorrect: boolean;
  isWrong: boolean;
  disabled: boolean;
  onRemove: () => void;
}): ReactElement {
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
        'px-2 py-1 rounded text-sm flex items-center gap-1',
        !disabled && 'cursor-grab active:cursor-grabbing touch-none',
        isDragging && 'opacity-50',
        !disabled && !isCorrect && !isWrong && 'bg-blue-500/20 text-blue-700',
        isCorrect && 'bg-green-500/20 text-green-700',
        isWrong && 'bg-red-500/20 text-red-700'
      )}
    >
      {!disabled && <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
      {text}
      {disabled && isCorrect && <Check className="h-3 w-3" />}
      {disabled && isWrong && <X className="h-3 w-3" />}
      {!disabled && (
        <X
          className="h-3 w-3 opacity-50 hover:opacity-100 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        />
      )}
    </div>
  );
}

/**
 * Zone droppable pour une catégorie
 */
export function DroppableCategory({
  category,
  children,
  hasSelectedItem,
  hasItems,
  disabled,
  onClick,
}: {
  category: string;
  children: ReactNode;
  hasSelectedItem: boolean;
  hasItems: boolean;
  disabled: boolean;
  onClick: () => void;
}): ReactElement {
  const { isOver, setNodeRef } = useDroppable({
    id: `category-${category}`,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={cn(
        'p-4 rounded-lg border-2 transition-all min-h-[120px]',
        isOver && !disabled && 'border-primary bg-primary/10 ring-2 ring-primary/30',
        !isOver && hasSelectedItem && !disabled && 'cursor-pointer hover:border-primary/50 hover:bg-primary/5',
        !isOver && !hasSelectedItem && 'cursor-default',
        !isOver && hasItems && !disabled && 'border-blue-500/50 bg-blue-500/5',
        disabled && 'cursor-default'
      )}
    >
      <h4 className="font-semibold text-foreground text-center mb-3 pb-2 border-b">
        {category}
      </h4>
      <div className="flex flex-wrap gap-1 justify-center">
        {children}
      </div>
    </div>
  );
}

/**
 * Zone de drop pour remettre les éléments dans la zone source
 */
export function SourceDropZone({
  children,
  isActive
}: {
  children: ReactNode;
  isActive: boolean;
}): ReactElement {
  const { isOver, setNodeRef } = useDroppable({
    id: 'source-zone',
    disabled: !isActive,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-wrap justify-center gap-2 p-2 -m-2 rounded-lg transition-all min-h-[50px]',
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
    <div className="px-4 py-2 rounded-lg border-2 border-primary bg-background shadow-xl font-medium">
      {text}
    </div>
  );
}
