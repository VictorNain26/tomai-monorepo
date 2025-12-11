/**
 * ProcessOrderViewer - Composant d'ordonnancement de processus
 * Similaire à Timeline mais pour des processus scientifiques
 * Idéal pour SVT (digestion, photosynthèse, cycle de l'eau, etc.)
 */

import { type ReactElement, useState, useMemo } from 'react';
import { Check, ChevronLeft, RotateCcw, X, ArrowUp, ArrowDown, Workflow } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MathContent } from '@/components/MathContent';
import { cn } from '@/lib/utils';
import type { IProcessOrderContent } from '@/types';

interface ProcessOrderViewerProps {
  content: IProcessOrderContent;
  onNext: () => void;
  onPrevious?: () => void;
  isLast: boolean;
  isFirst?: boolean;
}

export function ProcessOrderViewer({ content, onNext, onPrevious, isLast, isFirst }: ProcessOrderViewerProps): ReactElement {
  // Shuffle steps on mount
  const shuffledIndices = useMemo(() => {
    const indices = content.steps.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = indices[i];
      indices[i] = indices[j] as number;
      indices[j] = temp as number;
    }
    return indices;
  }, [content.steps]);

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

  const getStepStyle = (stepIndex: number, position: number) => {
    if (!hasAnswered) {
      return 'border-border bg-background';
    }
    const correctPosition = content.correctOrder.indexOf(stepIndex);
    return correctPosition === position
      ? 'border-green-500 bg-green-500/10'
      : 'border-red-500 bg-red-500/10';
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto">
      {/* Process name badge */}
      <div className="flex justify-center">
        <span className="px-4 py-1.5 bg-primary/10 text-primary text-sm font-medium rounded-full flex items-center gap-2">
          <Workflow className="h-4 w-4" />
          {content.processName}
        </span>
      </div>

      {/* Instruction */}
      <Card>
        <CardContent className="p-4">
          <p className="text-lg font-medium text-foreground text-center">
            {content.instruction}
          </p>
        </CardContent>
      </Card>

      {/* Process steps */}
      <div className="relative">
        {/* Connecting line */}
        <div className="absolute left-5 sm:left-6 top-6 bottom-6 w-0.5 bg-border" />

        <div className="space-y-3">
          {userOrder.map((stepIndex, position) => {
            const step = content.steps[stepIndex];
            if (!step) return null;

            const isCorrectPosition = hasAnswered && content.correctOrder.indexOf(stepIndex) === position;
            const isWrongPosition = hasAnswered && content.correctOrder.indexOf(stepIndex) !== position;

            return (
              <div
                key={`step-${stepIndex}-${step.slice(0, 20)}`}
                className="relative flex items-center gap-3"
              >
                {/* Step number */}
                <div
                  className={cn(
                    'relative z-10 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
                    !hasAnswered && 'bg-primary/10 text-primary border-2 border-primary',
                    isCorrectPosition && 'bg-green-500 text-white',
                    isWrongPosition && 'bg-red-500 text-white'
                  )}
                >
                  {hasAnswered ? (
                    isCorrectPosition ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />
                  ) : (
                    position + 1
                  )}
                </div>

                {/* Step card */}
                <Card className={cn('flex-1 transition-all', getStepStyle(stepIndex, position))}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <MathContent content={step} className="flex-1 text-foreground" />

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

                {/* Arrow to next step */}
                {position < userOrder.length - 1 && (
                  <div className="absolute left-6 -bottom-3 w-0.5 h-6 flex items-center justify-center">
                    <div className="w-2 h-2 border-r-2 border-b-2 border-border rotate-45 -translate-y-1" />
                  </div>
                )}
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
          <CardContent className="p-4">
            {isCorrect ? (
              <div className="flex items-center justify-center gap-2 text-green-600">
                <Check className="h-5 w-5" />
                <span className="font-medium">Parfait ! L'ordre du processus est correct.</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-amber-600">
                  <X className="h-5 w-5" />
                  <span className="font-medium">Certaines étapes ne sont pas dans le bon ordre.</span>
                </div>
                {content.explanation && (
                  <div className="text-sm text-muted-foreground text-center">
                    <MathContent content={content.explanation} className="inline" />
                  </div>
                )}
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
