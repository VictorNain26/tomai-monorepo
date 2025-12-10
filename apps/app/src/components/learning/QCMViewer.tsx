/**
 * QCMViewer - Composant de QCM (choix multiple)
 * Simple sélection, pas de score visible
 * Support KaTeX pour formules mathématiques
 */

import { type ReactElement, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MathContent } from '@/components/MathContent';
import { cn } from '@/lib/utils';
import type { IQCMContent } from '@/types';

interface QCMViewerProps {
  content: IQCMContent;
  onNext: () => void;
  isLast: boolean;
}

export function QCMViewer({ content, onNext, isLast }: QCMViewerProps): ReactElement {
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
    <div className="flex flex-col gap-6 w-full max-w-xl mx-auto">
      {/* Question */}
      <Card>
        <CardContent className="p-6">
          <MathContent
            content={content.question}
            className="text-xl font-medium text-foreground"
            centered
          />
        </CardContent>
      </Card>

      {/* Options */}
      <div className="space-y-3">
        {content.options.map((option, index) => {
          const optionKey = `option-${index}-${option.slice(0, 10)}`;
          const isSelected = selectedIndex === index;
          const isCorrectOption = index === content.correctIndex;
          const showResult = hasAnswered;

          return (
            <button
              key={optionKey}
              className={cn(
                'w-full p-4 rounded-lg border text-left transition-all',
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
                    'flex items-center justify-center w-8 h-8 rounded-full border text-sm font-medium',
                    !hasAnswered && isSelected && 'border-primary bg-primary text-primary-foreground',
                    showResult && isCorrectOption && 'border-green-500 bg-green-500 text-white',
                    showResult && isSelected && !isCorrectOption && 'border-red-500 bg-red-500 text-white'
                  )}
                >
                  {showResult && isCorrectOption ? (
                    <Check className="h-4 w-4" />
                  ) : showResult && isSelected && !isCorrectOption ? (
                    <X className="h-4 w-4" />
                  ) : (
                    String.fromCharCode(65 + index) // A, B, C, D
                  )}
                </span>
                <MathContent content={option} className="flex-1 text-foreground" />
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
        {!hasAnswered ? (
          <Button
            onClick={handleValidate}
            disabled={selectedIndex === null}
          >
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
