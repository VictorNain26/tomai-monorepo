/**
 * ClassificationViewer - Composant de classification par catégories
 * Drag & drop ou click pour classer des éléments dans des catégories
 * Idéal pour SVT (classification du vivant, organes, etc.)
 */

import { type ReactElement, useState, useCallback, useMemo } from 'react';
import { Check, ChevronLeft, RotateCcw, X, FolderOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MathContent } from '@/components/MathContent';
import { cn } from '@/lib/utils';
import type { IClassificationContent } from '@/types';

interface ClassificationViewerProps {
  content: IClassificationContent;
  onNext: () => void;
  onPrevious?: () => void;
  isLast: boolean;
  isFirst?: boolean;
}

export function ClassificationViewer({ content, onNext, onPrevious, isLast, isFirst }: ClassificationViewerProps): ReactElement {
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [classification, setClassification] = useState<Map<string, number[]>>(new Map());
  const [hasAnswered, setHasAnswered] = useState(false);

  // Check if all items are classified
  const classifiedItems = useMemo(() => new Set(
    Array.from(classification.values()).flat()
  ), [classification]);
  const isComplete = classifiedItems.size === content.items.length;

  // Check correctness
  const isItemCorrectlyClassified = (category: string, itemIndex: number): boolean => {
    const correctItems = content.correctClassification[category];
    return correctItems?.includes(itemIndex) ?? false;
  };

  const allCorrect = isComplete && content.categories.every(category => {
    const userItems = classification.get(category) ?? [];
    const correctItems = content.correctClassification[category] ?? [];
    return (
      userItems.length === correctItems.length &&
      userItems.every(item => correctItems.includes(item))
    );
  });

  const handleItemClick = useCallback((index: number) => {
    if (hasAnswered || classifiedItems.has(index)) return;
    setSelectedItem(selectedItem === index ? null : index);
  }, [hasAnswered, classifiedItems, selectedItem]);

  const handleCategoryClick = useCallback((category: string) => {
    if (hasAnswered || selectedItem === null) return;

    const newClassification = new Map(classification);
    const categoryItems = newClassification.get(category) ?? [];
    newClassification.set(category, [...categoryItems, selectedItem]);
    setClassification(newClassification);
    setSelectedItem(null);
  }, [hasAnswered, classification, selectedItem]);

  const handleRemoveFromCategory = (category: string, itemIndex: number) => {
    if (hasAnswered) return;

    const newClassification = new Map(classification);
    const categoryItems = newClassification.get(category) ?? [];
    newClassification.set(category, categoryItems.filter(i => i !== itemIndex));
    setClassification(newClassification);
  };

  const handleValidate = () => {
    setHasAnswered(true);
  };

  const handleReset = () => {
    setClassification(new Map());
    setSelectedItem(null);
    setHasAnswered(false);
  };

  const handleNext = () => {
    handleReset();
    onNext();
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto">
      {/* Instruction */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            <p className="text-lg font-medium text-foreground text-center">
              {content.instruction}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Items to classify */}
      <div className="flex flex-wrap justify-center gap-2">
        {content.items.map((item, itemIndex) => {
          if (classifiedItems.has(itemIndex)) return null;
          const isSelected = selectedItem === itemIndex;

          return (
            <button
              key={`item-${item}`}
              className={cn(
                'px-4 py-2 rounded-lg border-2 font-medium transition-all',
                'hover:border-primary/50 hover:bg-primary/5',
                isSelected && 'border-primary bg-primary/10 ring-2 ring-primary/30',
                !isSelected && 'border-border bg-background',
                hasAnswered && 'cursor-default'
              )}
              onClick={() => handleItemClick(itemIndex)}
              disabled={hasAnswered}
            >
              {item}
            </button>
          );
        })}
        {isComplete && !hasAnswered && (
          <p className="text-muted-foreground italic">Tous les éléments sont classés</p>
        )}
      </div>

      {/* Categories - grid adaptatif selon le nombre */}
      <div className={cn(
        'grid gap-4',
        content.categories.length === 2 && 'grid-cols-1 sm:grid-cols-2',
        content.categories.length === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        content.categories.length >= 4 && 'grid-cols-2 lg:grid-cols-4'
      )}>
        {content.categories.map((category) => {
          const itemsInCategory = classification.get(category) ?? [];
          const hasSelectedItem = selectedItem !== null;

          return (
            <div
              key={`category-${category}`}
              className={cn(
                'p-4 rounded-lg border-2 transition-all min-h-[120px]',
                hasSelectedItem && !hasAnswered && 'cursor-pointer hover:border-primary/50 hover:bg-primary/5',
                !hasSelectedItem && 'cursor-default',
                itemsInCategory.length > 0 && !hasAnswered && 'border-blue-500/50 bg-blue-500/5',
                hasAnswered && 'cursor-default'
              )}
              onClick={() => handleCategoryClick(category)}
            >
              <h4 className="font-semibold text-foreground text-center mb-3 pb-2 border-b">
                {category}
              </h4>
              <div className="flex flex-wrap gap-1 justify-center">
                {itemsInCategory.map((itemIdx) => {
                  const item = content.items[itemIdx];
                  const correct = hasAnswered && isItemCorrectlyClassified(category, itemIdx);
                  const wrong = hasAnswered && !isItemCorrectlyClassified(category, itemIdx);

                  return (
                    <div
                      key={`placed-${itemIdx}`}
                      className={cn(
                        'px-2 py-1 rounded text-sm flex items-center gap-1',
                        !hasAnswered && 'bg-blue-500/20 text-blue-700 cursor-pointer hover:bg-blue-500/30',
                        correct && 'bg-green-500/20 text-green-700',
                        wrong && 'bg-red-500/20 text-red-700'
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFromCategory(category, itemIdx);
                      }}
                    >
                      {item}
                      {hasAnswered && (
                        correct
                          ? <Check className="h-3 w-3" />
                          : <X className="h-3 w-3" />
                      )}
                      {!hasAnswered && (
                        <X className="h-3 w-3 opacity-50 hover:opacity-100" />
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
          <CardContent className="p-4">
            {allCorrect ? (
              <div className="flex items-center justify-center gap-2 text-green-600">
                <Check className="h-5 w-5" />
                <span className="font-medium">Parfait ! Toutes les classifications sont correctes.</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-amber-600">
                  <X className="h-5 w-5" />
                  <span className="font-medium">Certains éléments sont mal classés.</span>
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
            <Button variant="outline" onClick={handleReset} disabled={classification.size === 0}>
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
