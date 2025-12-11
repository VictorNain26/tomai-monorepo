/**
 * WordOrderViewer - Composant de remise en ordre des mots
 * Click pour sélectionner les mots dans l'ordre correct
 * Idéal pour langues vivantes (syntaxe, structure de phrase)
 */

import { type ReactElement, useState, useMemo } from 'react';
import { Check, ChevronLeft, RotateCcw, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { IWordOrderContent } from '@/types';

interface WordOrderViewerProps {
  content: IWordOrderContent;
  onNext: () => void;
  onPrevious?: () => void;
  isLast: boolean;
  isFirst?: boolean;
}

export function WordOrderViewer({ content, onNext, onPrevious, isLast, isFirst }: WordOrderViewerProps): ReactElement {
  // Shuffle words on mount
  const shuffledWords = useMemo(() => {
    const indices = content.words.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = indices[i];
      indices[i] = indices[j] as number;
      indices[j] = temp as number;
    }
    return indices.map(i => ({ word: content.words[i] ?? '', originalIndex: i }));
  }, [content.words]);

  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [hasAnswered, setHasAnswered] = useState(false);

  const selectedWords = selectedIndices.map(i => {
    const item = shuffledWords.find(sw => sw.originalIndex === i);
    return item?.word ?? '';
  });
  const currentSentence = selectedWords.join(' ');
  const isCorrect = currentSentence.toLowerCase() === content.correctSentence.toLowerCase();
  const isComplete = selectedIndices.length === content.words.length;

  const handleWordClick = (originalIndex: number) => {
    if (hasAnswered) return;

    if (selectedIndices.includes(originalIndex)) {
      // Remove word and all words after it
      const wordIndex = selectedIndices.indexOf(originalIndex);
      setSelectedIndices(selectedIndices.slice(0, wordIndex));
    } else {
      // Add word
      setSelectedIndices([...selectedIndices, originalIndex]);
    }
  };

  const handleValidate = () => {
    if (!isComplete) return;
    setHasAnswered(true);
  };

  const handleReset = () => {
    setSelectedIndices([]);
    setHasAnswered(false);
  };

  const handleNext = () => {
    setSelectedIndices([]);
    setHasAnswered(false);
    onNext();
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto">
      {/* Instruction */}
      <Card>
        <CardContent className="p-4">
          <p className="text-lg font-medium text-foreground text-center">
            {content.instruction}
          </p>
        </CardContent>
      </Card>

      {/* Current sentence being built */}
      <Card className={cn(
        'border-2 border-dashed min-h-[80px]',
        hasAnswered && isCorrect && 'border-green-500 bg-green-500/5',
        hasAnswered && !isCorrect && 'border-red-500 bg-red-500/5',
        !hasAnswered && 'border-primary/30'
      )}>
        <CardContent className="p-4">
          {selectedWords.length > 0 ? (
            <p className="text-xl font-medium text-foreground text-center">
              {currentSentence}
              {!isComplete && <span className="text-muted-foreground animate-pulse">|</span>}
            </p>
          ) : (
            <p className="text-muted-foreground text-center italic">
              Clique sur les mots pour construire la phrase
            </p>
          )}
        </CardContent>
      </Card>

      {/* Available words */}
      <div className="flex flex-wrap justify-center gap-2">
        {shuffledWords.map(({ word, originalIndex }) => {
          const isSelected = selectedIndices.includes(originalIndex);
          const position = selectedIndices.indexOf(originalIndex);

          return (
            <button
              key={`word-${originalIndex}-${word}`}
              className={cn(
                'px-4 py-2 rounded-lg border-2 font-medium transition-all',
                'hover:border-primary/50 hover:bg-primary/5',
                isSelected && 'border-primary bg-primary text-primary-foreground',
                !isSelected && 'border-border bg-background',
                hasAnswered && 'cursor-default opacity-70'
              )}
              onClick={() => handleWordClick(originalIndex)}
              disabled={hasAnswered}
            >
              {isSelected && (
                <span className="mr-1 text-xs opacity-70">{position + 1}.</span>
              )}
              {word}
            </button>
          );
        })}
      </div>

      {/* Result and translation */}
      {hasAnswered && (
        <Card className={cn(
          'border',
          isCorrect ? 'border-green-500/30 bg-green-500/5' : 'border-amber-500/30 bg-amber-500/5'
        )}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-center gap-2">
              {isCorrect ? (
                <>
                  <Check className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-600">Correct !</span>
                </>
              ) : (
                <>
                  <X className="h-5 w-5 text-red-600" />
                  <span className="font-medium text-red-600">
                    La bonne réponse : {content.correctSentence}
                  </span>
                </>
              )}
            </div>
            {content.translation && (
              <p className="text-sm text-muted-foreground text-center">
                <span className="font-medium">Traduction : </span>
                {content.translation}
              </p>
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
            <Button variant="outline" onClick={handleReset} disabled={selectedIndices.length === 0}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Réinitialiser
            </Button>
            <Button onClick={handleValidate} disabled={!isComplete}>
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
