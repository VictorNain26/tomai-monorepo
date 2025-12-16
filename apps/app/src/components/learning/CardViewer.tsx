/**
 * CardViewer - Dispatcher pour les différents types de cartes d'apprentissage
 * Route vers le viewer approprié selon le type de carte
 */

import type { ReactElement } from 'react';
// Universal viewers
import { FlashcardViewer } from './FlashcardViewer';
import { QCMViewer } from './QCMViewer';
import { VraiFauxViewer } from './VraiFauxViewer';
// Language viewers
import { MatchingViewer } from './MatchingViewer';
import { FillBlankViewer } from './FillBlankViewer';
import { WordOrderViewer } from './WordOrderViewer';
// Math/Science viewers
import { CalculationViewer } from './CalculationViewer';
// History-Geo viewers
import { TimelineViewer } from './TimelineViewer';
import { MatchingEraViewer } from './MatchingEraViewer';
import { CauseEffectViewer } from './CauseEffectViewer';
// SVT viewers
import { ClassificationViewer } from './ClassificationViewer';
import { ProcessOrderViewer } from './ProcessOrderViewer';
// French viewers
import { GrammarTransformViewer } from './GrammarTransformViewer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type {
  ILearningCard,
  // Universal
  IFlashcardContent,
  IQCMContent,
  IVraiFauxContent,
  // Languages
  IMatchingContent,
  IFillBlankContent,
  IWordOrderContent,
  // Math/Sciences
  ICalculationContent,
  // History-Geo
  ITimelineContent,
  IMatchingEraContent,
  ICauseEffectContent,
  // SVT
  IClassificationContent,
  IProcessOrderContent,
  // French
  IGrammarTransformContent,
} from '@/types';

interface CardViewerProps {
  card: ILearningCard;
  onNext: () => void;
  onPrevious: () => void;
  isLast: boolean;
  isFirst: boolean;
}

export function CardViewer({
  card,
  onNext,
  onPrevious,
  isLast,
  isFirst,
}: CardViewerProps): ReactElement {
  switch (card.cardType) {
    // Universal types
    case 'flashcard':
      return (
        <FlashcardViewer
          content={card.content as IFlashcardContent}
          onNext={onNext}
          onPrevious={onPrevious}
          isLast={isLast}
          isFirst={isFirst}
        />
      );
    case 'qcm':
      return (
        <QCMViewer
          content={card.content as IQCMContent}
          onNext={onNext}
          onPrevious={onPrevious}
          isLast={isLast}
          isFirst={isFirst}
        />
      );
    case 'vrai_faux':
      return (
        <VraiFauxViewer
          content={card.content as IVraiFauxContent}
          onNext={onNext}
          onPrevious={onPrevious}
          isLast={isLast}
          isFirst={isFirst}
        />
      );

    // Language types
    case 'matching':
      return (
        <MatchingViewer
          content={card.content as IMatchingContent}
          onNext={onNext}
          onPrevious={onPrevious}
          isLast={isLast}
          isFirst={isFirst}
        />
      );
    case 'fill_blank':
      return (
        <FillBlankViewer
          content={card.content as IFillBlankContent}
          onNext={onNext}
          onPrevious={onPrevious}
          isLast={isLast}
          isFirst={isFirst}
        />
      );
    case 'word_order':
      return (
        <WordOrderViewer
          content={card.content as IWordOrderContent}
          onNext={onNext}
          onPrevious={onPrevious}
          isLast={isLast}
          isFirst={isFirst}
        />
      );

    // Math/Science types
    case 'calculation':
      return (
        <CalculationViewer
          content={card.content as ICalculationContent}
          onNext={onNext}
          onPrevious={onPrevious}
          isLast={isLast}
          isFirst={isFirst}
        />
      );

    // History-Geo types
    case 'timeline':
      return (
        <TimelineViewer
          content={card.content as ITimelineContent}
          onNext={onNext}
          onPrevious={onPrevious}
          isLast={isLast}
          isFirst={isFirst}
        />
      );
    case 'matching_era':
      return (
        <MatchingEraViewer
          content={card.content as IMatchingEraContent}
          onNext={onNext}
          onPrevious={onPrevious}
          isLast={isLast}
          isFirst={isFirst}
        />
      );
    case 'cause_effect':
      return (
        <CauseEffectViewer
          content={card.content as ICauseEffectContent}
          onNext={onNext}
          onPrevious={onPrevious}
          isLast={isLast}
          isFirst={isFirst}
        />
      );

    // SVT types
    case 'classification':
      return (
        <ClassificationViewer
          content={card.content as IClassificationContent}
          onNext={onNext}
          onPrevious={onPrevious}
          isLast={isLast}
          isFirst={isFirst}
        />
      );
    case 'process_order':
      return (
        <ProcessOrderViewer
          content={card.content as IProcessOrderContent}
          onNext={onNext}
          onPrevious={onPrevious}
          isLast={isLast}
          isFirst={isFirst}
        />
      );

    // French types
    case 'grammar_transform':
      return (
        <GrammarTransformViewer
          content={card.content as IGrammarTransformContent}
          onNext={onNext}
          onPrevious={onPrevious}
          isLast={isLast}
          isFirst={isFirst}
        />
      );

    default:
      return (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Type de carte non reconnu</p>
            <Button onClick={onNext} className="mt-4">
              Suivant
            </Button>
          </CardContent>
        </Card>
      );
  }
}
