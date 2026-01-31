/**
 * Universal Viewers - Flashcard, QCM, Vrai/Faux
 * Used across all subjects
 */

import { useState } from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { bgColors, borderColors } from '@/lib/styles';

// ============================================================================
// TYPES
// ============================================================================

export interface FlashcardContent {
  front: string;
  back: string;
}

export interface QCMContent {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface VraiFauxContent {
  statement: string;
  isTrue: boolean;
  explanation?: string;
}

// ============================================================================
// FEEDBACK BOX
// ============================================================================

function FeedbackBox({
  isCorrect,
  explanation,
}: {
  isCorrect: boolean;
  explanation?: string;
}) {
  return (
    <View className={`mt-4 rounded-xl p-4 ${isCorrect ? 'bg-green-100' : 'bg-red-100'}`}>
      <Text className={isCorrect ? 'text-green-700' : 'text-red-700'}>
        {isCorrect ? '✓ Bonne réponse !' : '✗ Mauvaise réponse'}
      </Text>
      {explanation && <Text className="mt-2 text-sm text-gray-700">{explanation}</Text>}
    </View>
  );
}

// ============================================================================
// FLASHCARD
// ============================================================================

export function FlashcardViewer({ content }: { content: FlashcardContent }) {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <TouchableOpacity
      onPress={() => setIsFlipped(!isFlipped)}
      className={`flex-1 items-center justify-center rounded-xl border p-6 ${
        isFlipped ? '' : 'border-border bg-card'
      }`}
      style={isFlipped ? { borderColor: borderColors.primary[30], backgroundColor: bgColors.primary[5] } : undefined}
      activeOpacity={0.8}
    >
      <Text className="mb-4 text-center text-lg leading-relaxed">
        {isFlipped ? content.back : content.front}
      </Text>
      <View className="mt-4 rounded-full bg-muted px-4 py-2">
        <Text variant="muted" className="text-sm">
          {isFlipped ? '↩️ Voir la question' : '👆 Appuie pour révéler'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ============================================================================
// QCM
// ============================================================================

export function QCMViewer({ content }: { content: QCMContent }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [validated, setValidated] = useState(false);
  const isCorrect = selected === content.correctIndex;

  return (
    <ScrollView className="flex-1">
      <Text className="mb-6 text-center text-lg font-medium">{content.question}</Text>

      <View className="gap-3">
        {content.options.map((option, index) => {
          const isSelected = selected === index;
          const isCorrectOption = index === content.correctIndex;

          let bgClass = 'bg-card border-border';
          let useInlineStyle = false;
          if (validated && isCorrectOption) {
            bgClass = 'bg-green-100 border-green-500';
          } else if (validated && isSelected && !isCorrectOption) {
            bgClass = 'bg-red-100 border-red-500';
          } else if (isSelected) {
            bgClass = 'border-primary';
            useInlineStyle = true;
          }

          return (
            <TouchableOpacity
              key={index}
              onPress={() => !validated && setSelected(index)}
              disabled={validated}
              className={`rounded-xl border p-4 ${bgClass}`}
              style={useInlineStyle ? { backgroundColor: bgColors.primary[10] } : undefined}
            >
              <Text className={validated && isCorrectOption ? 'font-semibold' : ''}>
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {!validated && selected !== null && (
        <Button onPress={() => setValidated(true)} className="mt-6">
          <Text className="font-semibold text-primary-foreground">Valider</Text>
        </Button>
      )}

      {validated && <FeedbackBox isCorrect={isCorrect} explanation={content.explanation} />}
    </ScrollView>
  );
}

// ============================================================================
// VRAI/FAUX
// ============================================================================

export function VraiFauxViewer({ content }: { content: VraiFauxContent }) {
  const [selected, setSelected] = useState<boolean | null>(null);
  const validated = selected !== null;
  const isCorrect = selected === content.isTrue;

  return (
    <View className="flex-1">
      <Text className="mb-8 text-center text-lg font-medium">{content.statement}</Text>

      <View className="flex-row gap-4">
        <TouchableOpacity
          onPress={() => setSelected(true)}
          disabled={validated}
          className={`flex-1 items-center rounded-xl border p-6 ${
            validated && content.isTrue
              ? 'border-green-500 bg-green-100'
              : validated && selected === true && !content.isTrue
                ? 'border-red-500 bg-red-100'
                : 'border-border bg-card'
          }`}
        >
          <Text className="text-2xl">✓</Text>
          <Text className="mt-2 font-semibold">VRAI</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setSelected(false)}
          disabled={validated}
          className={`flex-1 items-center rounded-xl border p-6 ${
            validated && !content.isTrue
              ? 'border-green-500 bg-green-100'
              : validated && selected === false && content.isTrue
                ? 'border-red-500 bg-red-100'
                : 'border-border bg-card'
          }`}
        >
          <Text className="text-2xl">✗</Text>
          <Text className="mt-2 font-semibold">FAUX</Text>
        </TouchableOpacity>
      </View>

      {validated && <FeedbackBox isCorrect={isCorrect} explanation={content.explanation} />}
    </View>
  );
}
