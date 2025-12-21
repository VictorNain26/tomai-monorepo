/**
 * VraiFauxViewer - Composant Vrai/Faux
 * Simple choix binaire, pas de score visible
 * Support KaTeX pour formules mathématiques
 */

import { type ReactElement, useState } from 'react';
import { Check, X, ChevronLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MathContent } from '@/components/MathContent';
import { cn } from '@/lib/utils';
import { getRandomEncouragement } from './encouragements';
import type { IVraiFauxContent } from '@/types';

interface VraiFauxViewerProps {
  content: IVraiFauxContent;
  onNext: () => void;
  onPrevious?: () => void;
  isLast: boolean;
  isFirst?: boolean;
}

export function VraiFauxViewer({ content, onNext, onPrevious, isLast, isFirst }: VraiFauxViewerProps): ReactElement {
  const [selectedAnswer, setSelectedAnswer] = useState<boolean | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [encouragement, setEncouragement] = useState<string | null>(null);

  const handleSelect = (answer: boolean) => {
    if (hasAnswered) return;
    setSelectedAnswer(answer);
  };

  const handleValidate = () => {
    if (selectedAnswer === null) return;
    setHasAnswered(true);
    // Encouragement si bonne réponse
    if (selectedAnswer === content.isTrue) {
      setEncouragement(getRandomEncouragement());
    }
  };

  const handleNext = () => {
    setSelectedAnswer(null);
    setHasAnswered(false);
    setEncouragement(null);
    onNext();
  };

  const isCorrect = selectedAnswer === content.isTrue;

  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto">
      {/* Statement */}
      <Card>
        <CardContent className="p-6">
          <MathContent
            content={content.statement}
            className="text-xl font-medium text-foreground"
            centered
          />
        </CardContent>
      </Card>

      {/* True/False buttons */}
      <div className="flex gap-4 justify-center">
        {/* VRAI */}
        <button
          className={cn(
            'flex-1 max-w-[180px] p-6 rounded-xl border-2 transition-all',
            'hover:border-green-500/50 hover:bg-green-500/5',
            !hasAnswered && selectedAnswer === true && 'border-green-500 bg-green-500/10',
            hasAnswered && content.isTrue && 'border-green-500 bg-green-500/10',
            hasAnswered && selectedAnswer === true && !content.isTrue && 'border-red-500 bg-red-500/10',
            hasAnswered && 'cursor-default'
          )}
          onClick={() => handleSelect(true)}
          disabled={hasAnswered}
        >
          <div className="flex flex-col items-center gap-2">
            <div
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center',
                'bg-green-500/20 text-green-600',
                hasAnswered && content.isTrue && 'bg-green-500 text-white'
              )}
            >
              <Check className="h-6 w-6" />
            </div>
            <span className="font-semibold text-lg">VRAI</span>
          </div>
        </button>

        {/* FAUX */}
        <button
          className={cn(
            'flex-1 max-w-[180px] p-6 rounded-xl border-2 transition-all',
            'hover:border-red-500/50 hover:bg-red-500/5',
            !hasAnswered && selectedAnswer === false && 'border-red-500 bg-red-500/10',
            hasAnswered && !content.isTrue && 'border-green-500 bg-green-500/10', // Correct answer
            hasAnswered && selectedAnswer === false && content.isTrue && 'border-red-500 bg-red-500/10', // Wrong answer
            hasAnswered && 'cursor-default'
          )}
          onClick={() => handleSelect(false)}
          disabled={hasAnswered}
        >
          <div className="flex flex-col items-center gap-2">
            <div
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center',
                'bg-red-500/20 text-red-600',
                hasAnswered && !content.isTrue && 'bg-green-500 text-white'
              )}
            >
              <X className="h-6 w-6" />
            </div>
            <span className="font-semibold text-lg">FAUX</span>
          </div>
        </button>
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
          <Button
            variant="outline"
            onClick={onPrevious}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Précédent
          </Button>
        )}

        {!hasAnswered ? (
          <Button
            onClick={handleValidate}
            disabled={selectedAnswer === null}
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
