/**
 * FillBlankViewer - Composant texte à trous
 * Choix multiple pour compléter une phrase
 * Idéal pour langues et français (grammaire, conjugaison)
 */

import { type ReactElement, useState } from 'react';
import { Check, X, ChevronLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MathContent } from '@/components/MathContent';
import { cn } from '@/lib/utils';
import { getRandomEncouragement } from './encouragements';
import type { IFillBlankContent } from '@/types';

interface FillBlankViewerProps {
  content: IFillBlankContent;
  onNext: () => void;
  onPrevious?: () => void;
  isLast: boolean;
  isFirst?: boolean;
}

export function FillBlankViewer({ content, onNext, onPrevious, isLast, isFirst }: FillBlankViewerProps): ReactElement {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [encouragement, setEncouragement] = useState<string | null>(null);

  const handleSelect = (index: number) => {
    if (hasAnswered) return;
    setSelectedIndex(index);
  };

  const handleValidate = () => {
    if (selectedIndex === null) return;
    setHasAnswered(true);
    // Encouragement si bonne réponse
    if (selectedIndex === content.correctIndex) {
      setEncouragement(getRandomEncouragement());
    }
  };

  const handleNext = () => {
    setSelectedIndex(null);
    setHasAnswered(false);
    setEncouragement(null);
    onNext();
  };

  const isCorrect = selectedIndex === content.correctIndex;

  // Split sentence at ___ to display with blank
  const sentenceParts = content.sentence.split('___');
  const filledAnswer = hasAnswered && selectedIndex !== null ? content.options[selectedIndex] : '___';

  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto">
      {/* Grammatical point badge (if provided) */}
      {content.grammaticalPoint && (
        <div className="flex justify-center">
          <span className="px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full">
            {content.grammaticalPoint}
          </span>
        </div>
      )}

      {/* Sentence with blank */}
      <Card>
        <CardContent className="p-6">
          <p className="text-xl font-medium text-foreground text-center">
            {sentenceParts[0]}
            <span
              className={cn(
                'inline-block min-w-[80px] px-2 py-1 mx-1 rounded border-2 border-dashed',
                !hasAnswered && 'border-primary/50 bg-primary/5',
                hasAnswered && isCorrect && 'border-green-500 bg-green-500/10',
                hasAnswered && !isCorrect && 'border-red-500 bg-red-500/10'
              )}
            >
              {filledAnswer}
            </span>
            {sentenceParts[1]}
          </p>
        </CardContent>
      </Card>

      {/* Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {content.options.map((option, index) => {
          const optionKey = `option-${index}-${option.slice(0, 10)}`;
          const isSelected = selectedIndex === index;
          const isCorrectOption = index === content.correctIndex;
          const showResult = hasAnswered;

          return (
            <button
              key={optionKey}
              className={cn(
                'p-4 rounded-lg border-2 text-center transition-all',
                'hover:border-primary/50 hover:bg-primary/5',
                !hasAnswered && isSelected && 'border-primary bg-primary/10',
                showResult && isCorrectOption && 'border-green-500 bg-green-500/10',
                showResult && isSelected && !isCorrectOption && 'border-red-500 bg-red-500/10',
                hasAnswered && 'cursor-default'
              )}
              onClick={() => handleSelect(index)}
              disabled={hasAnswered}
            >
              <div className="flex items-center justify-center gap-2">
                {showResult && isCorrectOption && (
                  <Check className="h-4 w-4 text-green-600" />
                )}
                {showResult && isSelected && !isCorrectOption && (
                  <X className="h-4 w-4 text-red-600" />
                )}
                <span className="font-medium">{option}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Encouragement (shown after correct answer) */}
      {encouragement && (
        <p className="text-sm text-green-600 font-medium text-center">{encouragement}</p>
      )}

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
