/**
 * CalculationViewer - Composant de calcul avec étapes
 * Affiche le problème, puis révèle les étapes une par une
 * Idéal pour mathématiques et physique-chimie
 */

import { type ReactElement, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Lightbulb } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MathContent } from '@/components/MathContent';
import { cn } from '@/lib/utils';
import { getRandomEncouragement } from './encouragements';
import type { ICalculationContent } from '@/types';

interface CalculationViewerProps {
  content: ICalculationContent;
  onNext: () => void;
  onPrevious?: () => void;
  isLast: boolean;
  isFirst?: boolean;
}

export function CalculationViewer({ content, onNext, onPrevious, isLast, isFirst }: CalculationViewerProps): ReactElement {
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [encouragement, setEncouragement] = useState<string | null>(null);

  const totalSteps = content.steps.length;
  const allStepsRevealed = visibleSteps >= totalSteps;

  const handleShowNextStep = () => {
    if (visibleSteps < totalSteps) {
      setVisibleSteps(visibleSteps + 1);
    }
  };

  const handleShowAnswer = () => {
    setShowAnswer(true);
    setVisibleSteps(totalSteps);
    setEncouragement(getRandomEncouragement());
  };

  const handleNext = () => {
    setVisibleSteps(0);
    setShowHint(false);
    setShowAnswer(false);
    setEncouragement(null);
    onNext();
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto">
      {/* Problem statement */}
      <Card className="border-primary/20">
        <CardContent className="p-6">
          <MathContent
            content={content.problem}
            className="text-xl font-medium text-foreground"
            centered
          />
        </CardContent>
      </Card>

      {/* Hint button (if available) */}
      {content.hint && !showHint && !showAnswer && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowHint(true)}
          className="self-center"
        >
          <Lightbulb className="h-4 w-4 mr-1" />
          Voir l'indice
        </Button>
      )}

      {/* Hint display */}
      {showHint && content.hint && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <Lightbulb className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-700">
                <span className="font-medium">Indice : </span>
                {content.hint}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Steps */}
      {visibleSteps > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Étapes de résolution :
          </h3>
          {content.steps.slice(0, visibleSteps).map((step, stepIndex) => (
            <Card
              key={`step-${step.slice(0, 30).replace(/\s+/g, '-')}`}
              className={cn(
                'transition-all duration-300',
                stepIndex === visibleSteps - 1 && 'ring-2 ring-primary/20'
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium flex items-center justify-center">
                    {stepIndex + 1}
                  </span>
                  <MathContent content={step} className="flex-1 text-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Show next step button */}
      {!allStepsRevealed && !showAnswer && (
        <Button
          variant="outline"
          onClick={handleShowNextStep}
          className="self-center"
        >
          <ChevronRight className="h-4 w-4 mr-1" />
          {visibleSteps === 0 ? 'Voir la première étape' : 'Étape suivante'}
          <span className="ml-2 text-xs text-muted-foreground">
            ({visibleSteps}/{totalSteps})
          </span>
        </Button>
      )}

      {/* Answer */}
      {showAnswer && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-6">
            <div className="text-center">
              <span className="text-sm font-medium text-green-600 block mb-2">
                Réponse finale
              </span>
              <MathContent
                content={content.answer}
                className="text-2xl font-bold text-green-700"
                centered
              />
              {encouragement && (
                <p className="text-sm text-green-600 font-medium mt-3">{encouragement}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Show answer button */}
      {!showAnswer && (
        <Button
          variant="default"
          onClick={handleShowAnswer}
          className="self-center"
        >
          <Eye className="h-4 w-4 mr-1" />
          Voir la réponse
        </Button>
      )}

      {/* Actions */}
      <div className="flex justify-center gap-3 pt-4">
        {!isFirst && onPrevious && (
          <Button variant="outline" onClick={onPrevious}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Précédent
          </Button>
        )}

        {showAnswer && (
          <Button onClick={handleNext}>
            {isLast ? 'Terminer' : 'Suivant'}
          </Button>
        )}
      </div>
    </div>
  );
}
