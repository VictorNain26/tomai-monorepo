/**
 * MatchingViewer - Composant d'association mot-traduction
 * Drag & drop ou click pour associer des paires
 * Idéal pour langues vivantes (vocabulaire)
 */

import { type ReactElement, useState, useMemo, useCallback } from 'react';
import { Check, ChevronLeft, RotateCcw } from 'lucide-react';
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

export function MatchingViewer({ content, onNext, onPrevious, isLast, isFirst }: MatchingViewerProps): ReactElement {
  // Shuffle right side items
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

  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [selectedRight, setSelectedRight] = useState<number | null>(null);
  const [matches, setMatches] = useState<Map<number, number>>(new Map()); // leftIndex -> rightIndex
  const [hasValidated, setHasValidated] = useState(false);

  const isComplete = matches.size === content.pairs.length;
  const allCorrect = isComplete && Array.from(matches.entries()).every(([left, right]) => left === right);

  const handleLeftClick = useCallback((index: number) => {
    if (hasValidated || matches.has(index)) return;
    setSelectedLeft(selectedLeft === index ? null : index);
  }, [hasValidated, matches, selectedLeft]);

  const handleRightClick = useCallback((originalIndex: number) => {
    if (hasValidated || Array.from(matches.values()).includes(originalIndex)) return;

    if (selectedLeft !== null) {
      // Make a match
      const newMatches = new Map(matches);
      newMatches.set(selectedLeft, originalIndex);
      setMatches(newMatches);

      setSelectedLeft(null);
      setSelectedRight(null);
    } else {
      setSelectedRight(selectedRight === originalIndex ? null : originalIndex);
    }
  }, [hasValidated, matches, selectedLeft, selectedRight]);

  const handleValidate = () => {
    setHasValidated(true);
  };

  const handleReset = () => {
    setMatches(new Map());
    setSelectedLeft(null);
    setSelectedRight(null);
    setHasValidated(false);
  };

  const handleNext = () => {
    handleReset();
    onNext();
  };

  const getLeftStyle = (index: number) => {
    const isSelected = selectedLeft === index;
    const isMatched = matches.has(index);
    const matchedTo = matches.get(index);
    const isCorrect = hasValidated && matchedTo === index;
    const isWrong = hasValidated && isMatched && matchedTo !== index;

    return cn(
      'p-3 rounded-lg border-2 cursor-pointer transition-all text-center',
      'hover:border-primary/50 hover:bg-primary/5',
      isSelected && 'border-primary bg-primary/10',
      isMatched && !hasValidated && 'border-blue-500 bg-blue-500/10',
      isCorrect && 'border-green-500 bg-green-500/10',
      isWrong && 'border-red-500 bg-red-500/10',
      (hasValidated || isMatched) && 'cursor-default'
    );
  };

  const getRightStyle = (originalIndex: number) => {
    const isSelected = selectedRight === originalIndex;
    const isMatched = Array.from(matches.values()).includes(originalIndex);
    const matchedFrom = Array.from(matches.entries()).find(([_, v]) => v === originalIndex)?.[0];
    const isCorrect = hasValidated && matchedFrom === originalIndex;
    const isWrong = hasValidated && isMatched && matchedFrom !== originalIndex;

    return cn(
      'p-3 rounded-lg border-2 cursor-pointer transition-all text-center',
      'hover:border-primary/50 hover:bg-primary/5',
      isSelected && 'border-primary bg-primary/10',
      isMatched && !hasValidated && 'border-blue-500 bg-blue-500/10',
      isCorrect && 'border-green-500 bg-green-500/10',
      isWrong && 'border-red-500 bg-red-500/10',
      (hasValidated || isMatched) && 'cursor-default'
    );
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

      {/* Matching columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1 text-center sm:text-left">
            À associer
          </span>
          {content.pairs.map((pair) => {
            const index = content.pairs.indexOf(pair);
            return (
            <button
              key={`left-${pair.left}-${pair.right}`}
              className={cn(getLeftStyle(index), 'w-full')}
              onClick={() => handleLeftClick(index)}
              disabled={hasValidated || matches.has(index)}
              aria-label={`Sélectionner ${pair.left}`}
              aria-pressed={selectedLeft === index}
            >
              <span className="font-medium">{pair.left}</span>
            </button>
            );
          })}
        </div>

        {/* Right column (shuffled) */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1 text-center sm:text-left">
            Correspondance
          </span>
          {shuffledRightIndices.map((originalIndex) => {
            const pair = content.pairs[originalIndex];
            if (!pair) return null;
            return (
              <button
                key={`right-${originalIndex}-${pair.right}`}
                className={cn(getRightStyle(originalIndex), 'w-full')}
                onClick={() => handleRightClick(originalIndex)}
                disabled={hasValidated || Array.from(matches.values()).includes(originalIndex)}
                aria-label={`Associer avec ${pair.right}`}
                aria-pressed={selectedRight === originalIndex}
              >
                <span className="font-medium">{pair.right}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Result feedback */}
      {hasValidated && (
        <Card className={cn(
          'border',
          allCorrect ? 'border-green-500/30 bg-green-500/5' : 'border-amber-500/30 bg-amber-500/5'
        )}>
          <CardContent className="p-4 text-center">
            {allCorrect ? (
              <div className="flex items-center justify-center gap-2 text-green-600">
                <Check className="h-5 w-5" />
                <span className="font-medium">Parfait ! Toutes les associations sont correctes.</span>
              </div>
            ) : (
              <span className="text-amber-600 font-medium">
                Certaines associations sont incorrectes. Les bonnes réponses sont affichées en vert.
              </span>
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
