/**
 * Language Viewers - Matching, Fill Blank, Word Order
 * For language learning (LV1, LV2)
 */

import { useState } from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { bgColors, borderColors } from '@/lib/styles';

// ============================================================================
// TYPES
// ============================================================================

export interface MatchingContent {
  instruction: string;
  pairs: Array<{ left: string; right: string }>;
}

export interface FillBlankContent {
  sentence: string;
  options: string[];
  correctIndex: number;
  grammaticalPoint?: string;
  explanation?: string;
}

export interface WordOrderContent {
  instruction: string;
  words: string[];
  correctSentence: string;
  translation?: string;
}

// ============================================================================
// FEEDBACK BOX
// ============================================================================

function FeedbackBox({
  isCorrect,
  explanation,
  correctAnswer,
}: {
  isCorrect: boolean;
  explanation?: string;
  correctAnswer?: string;
}) {
  return (
    <View className={`mt-4 rounded-xl p-4 ${isCorrect ? 'bg-green-100' : 'bg-red-100'}`}>
      <Text className={isCorrect ? 'text-green-700' : 'text-red-700'}>
        {isCorrect ? '✓ Bonne réponse !' : '✗ Mauvaise réponse'}
      </Text>
      {correctAnswer && !isCorrect && (
        <Text className="mt-2 text-sm text-gray-700">Réponse : {correctAnswer}</Text>
      )}
      {explanation && <Text className="mt-2 text-sm text-gray-700">{explanation}</Text>}
    </View>
  );
}

// ============================================================================
// MATCHING
// ============================================================================

export function MatchingViewer({ content }: { content: MatchingContent }) {
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [matches, setMatches] = useState<Record<number, number>>({});
  const [validated, setValidated] = useState(false);

  const handleLeftPress = (index: number) => {
    if (validated || matches[index] !== undefined) return;
    setSelectedLeft(selectedLeft === index ? null : index);
  };

  const handleRightPress = (rightIndex: number) => {
    if (validated || selectedLeft === null) return;
    setMatches({ ...matches, [selectedLeft]: rightIndex });
    setSelectedLeft(null);
  };

  const allMatched = Object.keys(matches).length === content.pairs.length;
  const isCorrect = validated && content.pairs.every((_, i) => matches[i] === i);

  return (
    <ScrollView className="flex-1">
      <Text className="mb-6 text-center font-medium">{content.instruction}</Text>

      <View className="flex-row gap-4">
        <View className="flex-1 gap-2">
          {content.pairs.map((pair, index) => {
            const isMatched = matches[index] !== undefined;
            const isSelected = selectedLeft === index;

            return (
              <TouchableOpacity
                key={`left-${index}`}
                onPress={() => handleLeftPress(index)}
                disabled={validated || isMatched}
                className={`rounded-lg border p-3 ${
                  isMatched
                    ? 'border-green-500 bg-green-50'
                    : isSelected
                      ? 'border-blue-600 dark:border-blue-400'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                }`}
                style={!isMatched && isSelected ? { backgroundColor: bgColors.primary[10] } : undefined}
              >
                <Text numberOfLines={2}>{pair.left}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View className="flex-1 gap-2">
          {content.pairs.map((pair, index) => {
            const isUsed = Object.values(matches).includes(index);

            return (
              <TouchableOpacity
                key={`right-${index}`}
                onPress={() => handleRightPress(index)}
                disabled={validated || isUsed || selectedLeft === null}
                className={`rounded-lg border p-3 ${
                  isUsed
                    ? 'border-green-500 bg-green-50'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                }`}
                style={!isUsed && selectedLeft !== null ? { borderColor: borderColors.primary[50] } : undefined}
              >
                <Text numberOfLines={2}>{pair.right}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {allMatched && !validated && (
        <Button onPress={() => setValidated(true)} className="mt-6">
          <Text className="font-semibold text-white dark:text-slate-900">Valider</Text>
        </Button>
      )}

      {validated && <FeedbackBox isCorrect={isCorrect} />}
    </ScrollView>
  );
}

// ============================================================================
// FILL BLANK
// ============================================================================

export function FillBlankViewer({ content }: { content: FillBlankContent }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [validated, setValidated] = useState(false);
  const isCorrect = selected === content.correctIndex;

  const displaySentence = content.sentence.replace(
    '___',
    selected !== null ? `[${content.options[selected]}]` : '[___]'
  );

  return (
    <View className="flex-1">
      {content.grammaticalPoint && (
        <View className="mb-4 self-start rounded-full bg-blue-100 px-4 py-2">
          <Text className="text-sm text-blue-700">{content.grammaticalPoint}</Text>
        </View>
      )}

      <View className="mb-6 rounded-xl bg-slate-100 dark:bg-slate-800 p-4">
        <Text className="text-center text-lg">{displaySentence}</Text>
      </View>

      <View className="gap-2">
        {content.options.map((option, index) => {
          const isSelected = selected === index;
          const isCorrectOption = index === content.correctIndex;

          let bgClass = 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700';
          let useInlineStyle = false;
          if (validated && isCorrectOption) {
            bgClass = 'bg-green-100 border-green-500';
          } else if (validated && isSelected && !isCorrectOption) {
            bgClass = 'bg-red-100 border-red-500';
          } else if (isSelected) {
            bgClass = 'border-blue-600 dark:border-blue-400';
            useInlineStyle = true;
          }

          return (
            <TouchableOpacity
              key={index}
              onPress={() => !validated && setSelected(index)}
              disabled={validated}
              className={`rounded-lg border p-3 ${bgClass}`}
              style={useInlineStyle ? { backgroundColor: bgColors.primary[10] } : undefined}
            >
              <Text className="text-center">{option}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {!validated && selected !== null && (
        <Button onPress={() => setValidated(true)} className="mt-6">
          <Text className="font-semibold text-white dark:text-slate-900">Valider</Text>
        </Button>
      )}

      {validated && <FeedbackBox isCorrect={isCorrect} explanation={content.explanation} />}
    </View>
  );
}

// ============================================================================
// WORD ORDER
// ============================================================================

export function WordOrderViewer({ content }: { content: WordOrderContent }) {
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [validated, setValidated] = useState(false);

  const remainingWords = content.words.filter((word) => !selectedWords.includes(word));
  const userSentence = selectedWords.join(' ');
  const isCorrect = userSentence === content.correctSentence;

  const handleWordPress = (word: string) => {
    if (validated) return;
    setSelectedWords([...selectedWords, word]);
  };

  const handleRemoveWord = (index: number) => {
    if (validated) return;
    setSelectedWords(selectedWords.filter((_, i) => i !== index));
  };

  const handleReset = () => {
    setSelectedWords([]);
    setValidated(false);
  };

  return (
    <ScrollView className="flex-1">
      <Text className="mb-4 text-center font-medium">{content.instruction}</Text>

      {content.translation && (
        <View className="mb-4 rounded-lg bg-slate-100 dark:bg-slate-800 p-3">
          <Text variant="muted" className="text-center text-sm">
            💡 {content.translation}
          </Text>
        </View>
      )}

      <View className="mb-6 min-h-[60px] rounded-xl bg-white dark:bg-slate-800 p-4">
        {selectedWords.length === 0 ? (
          <Text variant="muted" className="text-center">
            Appuie sur les mots pour construire la phrase
          </Text>
        ) : (
          <View className="flex-row flex-wrap gap-2">
            {selectedWords.map((word, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => handleRemoveWord(index)}
                className="rounded-lg bg-blue-600 dark:bg-blue-400 px-3 py-2"
              >
                <Text className="text-white dark:text-slate-900">{word}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View className="flex-row flex-wrap gap-2">
        {remainingWords.map((word, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => handleWordPress(word)}
            disabled={validated}
            className="rounded-lg bg-white dark:bg-slate-800 px-3 py-2"
          >
            <Text>{word}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {remainingWords.length === 0 && !validated && (
        <View className="mt-6 flex-row gap-3">
          <Button variant="outline" onPress={handleReset} className="flex-1">
            <Text>Réessayer</Text>
          </Button>
          <Button onPress={() => setValidated(true)} className="flex-1">
            <Text className="font-semibold text-white dark:text-slate-900">Valider</Text>
          </Button>
        </View>
      )}

      {validated && (
        <FeedbackBox isCorrect={isCorrect} correctAnswer={content.correctSentence} />
      )}
    </ScrollView>
  );
}
