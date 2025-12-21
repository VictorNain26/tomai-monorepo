/**
 * ConceptViewer - Carte d'explication théorique
 * Affiche une notion avant les exercices pratiques
 * Support KaTeX pour formules mathématiques
 */

import type { ReactElement } from 'react';
import { Lightbulb, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MathContent } from '@/components/MathContent';
import type { IConceptContent } from '@/types';

interface ConceptViewerProps {
  content: IConceptContent;
  onNext: () => void;
  onPrevious?: () => void;
  isLast: boolean;
  isFirst?: boolean;
}

export function ConceptViewer({
  content,
  onNext,
  onPrevious,
  isLast,
  isFirst,
}: ConceptViewerProps): ReactElement {
  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-2xl mx-auto">
      <Card className="w-full border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 text-primary">
            <Lightbulb className="h-5 w-5" />
            <span className="text-sm font-medium uppercase tracking-wide">
              Notion
            </span>
          </div>
          <CardTitle className="text-xl md:text-2xl font-semibold mt-2">
            <MathContent content={content.title} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Explanation */}
          <div className="text-base text-foreground leading-relaxed">
            <MathContent content={content.explanation} />
          </div>

          {/* Key Points */}
          <div className="bg-background/50 rounded-lg p-4 border border-border/50">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
              <BookOpen className="h-4 w-4" />
              Points clés
            </div>
            <ul className="space-y-2">
              {content.keyPoints.map((point: string) => (
                <li
                  key={point.slice(0, 50)}
                  className="flex items-start gap-2 text-sm text-foreground"
                >
                  <span className="text-primary font-medium mt-0.5">•</span>
                  <MathContent content={point} />
                </li>
              ))}
            </ul>
          </div>

          {/* Formula (if present) */}
          {content.formula && (
            <div className="bg-muted/30 rounded-lg p-4 text-center">
              <MathContent
                content={content.formula}
                className="text-lg font-medium"
                centered
              />
            </div>
          )}

          {/* Example (if present) */}
          {content.example && (
            <div className="border-l-4 border-primary/30 pl-4 py-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Exemple
              </p>
              <MathContent
                content={content.example}
                className="text-sm text-foreground"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-3">
        {!isFirst && onPrevious && (
          <Button variant="outline" onClick={onPrevious}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Précédent
          </Button>
        )}
        <Button onClick={onNext}>
          {isLast ? 'Terminer' : 'Compris !'}
          {!isLast && <ChevronRight className="h-4 w-4 ml-1" />}
        </Button>
      </div>
    </div>
  );
}
