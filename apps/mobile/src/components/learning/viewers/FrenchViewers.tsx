/**
 * French Viewers - Grammar Transform
 * For French language subject
 */

import { useState } from 'react';
import { View, TextInput, ScrollView } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';

export interface GrammarTransformContent {
  instruction: string;
  originalSentence: string;
  transformationType: 'tense' | 'voice' | 'form' | 'number';
  correctAnswer: string;
  acceptableVariants?: string[];
  explanation?: string;
}

const TRANSFORM_LABELS: Record<string, string> = {
  tense: 'Temps',
  voice: 'Voix',
  form: 'Forme',
  number: 'Nombre',
};

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
        <Text className="mt-2 text-sm text-gray-700">Réponse attendue : {correctAnswer}</Text>
      )}
      {explanation && <Text className="mt-2 text-sm text-gray-700">{explanation}</Text>}
    </View>
  );
}

export function GrammarTransformViewer({ content }: { content: GrammarTransformContent }) {
  const [userAnswer, setUserAnswer] = useState('');
  const [validated, setValidated] = useState(false);

  const normalizedUser = userAnswer.trim().toLowerCase();
  const normalizedCorrect = content.correctAnswer.trim().toLowerCase();
  const variants = content.acceptableVariants?.map((v) => v.trim().toLowerCase()) ?? [];

  const isCorrect = normalizedUser === normalizedCorrect || variants.includes(normalizedUser);

  return (
    <ScrollView className="flex-1">
      <View className="mb-4 self-start rounded-full bg-purple-100 px-4 py-2">
        <Text className="text-sm text-purple-700">
          ✏️ {TRANSFORM_LABELS[content.transformationType] ?? 'Transformation'}
        </Text>
      </View>

      <Text className="mb-4">{content.instruction}</Text>

      <View className="mb-6 rounded-xl bg-stone-100 dark:bg-stone-800 p-4">
        <Text className="text-center text-lg font-medium">{content.originalSentence}</Text>
      </View>

      <TextInput
        value={userAnswer}
        onChangeText={setUserAnswer}
        placeholder="Ta réponse..."
        editable={!validated}
        className="mb-4 rounded-xl bg-white dark:bg-stone-800 p-4 text-base"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {!validated && userAnswer.trim() !== '' && (
        <Button onPress={() => setValidated(true)}>
          <Text className="font-semibold text-white dark:text-stone-900">Valider</Text>
        </Button>
      )}

      {validated && (
        <FeedbackBox
          isCorrect={isCorrect}
          explanation={content.explanation}
          correctAnswer={content.correctAnswer}
        />
      )}
    </ScrollView>
  );
}
