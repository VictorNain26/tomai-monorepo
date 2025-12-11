/**
 * TimelineViewer - Composant de chronologie
 * Drag & drop ou click pour ordonner des événements historiques
 * Idéal pour histoire-géographie
 */

import { type ReactElement, useState, useMemo } from 'react';
import { Check, ChevronLeft, RotateCcw, X, ArrowUp, ArrowDown, Calendar } from 'lucide-react';
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

  const isCorrect = content.correctOrder.every((correctIdx, i) => userOrder[i] === correctIdx);

  const handleMoveUp = (position: number) => {
    if (hasAnswered || position === 0) return;
    const newOrder = [...userOrder];
    const temp = newOrder[position - 1];
    newOrder[position - 1] = newOrder[position] as number;
    newOrder[position] = temp as number;
    setUserOrder(newOrder);
  };

  const handleMoveDown = (position: number) => {
    if (hasAnswered || position === userOrder.length - 1) return;
    const newOrder = [...userOrder];
    const temp = newOrder[position + 1];
    newOrder[position + 1] = newOrder[position] as number;
    newOrder[position] = temp as number;
    setUserOrder(newOrder);
  };

  const handleValidate = () => {
    setHasAnswered(true);
  };

  const handleReset = () => {
    setUserOrder([...shuffledIndices]);
    setHasAnswered(false);
  };

  const handleNext = () => {
    setUserOrder([...shuffledIndices]);
    setHasAnswered(false);
    onNext();
  };

  const getEventStyle = (eventIndex: number, position: number) => {
    if (!hasAnswered) {
      return 'border-border bg-background';
    }
    const correctPosition = content.correctOrder.indexOf(eventIndex);
    return correctPosition === position
      ? 'border-green-500 bg-green-500/10'
      : 'border-red-500 bg-red-500/10';
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
        </CardContent>
      </Card>

      {/* Timeline events */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-5 sm:left-6 top-4 bottom-4 w-0.5 bg-border" />

        <div className="space-y-3">
          {userOrder.map((eventIndex, position) => {
            const event = content.events[eventIndex];
            if (!event) return null;

            return (
              <div
                key={`event-${eventIndex}-${event.event.slice(0, 20)}`}
                className="relative flex items-center gap-3"
              >
                {/* Timeline dot */}
                <div
                  className={cn(
                    'relative z-10 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
                    !hasAnswered && 'bg-primary/10 text-primary border-2 border-primary',
                    hasAnswered && content.correctOrder.indexOf(eventIndex) === position && 'bg-green-500 text-white',
                    hasAnswered && content.correctOrder.indexOf(eventIndex) !== position && 'bg-red-500 text-white'
                  )}
                >
                  {position + 1}
                </div>

                {/* Event card */}
                <Card className={cn('flex-1 transition-all', getEventStyle(eventIndex, position))}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{event.event}</p>
                      {hasAnswered && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {event.date}
                        </p>
                      )}
                      {!hasAnswered && event.hint && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          {event.hint}
                        </p>
                      )}
                    </div>

                    {/* Move buttons */}
                    {!hasAnswered && (
                      <div className="flex flex-col gap-1 ml-2 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 sm:h-7 sm:w-7"
                          onClick={() => handleMoveUp(position)}
                          disabled={position === 0}
                          aria-label="Déplacer vers le haut"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 sm:h-7 sm:w-7"
                          onClick={() => handleMoveDown(position)}
                          disabled={position === userOrder.length - 1}
                          aria-label="Déplacer vers le bas"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>

      {/* Result feedback */}
      {hasAnswered && (
        <Card className={cn(
          'border',
          isCorrect ? 'border-green-500/30 bg-green-500/5' : 'border-amber-500/30 bg-amber-500/5'
        )}>
          <CardContent className="p-4 text-center">
            {isCorrect ? (
              <div className="flex items-center justify-center gap-2 text-green-600">
                <Check className="h-5 w-5" />
                <span className="font-medium">Parfait ! La chronologie est correcte.</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-amber-600">
                <X className="h-5 w-5" />
                <span className="font-medium">Certains événements ne sont pas à la bonne place.</span>
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
          <>
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Mélanger
            </Button>
            <Button onClick={handleValidate}>
              Valider
            </Button>
          </>
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
