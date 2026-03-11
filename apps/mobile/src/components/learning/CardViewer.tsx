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

/** Type-narrow untyped API content to a specific card content type */
function castContent<T>(content: Record<string, unknown>): T {
  return content as unknown as T;
}

interface CardViewerProps {
  cardType: CardType;
  /** Content from API — runtime shape depends on cardType */
  content: Record<string, unknown>;
}

export function CardViewer({ cardType, content }: CardViewerProps) {
  switch (cardType) {
    case 'concept':
      return <ConceptViewer content={castContent<ConceptContent>(content)} />;
    case 'flashcard':
      return <FlashcardViewer content={castContent<FlashcardContent>(content)} />;
    case 'qcm':
      return <QCMViewer content={castContent<QCMContent>(content)} />;
    case 'vrai_faux':
      return <VraiFauxViewer content={castContent<VraiFauxContent>(content)} />;
    case 'matching':
      return <MatchingViewer content={castContent<MatchingContent>(content)} />;
    case 'fill_blank':
      return <FillBlankViewer content={castContent<FillBlankContent>(content)} />;
    case 'word_order':
      return <WordOrderViewer content={castContent<WordOrderContent>(content)} />;
    case 'calculation':
      return <CalculationViewer content={castContent<CalculationContent>(content)} />;
    case 'timeline':
      return <TimelineViewer content={castContent<TimelineContent>(content)} />;
    case 'matching_era':
      return <MatchingEraViewer content={castContent<MatchingEraContent>(content)} />;
    case 'cause_effect':
      return <CauseEffectViewer content={castContent<CauseEffectContent>(content)} />;
    case 'classification':
      return <ClassificationViewer content={castContent<ClassificationContent>(content)} />;
    case 'process_order':
      return <ProcessOrderViewer content={castContent<ProcessOrderContent>(content)} />;
    case 'grammar_transform':
      return <GrammarTransformViewer content={castContent<GrammarTransformContent>(content)} />;
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
