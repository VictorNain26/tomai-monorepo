/**
 * MatchingViewer - Composant d'association mot-traduction avec drag-and-drop
 * Glisser-déposer pour associer des paires
 * Idéal pour langues vivantes (vocabulaire)
 *
 * Utilise @dnd-kit pour une UX fluide et accessible
 */

import { type ReactElement, useState, useMemo } from 'react';
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
import { Check, ChevronLeft, RotateCcw, X, GripVertical, Link2 } from 'lucide-react';
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
  isCorrect: boolean | null;
  hasValidated: boolean;
  disabled: boolean;
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
      className={cn(
        'p-3 rounded-lg border-2 bg-background transition-all flex items-center gap-2',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-primary',
        !isDragging && 'border-primary/30 hover:border-primary hover:bg-primary/5',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {!disabled && (
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none p-1 -ml-1 rounded hover:bg-muted"
          aria-label="Glisser pour associer"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <span className="font-medium text-foreground">{text}</span>
    </div>
  );
}

/**
 * Composant droppable pour un élément de droite (cible)
 */
function DroppableTarget({ id, text, matchedText, isCorrect, hasValidated, disabled }: DroppableTargetProps): ReactElement {
  const { isOver, setNodeRef } = useDroppable({
    id,
    disabled,
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

      {/* Matched item (if any) */}
      {matchedText && (
        <div className={cn(
          'mt-2 pt-2 border-t flex items-center gap-2',
          !hasValidated && 'border-blue-300',
          hasValidated && isCorrect && 'border-green-300',
          hasValidated && !isCorrect && 'border-red-300'
        )}>
          <Link2 className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <span className={cn(
            'text-sm',
            !hasValidated && 'text-blue-700',
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
  const activeItem = activeId ? content.pairs[parseInt(activeId.replace('left-', ''))] : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const leftIndex = parseInt((active.id as string).replace('left-', ''));
    const rightIndex = parseInt((over.id as string).replace('right-', ''));

    // Check if this right slot is already taken
    const existingMatch = Array.from(matches.entries()).find(([_, r]) => r === rightIndex);
    if (existingMatch) return;

    const newMatches = new Map(matches);
    newMatches.set(leftIndex, rightIndex);
    setMatches(newMatches);
  };

  const handleValidate = () => {
    setHasValidated(true);
  };

  const handleReset = () => {
    setMatches(new Map());
    setHasValidated(false);
    setActiveId(null);
  };

  const handleNext = () => {
    handleReset();
    onNext();
  };

  // Helper to get matched left text for a right index
  const getMatchedLeftText = (rightIndex: number): string | null => {
    const entry = Array.from(matches.entries()).find(([_, r]) => r === rightIndex);
    if (entry) {
      const pair = content.pairs[entry[0]];
      return pair?.left ?? null;
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
          {/* Left column - Draggable items */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
              À associer
            </span>
            <div className="space-y-2">
              {content.pairs.map((pair, index) => (
                <DraggableItem
                  key={`left-${pair.left}-${pair.right}`}
                  id={`left-${index}`}
                  text={pair.left}
                  isMatched={matches.has(index)}
                  disabled={hasValidated}
                />
              ))}
            </div>

            {/* Empty state when all matched */}
            {matches.size === content.pairs.length && !hasValidated && (
              <p className="text-sm text-muted-foreground italic text-center py-2">
                Tous les éléments sont placés
              </p>
            )}
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

                return (
                  <DroppableTarget
                    key={`right-${originalIndex}`}
                    id={`right-${originalIndex}`}
                    text={pair.right}
                    matchedText={getMatchedLeftText(originalIndex)}
                    isCorrect={isMatchCorrect(originalIndex)}
                    hasValidated={hasValidated}
                    disabled={hasValidated || Array.from(matches.values()).includes(originalIndex)}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {activeId && activeItem ? (
            <DragOverlayContent text={activeItem.left} />
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
          <>
            <Button variant="outline" onClick={handleReset} disabled={matches.size === 0}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Réinitialiser
            </Button>
            <Button onClick={handleValidate} disabled={!isComplete}>
              Valider
            </Button>
          </>
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
