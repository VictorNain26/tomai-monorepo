/**
 * TimelineViewer - Composant de chronologie avec drag-and-drop
 * Glisser-déposer pour ordonner des événements historiques
 * Idéal pour histoire-géographie
 *
 * Utilise @dnd-kit pour une UX fluide et accessible
 */

import { type ReactElement, useState, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, ChevronLeft, X, GripVertical, Calendar, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ITimelineContent } from '@/types';

interface TimelineViewerProps {
  content: ITimelineContent;
  onNext: () => void;
  onPrevious?: () => void;
  isLast: boolean;
  isFirst?: boolean;
}

interface SortableEventProps {
  id: string;
  eventIndex: number;
  event: { event: string; date: string; hint?: string };
  position: number;
  hasAnswered: boolean;
  isCorrectPosition: boolean;
  correctPosition: number;
}

/**
 * Composant sortable pour un événement de la timeline
 */
function SortableEvent({
  id,
  event,
  position,
  hasAnswered,
  isCorrectPosition,
  correctPosition,
}: SortableEventProps): ReactElement {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: hasAnswered });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'relative flex items-center gap-3',
        isDragging && 'z-50',
        !hasAnswered && 'cursor-grab active:cursor-grabbing touch-none'
      )}
      aria-label="Glisser pour réordonner"
    >
      {/* Timeline dot */}
      <div
        className={cn(
          'relative z-10 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors',
          !hasAnswered && 'bg-primary/10 text-primary border-2 border-primary',
          hasAnswered && isCorrectPosition && 'bg-green-500 text-white',
          hasAnswered && !isCorrectPosition && 'bg-red-500 text-white'
        )}
      >
        {position + 1}
      </div>

      {/* Event card */}
      <Card
        className={cn(
          'flex-1 transition-all',
          isDragging && 'shadow-lg ring-2 ring-primary opacity-90',
          !hasAnswered && !isDragging && 'border-border bg-background hover:border-primary/50',
          hasAnswered && isCorrectPosition && 'border-green-500 bg-green-500/10',
          hasAnswered && !isCorrectPosition && 'border-red-500 bg-red-500/10'
        )}
      >
        <CardContent className="p-3 flex items-center">
          {/* Drag indicator */}
          {!hasAnswered && (
            <GripVertical className="h-5 w-5 text-muted-foreground mr-2 flex-shrink-0" />
          )}

          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground">{event.event}</p>

            {/* Show date after answering */}
            {hasAnswered && (
              <p className="text-sm text-muted-foreground mt-1 font-mono">
                {event.date}
              </p>
            )}

            {/* Show hint before answering */}
            {!hasAnswered && event.hint && (
              <p className="text-xs text-muted-foreground mt-1 italic">
                {event.hint}
              </p>
            )}

            {/* Show correct position if wrong */}
            {hasAnswered && !isCorrectPosition && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <ArrowRight className="h-3 w-3" />
                Position correcte : {correctPosition + 1}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function TimelineViewer({ content, onNext, onPrevious, isLast, isFirst }: TimelineViewerProps): ReactElement {
  // Shuffle events on mount
  const shuffledIndices = useMemo(() => {
    const indices = content.events.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = indices[i];
      indices[i] = indices[j] as number;
      indices[j] = temp as number;
    }
    return indices;
  }, [content.events]);

  const [userOrder, setUserOrder] = useState<number[]>(shuffledIndices);
  const [hasAnswered, setHasAnswered] = useState(false);

  // Create stable IDs for dnd-kit
  const itemIds = useMemo(
    () => userOrder.map((eventIndex) => `event-${eventIndex}`),
    [userOrder]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px de mouvement avant activation (évite les clics accidentels)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const isCorrect = content.correctOrder.every((correctIdx, i) => userOrder[i] === correctIdx);
  const correctCount = content.correctOrder.filter((correctIdx, i) => userOrder[i] === correctIdx).length;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setUserOrder((items) => {
        const oldIndex = itemIds.indexOf(active.id as string);
        const newIndex = itemIds.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleValidate = () => {
    setHasAnswered(true);
  };

  const handleNext = () => {
    // Re-shuffle for next attempt
    const indices = content.events.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = indices[i];
      indices[i] = indices[j] as number;
      indices[j] = temp as number;
    }
    setUserOrder(indices);
    setHasAnswered(false);
    onNext();
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto">
      {/* Instruction */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <p className="text-lg font-medium text-foreground text-center">
              {content.instruction}
            </p>
          </div>
          {!hasAnswered && (
            <p className="text-sm text-muted-foreground text-center mt-2">
              Glisse les événements pour les remettre dans l'ordre chronologique
            </p>
          )}
        </CardContent>
      </Card>

      {/* Timeline events with drag-and-drop */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-5 sm:left-6 top-4 bottom-4 w-0.5 bg-border" />

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {userOrder.map((eventIndex, position) => {
                const event = content.events[eventIndex];
                if (!event) return null;

                const correctPosition = content.correctOrder.indexOf(eventIndex);
                const isCorrectPosition = correctPosition === position;

                return (
                  <SortableEvent
                    key={`event-${eventIndex}`}
                    id={`event-${eventIndex}`}
                    eventIndex={eventIndex}
                    event={event}
                    position={position}
                    hasAnswered={hasAnswered}
                    isCorrectPosition={isCorrectPosition}
                    correctPosition={correctPosition}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Result feedback - Enhanced */}
      {hasAnswered && (
        <Card className={cn(
          'border',
          isCorrect ? 'border-green-500/30 bg-green-500/5' : 'border-amber-500/30 bg-amber-500/5'
        )}>
          <CardContent className="p-4">
            {isCorrect ? (
              <div className="flex items-center justify-center gap-2 text-green-600">
                <Check className="h-5 w-5" />
                <span className="font-medium">Parfait ! La chronologie est correcte.</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 text-amber-600">
                  <X className="h-5 w-5" />
                  <span className="font-medium">
                    {correctCount}/{content.events.length} événements bien placés
                  </span>
                </div>

                {/* Show correct order */}
                <div className="border-t border-amber-200 pt-3 mt-3">
                  <p className="text-sm font-medium text-foreground mb-2 text-center">
                    Ordre chronologique correct :
                  </p>
                  <ol className="space-y-1">
                    {content.correctOrder.map((eventIndex, i) => {
                      const event = content.events[eventIndex];
                      if (!event) return null;
                      return (
                        <li
                          key={`correct-${eventIndex}`}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {i + 1}
                          </span>
                          <span className="font-mono text-muted-foreground text-xs">
                            {event.date}
                          </span>
                          <span className="text-foreground">
                            {event.event}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
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

        {!hasAnswered && (
          <Button onClick={handleValidate}>
            Valider
          </Button>
        )}

        {hasAnswered && (
          <Button onClick={handleNext}>
            {isLast ? 'Terminer' : 'Suivant'}
          </Button>
        )}
      </div>
    </div>
  );
}
