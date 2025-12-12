/**
 * MatchingViewer - Composant d'association mot-traduction avec drag-and-drop
 * Glisser-déposer pour associer des paires
 * Idéal pour langues vivantes (vocabulaire)
 *
 * Utilise @dnd-kit pour une UX fluide et accessible
 */

import { useState, useMemo, type ReactElement, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Check, ChevronLeft, X, GripVertical, Link2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { IMatchingContent } from '@/types';

interface MatchingViewerProps {
  content: IMatchingContent;
  onNext: () => void;
  onPrevious?: () => void;
  isLast: boolean;
  isFirst?: boolean;
}

interface DraggableItemProps {
  id: string;
  text: string;
  isMatched: boolean;
  disabled: boolean;
}

interface DroppableTargetProps {
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
function DraggableItem({ id, text, isMatched, disabled }: DraggableItemProps): ReactElement {
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
function PlacedItem({ id, text, disabled }: { id: string; text: string; disabled: boolean }): ReactElement {
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
function DroppableTarget({ id, text, matchedText, matchedLeftIndex, isCorrect, hasValidated, disabled }: DroppableTargetProps): ReactElement {
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
function LeftColumnDropZone({ children, isActive }: { children: ReactNode; isActive: boolean }): ReactElement {
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
function DragOverlayContent({ text }: { text: string }): ReactElement {
  return (
    <div className="p-3 rounded-lg border-2 border-primary bg-background shadow-xl">
      <span className="font-medium text-foreground">{text}</span>
    </div>
  );
}

export function MatchingViewer({ content, onNext, onPrevious, isLast, isFirst }: MatchingViewerProps): ReactElement {
  // Shuffle right side items for display
  const shuffledRightIndices = useMemo(() => {
    const indices = content.pairs.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = indices[i];
      indices[i] = indices[j] as number;
      indices[j] = temp as number;
    }
    return indices;
  }, [content.pairs]);

  const [matches, setMatches] = useState<Map<number, number>>(new Map()); // leftIndex -> rightIndex
  const [hasValidated, setHasValidated] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const isComplete = matches.size === content.pairs.length;
  const correctCount = Array.from(matches.entries()).filter(([left, right]) => left === right).length;
  const allCorrect = isComplete && correctCount === content.pairs.length;

  // Get the text of the currently dragged item
  const getActiveItemText = (): string | null => {
    if (!activeId) return null;
    let index: number;
    if (activeId.startsWith('placed-')) {
      index = parseInt(activeId.replace('placed-', ''));
    } else {
      index = parseInt(activeId.replace('left-', ''));
    }
    return content.pairs[index]?.left ?? null;
  };
  const activeItemText = getActiveItemText();

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    const activeIdStr = active.id as string;
    const newMatches = new Map(matches);

    // Determine the left index being dragged
    let leftIndex: number;
    if (activeIdStr.startsWith('placed-')) {
      leftIndex = parseInt(activeIdStr.replace('placed-', ''));
    } else {
      leftIndex = parseInt(activeIdStr.replace('left-', ''));
    }

    // If dropped outside or on the left column, remove the match (return to source)
    if (!over || (over.id as string) === 'left-column') {
      newMatches.delete(leftIndex);
      setMatches(newMatches);
      return;
    }

    const overId = over.id as string;

    // If dropped on a right target
    if (overId.startsWith('right-')) {
      const rightIndex = parseInt(overId.replace('right-', ''));

      // Check if this right slot is already taken by another item
      const existingMatch = Array.from(newMatches.entries()).find(([l, r]) => r === rightIndex && l !== leftIndex);
      if (existingMatch) return; // Slot taken, ignore

      // Remove old match if re-dropping
      newMatches.delete(leftIndex);
      // Set new match
      newMatches.set(leftIndex, rightIndex);
      setMatches(newMatches);
    }
  };

  const handleValidate = () => {
    setHasValidated(true);
  };

  const handleNext = () => {
    setMatches(new Map());
    setHasValidated(false);
    setActiveId(null);
    onNext();
  };

  // Helper to get matched left index and text for a right index
  const getMatchedLeftInfo = (rightIndex: number): { leftIndex: number; text: string } | null => {
    const entry = Array.from(matches.entries()).find(([_, r]) => r === rightIndex);
    if (entry) {
      const pair = content.pairs[entry[0]];
      if (pair) {
        return { leftIndex: entry[0], text: pair.left };
      }
    }
    return null;
  };

  // Helper to check if a match is correct
  const isMatchCorrect = (rightIndex: number): boolean | null => {
    if (!hasValidated) return null;
    const entry = Array.from(matches.entries()).find(([_, r]) => r === rightIndex);
    if (!entry) return null;
    return entry[0] === rightIndex; // left index should equal right index for correct match
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto">
      {/* Instruction */}
      <Card>
        <CardContent className="p-4">
          <p className="text-lg font-medium text-foreground text-center">
            {content.instruction}
          </p>
          {!hasValidated && (
            <p className="text-sm text-muted-foreground text-center mt-2">
              Glisse chaque élément vers sa correspondance
            </p>
          )}
        </CardContent>
      </Card>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Left column - Draggable items + drop zone to return items */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
              À associer
            </span>
            <LeftColumnDropZone isActive={!!activeId && activeId.startsWith('placed-') && !hasValidated}>
              {content.pairs.map((pair, index) => (
                <DraggableItem
                  key={`left-${pair.left}-${pair.right}`}
                  id={`left-${index}`}
                  text={pair.left}
                  isMatched={matches.has(index)}
                  disabled={hasValidated}
                />
              ))}

              {/* Empty state when all matched */}
              {matches.size === content.pairs.length && !hasValidated && !activeId && (
                <p className="text-sm text-muted-foreground italic text-center py-2">
                  Tous les éléments sont placés
                </p>
              )}
            </LeftColumnDropZone>
          </div>

          {/* Right column - Droppable targets (shuffled) */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
              Correspondance
            </span>
            <div className="space-y-2">
              {shuffledRightIndices.map((originalIndex) => {
                const pair = content.pairs[originalIndex];
                if (!pair) return null;
                const matchInfo = getMatchedLeftInfo(originalIndex);

                return (
                  <DroppableTarget
                    key={`right-${originalIndex}`}
                    id={`right-${originalIndex}`}
                    text={pair.right}
                    matchedText={matchInfo?.text ?? null}
                    matchedLeftIndex={matchInfo?.leftIndex ?? null}
                    isCorrect={isMatchCorrect(originalIndex)}
                    hasValidated={hasValidated}
                    disabled={hasValidated}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {activeId && activeItemText ? (
            <DragOverlayContent text={activeItemText} />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Result feedback */}
      {hasValidated && (
        <Card className={cn(
          'border',
          allCorrect ? 'border-green-500/30 bg-green-500/5' : 'border-amber-500/30 bg-amber-500/5'
        )}>
          <CardContent className="p-4">
            {allCorrect ? (
              <div className="flex items-center justify-center gap-2 text-green-600">
                <Check className="h-5 w-5" />
                <span className="font-medium">Parfait ! Toutes les associations sont correctes.</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 text-amber-600">
                  <X className="h-5 w-5" />
                  <span className="font-medium">
                    {correctCount}/{content.pairs.length} associations correctes
                  </span>
                </div>

                {/* Show correct associations */}
                <div className="border-t border-amber-200 pt-3 mt-3">
                  <p className="text-sm font-medium text-foreground mb-2 text-center">
                    Associations correctes :
                  </p>
                  <div className="space-y-1">
                    {content.pairs.map((pair) => (
                      <div
                        key={`correct-${pair.left}-${pair.right}`}
                        className="flex items-center justify-center gap-2 text-sm"
                      >
                        <span className="font-medium text-foreground">{pair.left}</span>
                        <Link2 className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">{pair.right}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-center gap-3">
        {!isFirst && onPrevious && (
          <Button variant="outline" onClick={onPrevious}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Précédent
          </Button>
        )}

        {!hasValidated && (
          <Button onClick={handleValidate} disabled={!isComplete}>
            Valider
          </Button>
        )}

        {hasValidated && (
          <Button onClick={handleNext}>
            {isLast ? 'Terminer' : 'Suivant'}
          </Button>
        )}
      </div>
    </div>
  );
}
