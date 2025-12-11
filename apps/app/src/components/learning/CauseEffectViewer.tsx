/**
 * CauseEffectViewer - Composant cause → conséquence
 * QCM spécialisé pour identifier les liens de causalité
 * Idéal pour histoire-géographie
 */

import { type ReactElement, useState } from 'react';
import { Check, X, ChevronLeft, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MathContent } from '@/components/MathContent';
import { cn } from '@/lib/utils';
import type { ICauseEffectContent } from '@/types';

interface CauseEffectViewerProps {
  content: ICauseEffectContent;
  onNext: () => void;
  onPrevious?: () => void;
  isLast: boolean;
  isFirst?: boolean;
}

export function CauseEffectViewer({ content, onNext, onPrevious, isLast, isFirst }: CauseEffectViewerProps): ReactElement {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);

  const handleSelect = (index: number) => {
    if (hasAnswered) return;
    setSelectedIndex(index);
  };

  const handleValidate = () => {
    if (selectedIndex === null) return;
    setHasAnswered(true);
  };

  const handleNext = () => {
    setSelectedIndex(null);
    setHasAnswered(false);
    onNext();
  };

  const isCorrect = selectedIndex === content.correctIndex;

  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto">
      {/* Context badge */}
      <div className="flex justify-center">
        <span className="px-4 py-1.5 bg-primary/10 text-primary text-sm font-medium rounded-full">
          {content.context}
        </span>
      </div>

      {/* Cause */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6">
          <div className="text-center">
            <span className="text-xs font-semibold text-primary uppercase tracking-wide block mb-2">
              Cause
            </span>
            <p className="text-lg font-medium text-foreground">
              {content.cause}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Arrow */}
      <div className="flex justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <ArrowRight className="h-6 w-6" />
          <span className="text-sm font-medium">Quelle conséquence ?</span>
        </div>
      </div>

      {/* Effects options */}
      <div className="space-y-3">
        {content.possibleEffects.map((effect, index) => {
          const optionKey = `effect-${index}-${effect.slice(0, 15)}`;
          const isSelected = selectedIndex === index;
          const isCorrectOption = index === content.correctIndex;
          const showResult = hasAnswered;

          return (
            <button
              key={optionKey}
              className={cn(
                'w-full p-4 rounded-lg border-2 text-left transition-all',
                'hover:border-primary/50 hover:bg-primary/5',
                !hasAnswered && isSelected && 'border-primary bg-primary/10',
                showResult && isCorrectOption && 'border-green-500 bg-green-500/10',
                showResult && isSelected && !isCorrectOption && 'border-red-500 bg-red-500/10',
                hasAnswered && 'cursor-default'
              )}
              onClick={() => handleSelect(index)}
              disabled={hasAnswered}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full border-2 text-sm font-medium flex-shrink-0',
                    !hasAnswered && isSelected && 'border-primary bg-primary text-primary-foreground',
                    !hasAnswered && !isSelected && 'border-border',
                    showResult && isCorrectOption && 'border-green-500 bg-green-500 text-white',
                    showResult && isSelected && !isCorrectOption && 'border-red-500 bg-red-500 text-white'
                  )}
                >
                  {showResult && isCorrectOption ? (
                    <Check className="h-4 w-4" />
                  ) : showResult && isSelected && !isCorrectOption ? (
                    <X className="h-4 w-4" />
                  ) : (
                    String.fromCharCode(65 + index)
                  )}
                </span>
                <span className="font-medium text-foreground">{effect}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Explanation (shown after answer) */}
      {hasAnswered && content.explanation && (
        <Card className={cn(
          'border',
          isCorrect ? 'border-green-500/30 bg-green-500/5' : 'border-amber-500/30 bg-amber-500/5'
        )}>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Explication : </span>
              <MathContent content={content.explanation} className="inline" />
            </div>
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

        {!hasAnswered ? (
          <Button onClick={handleValidate} disabled={selectedIndex === null}>
            Valider
          </Button>
        ) : (
          <Button onClick={handleNext}>
            {isLast ? 'Terminer' : 'Suivant'}
          </Button>
        )}
      </div>
    </div>
  );
}
