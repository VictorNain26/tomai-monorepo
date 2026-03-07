/**
 * Math Viewers - Calculation
 * For math and science subjects
 */

import { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';

export interface CalculationContent {
  problem: string;
  steps: string[];
  answer: string;
  hint?: string;
}

export function CalculationViewer({ content }: { content: CalculationContent }) {
  const [showSteps, setShowSteps] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  return (
    <ScrollView className="flex-1">
      <View className="mb-6 rounded-xl bg-blue-50 p-4">
        <Text className="mb-2 font-semibold">Problème :</Text>
        <Text className="text-lg">{content.problem}</Text>
      </View>

      {content.hint && !showSteps && (
        <View className="mb-4 rounded-lg bg-yellow-50 p-3">
          <Text className="text-sm text-yellow-700">💡 {content.hint}</Text>
        </View>
      )}

      {!showSteps && (
        <Button variant="outline" onPress={() => setShowSteps(true)} className="mb-4">
          <Text>Voir les étapes</Text>
        </Button>
      )}

      {showSteps && (
        <View className="mb-6">
          <Text className="mb-3 font-semibold">Étapes :</Text>
          <View className="gap-2">
            {content.steps.map((step, index) => (
              <View key={index} className="flex-row gap-3 rounded-lg bg-slate-100 dark:bg-slate-800 p-3">
                <View className="h-6 w-6 items-center justify-center rounded-full bg-blue-600 dark:bg-blue-400">
                  <Text className="text-xs text-white dark:text-slate-900">{index + 1}</Text>
                </View>
                <Text className="flex-1">{step}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {showSteps && !showAnswer && (
        <Button onPress={() => setShowAnswer(true)}>
          <Text className="font-semibold text-white dark:text-slate-900">Voir la réponse</Text>
        </Button>
      )}

      {showAnswer && (
        <View className="rounded-xl bg-green-100 p-4">
          <Text className="mb-2 font-semibold text-green-700">Réponse :</Text>
          <Text className="text-center text-xl font-bold">{content.answer}</Text>
        </View>
      )}
    </ScrollView>
  );
}
