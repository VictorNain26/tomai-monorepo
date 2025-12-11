/**
 * GrammarTransformViewer - Composant de transformation grammaticale
 * L'élève doit transformer une phrase selon une consigne
 * Idéal pour français (conjugaison, voix active/passive, etc.)
 */

import { useState, type ReactElement, type KeyboardEvent } from 'react';
import { Check, X, ChevronLeft, ArrowRight, Pen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MathContent } from '@/components/MathContent';
import { cn } from '@/lib/utils';
import type { IGrammarTransformContent } from '@/types';

interface GrammarTransformViewerProps {
  content: IGrammarTransformContent;
  onNext: () => void;
  onPrevious?: () => void;
  isLast: boolean;
  isFirst?: boolean;
}

const TRANSFORMATION_LABELS: Record<string, string> = {
  tense: 'Transformation de temps',
  voice: 'Transformation de voix',
  form: 'Transformation de forme',
  number: 'Transformation de nombre',
};

export function GrammarTransformViewer({ content, onNext, onPrevious, isLast, isFirst }: GrammarTransformViewerProps): ReactElement {
  const [userAnswer, setUserAnswer] = useState('');
  const [hasAnswered, setHasAnswered] = useState(false);

  // Normalize string for comparison
  const normalizeString = (str: string): string => {
    return str
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents for comparison
      .replace(/['']/g, "'") // Normalize apostrophes
      .replace(/\s+/g, ' '); // Normalize spaces
  };

  const checkAnswer = (): boolean => {
    const normalizedUser = normalizeString(userAnswer);
    const normalizedCorrect = normalizeString(content.correctAnswer);

    if (normalizedUser === normalizedCorrect) return true;

    // Check acceptable variants
    if (content.acceptableVariants) {
      return content.acceptableVariants.some(
        variant => normalizeString(variant) === normalizedUser
      );
    }

    return false;
  };

  const handleValidate = () => {
    if (!userAnswer.trim()) return;
    setHasAnswered(true);
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleValidate();
    }
  };

  const handleNext = () => {
    setUserAnswer('');
    setHasAnswered(false);
    onNext();
  };

  const isCorrect = checkAnswer();

  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto">
      {/* Transformation type badge */}
      <div className="flex justify-center">
        <span className="px-4 py-1.5 bg-primary/10 text-primary text-sm font-medium rounded-full flex items-center gap-2">
          <Pen className="h-4 w-4" />
          {TRANSFORMATION_LABELS[content.transformationType] ?? content.transformationType}
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

      {/* Original sentence */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6">
          <div className="text-center">
            <span className="text-xs font-semibold text-primary uppercase tracking-wide block mb-2">
              Phrase originale
            </span>
            <p className="text-xl font-medium text-foreground">
              {content.originalSentence}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Arrow */}
      <div className="flex justify-center">
        <ArrowRight className="h-6 w-6 text-muted-foreground" />
      </div>

      {/* Answer input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground block text-center">
          Ta réponse :
        </label>
        <Input
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Écris ta phrase transformée..."
          disabled={hasAnswered}
          className={cn(
            'text-lg text-center',
            hasAnswered && isCorrect && 'border-green-500 bg-green-500/10',
            hasAnswered && !isCorrect && 'border-red-500 bg-red-500/10'
          )}
          autoFocus
        />
      </div>

      {/* Result feedback */}
      {hasAnswered && (
        <Card className={cn(
          'border',
          isCorrect ? 'border-green-500/30 bg-green-500/5' : 'border-amber-500/30 bg-amber-500/5'
        )}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-center gap-2">
              {isCorrect ? (
                <>
                  <Check className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-600">Correct !</span>
                </>
              ) : (
                <>
                  <X className="h-5 w-5 text-red-600" />
                  <span className="font-medium text-red-600">Pas tout à fait...</span>
                </>
              )}
            </div>

            {!isCorrect && (
              <div className="text-center">
                <span className="text-sm text-muted-foreground">Bonne réponse : </span>
                <span className="font-medium text-foreground">{content.correctAnswer}</span>
              </div>
            )}

            {content.explanation && (
              <div className="text-sm text-muted-foreground text-center pt-2 border-t">
                <span className="font-medium text-foreground">Explication : </span>
                <MathContent content={content.explanation} className="inline" />
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

        {!hasAnswered ? (
          <Button onClick={handleValidate} disabled={!userAnswer.trim()}>
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
