/**
 * CardViewer - Dispatcher for all card types
 * Routes to the appropriate viewer based on card type
 */

import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import type { CardType } from '@/hooks';

import {
  FlashcardViewer,
  QCMViewer,
  VraiFauxViewer,
  ConceptViewer,
  MatchingViewer,
  FillBlankViewer,
  WordOrderViewer,
  CalculationViewer,
  TimelineViewer,
  MatchingEraViewer,
  CauseEffectViewer,
  ClassificationViewer,
  ProcessOrderViewer,
  GrammarTransformViewer,
  type FlashcardContent,
  type QCMContent,
  type VraiFauxContent,
  type ConceptContent,
  type MatchingContent,
  type FillBlankContent,
  type WordOrderContent,
  type CalculationContent,
  type TimelineContent,
  type MatchingEraContent,
  type CauseEffectContent,
  type ClassificationContent,
  type ProcessOrderContent,
  type GrammarTransformContent,
} from './viewers';

interface CardViewerProps {
  cardType: CardType;
  content: Record<string, unknown>;
}

export function CardViewer({ cardType, content }: CardViewerProps) {
  switch (cardType) {
    // Pedagogical
    case 'concept':
      return <ConceptViewer content={content as unknown as ConceptContent} />;

    // Universal
    case 'flashcard':
      return <FlashcardViewer content={content as unknown as FlashcardContent} />;
    case 'qcm':
      return <QCMViewer content={content as unknown as QCMContent} />;
    case 'vrai_faux':
      return <VraiFauxViewer content={content as unknown as VraiFauxContent} />;

    // Languages
    case 'matching':
      return <MatchingViewer content={content as unknown as MatchingContent} />;
    case 'fill_blank':
      return <FillBlankViewer content={content as unknown as FillBlankContent} />;
    case 'word_order':
      return <WordOrderViewer content={content as unknown as WordOrderContent} />;

    // Math/Science
    case 'calculation':
      return <CalculationViewer content={content as unknown as CalculationContent} />;

    // History-Geography
    case 'timeline':
      return <TimelineViewer content={content as unknown as TimelineContent} />;
    case 'matching_era':
      return <MatchingEraViewer content={content as unknown as MatchingEraContent} />;
    case 'cause_effect':
      return <CauseEffectViewer content={content as unknown as CauseEffectContent} />;

    // SVT/Sciences
    case 'classification':
      return <ClassificationViewer content={content as unknown as ClassificationContent} />;
    case 'process_order':
      return <ProcessOrderViewer content={content as unknown as ProcessOrderContent} />;

    // French
    case 'grammar_transform':
      return <GrammarTransformViewer content={content as unknown as GrammarTransformContent} />;

    default:
      return (
        <View className="flex-1 items-center justify-center rounded-xl bg-white dark:bg-slate-800 p-6">
          <Text variant="muted" className="text-center">
            Type de carte non supporté : {cardType}
          </Text>
        </View>
      );
  }
}
