/**
 * ClassificationViewer - Composant de classification par catégories
 * Drag & drop ou click pour classer des éléments dans des catégories
 * Idéal pour SVT (classification du vivant, organes, etc.)
 */

import { useState, useCallback, useMemo, type ReactElement } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { Check, ChevronLeft, X, FolderOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MathContent } from '@/components/MathContent';
import { cn } from '@/lib/utils';
import type { IClassificationContent } from '@/types';
import {
  DraggableItem,
  PlacedDraggableItem,
  DroppableCategory,
  SourceDropZone,
  DragOverlayContent,
} from './classification/ClassificationDndItems';

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
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

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

  // Get active item text for overlay
  const getActiveItemText = (): string | null => {
    if (!activeId) return null;
    const index = parseInt(activeId.replace('item-', '').replace('placed-', ''));
    return content.items[index] ?? null;
  };
  const activeItemText = getActiveItemText();

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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setSelectedItem(null); // Clear selection when dragging
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;
    const itemIndex = parseInt(activeIdStr.replace('item-', '').replace('placed-', ''));

    // Find which category this item is currently in (if any)
    let sourceCategory: string | null = null;
    for (const [cat, items] of classification.entries()) {
      if (items.includes(itemIndex)) {
        sourceCategory = cat;
        break;
      }
    }

    // If dropped on source zone, remove from current category
    if (overIdStr === 'source-zone') {
      if (sourceCategory) {
        const newClassification = new Map(classification);
        const categoryItems = newClassification.get(sourceCategory) ?? [];
        newClassification.set(sourceCategory, categoryItems.filter(i => i !== itemIndex));
        setClassification(newClassification);
      }
      return;
    }

    // If dropped on a category
    if (overIdStr.startsWith('category-')) {
      const targetCategory = overIdStr.replace('category-', '');

      // Same category, do nothing
      if (sourceCategory === targetCategory) return;

      const newClassification = new Map(classification);

      // Remove from source category if any
      if (sourceCategory) {
        const sourceItems = newClassification.get(sourceCategory) ?? [];
        newClassification.set(sourceCategory, sourceItems.filter(i => i !== itemIndex));
      }

      // Add to target category
      const targetItems = newClassification.get(targetCategory) ?? [];
      if (!targetItems.includes(itemIndex)) {
        newClassification.set(targetCategory, [...targetItems, itemIndex]);
      }

      setClassification(newClassification);
    }
  };

  const handleValidate = () => {
    setHasAnswered(true);
  };

  const handleNext = () => {
    setClassification(new Map());
    setSelectedItem(null);
    setHasAnswered(false);
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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Items to classify */}
        <SourceDropZone isActive={!!activeId && activeId.startsWith('placed-') && !hasAnswered}>
          {content.items.map((item, itemIndex) => {
            if (classifiedItems.has(itemIndex)) return null;
            const isSelected = selectedItem === itemIndex;

            return (
              <DraggableItem
                key={`item-${item}`}
                id={`item-${itemIndex}`}
                text={item}
                isSelected={isSelected}
                disabled={hasAnswered}
                onClick={() => handleItemClick(itemIndex)}
              />
            );
          })}
          {isComplete && !hasAnswered && !activeId && (
            <p className="text-muted-foreground italic">Tous les éléments sont classés</p>
          )}
        </SourceDropZone>

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
              <DroppableCategory
                key={`category-${category}`}
                category={category}
                hasSelectedItem={hasSelectedItem}
                hasItems={itemsInCategory.length > 0}
                disabled={hasAnswered}
                onClick={() => handleCategoryClick(category)}
              >
                {itemsInCategory.map((itemIdx) => {
                  const item = content.items[itemIdx];
                  const correct = hasAnswered && isItemCorrectlyClassified(category, itemIdx);
                  const wrong = hasAnswered && !isItemCorrectlyClassified(category, itemIdx);

                  return (
                    <PlacedDraggableItem
                      key={`placed-${itemIdx}`}
                      id={`placed-${itemIdx}`}
                      text={item ?? ''}
                      isCorrect={correct}
                      isWrong={wrong}
                      disabled={hasAnswered}
                      onRemove={() => handleRemoveFromCategory(category, itemIdx)}
                    />
                  );
                })}
              </DroppableCategory>
            );
          })}
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {activeId && activeItemText ? (
            <DragOverlayContent text={activeItemText} />
          ) : null}
        </DragOverlay>
      </DndContext>

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
          <Button onClick={handleValidate} disabled={!isComplete}>
            Valider
          </Button>
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
