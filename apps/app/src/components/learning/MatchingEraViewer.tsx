/**
 * MatchingEraViewer - Composant d'association personnage/événement ↔ époque
 * Click pour associer des éléments à leur période historique
 * Idéal pour histoire-géographie
 */

import { type ReactElement, useState, useCallback } from 'react';
import { Check, ChevronLeft, RotateCcw, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { IMatchingEraContent } from '@/types';

interface MatchingEraViewerProps {
  content: IMatchingEraContent;
  onNext: () => void;
  onPrevious?: () => void;
  isLast: boolean;
  isFirst?: boolean;
}

export function MatchingEraViewer({ content, onNext, onPrevious, isLast, isFirst }: MatchingEraViewerProps): ReactElement {
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [matches, setMatches] = useState<Map<number, number>>(new Map()); // itemIndex -> eraIndex
  const [hasAnswered, setHasAnswered] = useState(false);

  const isComplete = matches.size === content.items.length;

  // Check correctness
  const getCorrectEraForItem = (itemIndex: number): number | undefined => {
    const pair = content.correctPairs.find(([item]) => item === itemIndex);
    return pair?.[1];
  };

  const isItemCorrect = (itemIndex: number): boolean => {
    const userEra = matches.get(itemIndex);
    const correctEra = getCorrectEraForItem(itemIndex);
    return userEra === correctEra;
  };

  const allCorrect = isComplete && content.items.every((_, i) => isItemCorrect(i));

  const handleItemClick = useCallback((index: number) => {
    if (hasAnswered || matches.has(index)) return;
    setSelectedItem(selectedItem === index ? null : index);
  }, [hasAnswered, matches, selectedItem]);

  const handleEraClick = useCallback((eraIndex: number) => {
    if (hasAnswered || selectedItem === null) return;

    const newMatches = new Map(matches);
    newMatches.set(selectedItem, eraIndex);
    setMatches(newMatches);
    setSelectedItem(null);
  }, [hasAnswered, matches, selectedItem]);

  const handleValidate = () => {
    setHasAnswered(true);
  };

  const handleReset = () => {
    setMatches(new Map());
    setSelectedItem(null);
    setHasAnswered(false);
  };

  const handleNext = () => {
    handleReset();
    onNext();
  };

  const getItemStyle = (index: number) => {
    const isSelected = selectedItem === index;
    const isMatched = matches.has(index);
    const correct = hasAnswered && isMatched && isItemCorrect(index);
    const wrong = hasAnswered && isMatched && !isItemCorrect(index);

    return cn(
      'p-3 rounded-lg border-2 cursor-pointer transition-all text-center',
      'hover:border-primary/50 hover:bg-primary/5',
      isSelected && 'border-primary bg-primary/10 ring-2 ring-primary/30',
      isMatched && !hasAnswered && 'border-blue-500 bg-blue-500/10',
      correct && 'border-green-500 bg-green-500/10',
      wrong && 'border-red-500 bg-red-500/10',
      (hasAnswered || isMatched) && 'cursor-default'
    );
  };

  const getEraStyle = (eraIndex: number) => {
    const itemsInEra = Array.from(matches.entries())
      .filter(([_, era]) => era === eraIndex)
      .map(([item]) => item);

    const hasItems = itemsInEra.length > 0;
    const hasSelectedItem = selectedItem !== null;

    return cn(
      'p-4 rounded-lg border-2 transition-all min-h-[100px]',
      hasSelectedItem && !hasAnswered && 'cursor-pointer hover:border-primary/50 hover:bg-primary/5',
      !hasSelectedItem && 'cursor-default',
      hasItems && !hasAnswered && 'border-blue-500/50 bg-blue-500/5',
      hasAnswered && 'cursor-default'
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

      {/* Items to match */}
      <div className="flex flex-wrap justify-center gap-2">
        {content.items.map((item, itemIndex) => {
          if (matches.has(itemIndex)) return null; // Hide matched items from pool
          return (
            <button
              key={`item-${item}`}
              className={getItemStyle(itemIndex)}
              onClick={() => handleItemClick(itemIndex)}
              disabled={hasAnswered}
            >
              <span className="font-medium">{item}</span>
            </button>
          );
        })}
        {matches.size === content.items.length && !hasAnswered && (
          <p className="text-muted-foreground italic">Tous les éléments sont placés</p>
        )}
      </div>

      {/* Eras - grid adaptatif selon le nombre */}
      <div className={cn(
        'grid gap-3',
        content.eras.length === 2 && 'grid-cols-1 sm:grid-cols-2',
        content.eras.length === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        content.eras.length >= 4 && 'grid-cols-2 lg:grid-cols-4'
      )}>
        {content.eras.map((era, eraIndex) => {
          const itemsInEra = Array.from(matches.entries())
            .filter(([_, e]) => e === eraIndex)
            .map(([itemIdx]) => itemIdx);

          return (
            <div
              key={`era-${era}`}
              className={getEraStyle(eraIndex)}
              onClick={() => handleEraClick(eraIndex)}
            >
              <h4 className="font-semibold text-foreground text-center mb-2 pb-2 border-b">
                {era}
              </h4>
              <div className="space-y-1">
                {itemsInEra.map((itemIdx) => {
                  const item = content.items[itemIdx];
                  const correct = hasAnswered && isItemCorrect(itemIdx);
                  const wrong = hasAnswered && !isItemCorrect(itemIdx);

                  return (
                    <div
                      key={`placed-${itemIdx}`}
                      className={cn(
                        'px-2 py-1 rounded text-sm text-center',
                        !hasAnswered && 'bg-blue-500/20 text-blue-700',
                        correct && 'bg-green-500/20 text-green-700',
                        wrong && 'bg-red-500/20 text-red-700'
                      )}
                    >
                      {item}
                      {hasAnswered && (
                        correct
                          ? <Check className="inline h-3 w-3 ml-1" />
                          : <X className="inline h-3 w-3 ml-1" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Result feedback */}
      {hasAnswered && (
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
                Certaines associations sont incorrectes. Les bonnes réponses sont indiquées en vert.
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

        {!hasAnswered && (
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

        {hasAnswered && (
          <Button onClick={handleNext}>
            {isLast ? 'Terminer' : 'Suivant'}
          </Button>
        )}
      </div>
    </div>
  );
}
