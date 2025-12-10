/**
 * FlashcardViewer - Composant de carte à retourner
 * Simple flip animation, pas de gamification
 * Support KaTeX pour formules mathématiques
 */

import { type ReactElement, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MathContent } from '@/components/MathContent';
import type { IFlashcardContent } from '@/types';

interface FlashcardViewerProps {
  content: IFlashcardContent;
  onNext: () => void;
  isLast: boolean;
}

export function FlashcardViewer({ content, onNext, isLast }: FlashcardViewerProps): ReactElement {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleNext = () => {
    setIsFlipped(false);
    onNext();
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-xl mx-auto">
      {/* Flashcard */}
      <div
        className="w-full aspect-[3/2] cursor-pointer perspective-1000"
        onClick={handleFlip}
      >
        <div
          className={`relative w-full h-full transition-transform duration-500 transform-style-preserve-3d ${
            isFlipped ? 'rotate-y-180' : ''
          }`}
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Front */}
          <Card
            className="absolute inset-0 backface-hidden flex items-center justify-center p-6"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <CardContent className="p-0 text-center">
              <MathContent
                content={content.front}
                className="text-xl md:text-2xl font-medium text-foreground"
                centered
              />
              <p className="text-sm text-muted-foreground mt-4">
                Clique pour retourner
              </p>
            </CardContent>
          </Card>

          {/* Back */}
          <Card
            className="absolute inset-0 backface-hidden flex items-center justify-center p-6 bg-primary/5 border-primary/20"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <CardContent className="p-0 text-center">
              <MathContent
                content={content.back}
                className="text-xl md:text-2xl font-medium text-foreground"
                centered
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleFlip}
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          Retourner
        </Button>

        {isFlipped && (
          <Button onClick={handleNext}>
            {isLast ? 'Terminer' : 'Suivant'}
          </Button>
        )}
      </div>
    </div>
  );
}
