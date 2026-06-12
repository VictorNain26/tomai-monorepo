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
      <View className="mb-6 rounded-xl bg-info/10 p-4">
        <Text className="mb-2 font-semibold">Problème :</Text>
        <Text className="text-lg">{content.problem}</Text>
      </View>

      {content.hint && !showSteps && (
        <View className="mb-4 rounded-lg bg-warning/15 p-3">
          <Text className="text-sm text-warning">💡 {content.hint}</Text>
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
              <View key={`${index}-${step}`} className="flex-row gap-3 rounded-lg bg-muted p-3">
                <View className="h-6 w-6 items-center justify-center rounded-full bg-primary">
                  <Text className="text-xs text-primary-foreground">{index + 1}</Text>
                </View>
                <Text className="flex-1">{step}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {showSteps && !showAnswer && (
        <Button onPress={() => setShowAnswer(true)}>
          <Text className="font-semibold text-primary-foreground">Voir la réponse</Text>
        </Button>
      )}

      {showAnswer && (
        <View className="rounded-xl bg-success/15 p-4">
          <Text className="mb-2 font-semibold text-success">Réponse :</Text>
          <Text className="text-center text-xl font-bold">{content.answer}</Text>
        </View>
      )}
    </ScrollView>
  );
}
