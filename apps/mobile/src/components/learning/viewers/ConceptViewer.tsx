/**
 * ConceptViewer - Pedagogical theory card
 * Displays concept explanation before exercises
 */

import { ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/text';

export interface ConceptContent {
  title: string;
  explanation: string;
  keyPoints: string[];
  example?: string;
  formula?: string;
}

export function ConceptViewer({ content }: { content: ConceptContent }) {
  return (
    <ScrollView className="flex-1">
      <View className="mb-4 self-start rounded-full bg-violet/15 px-4 py-2">
        <Text className="text-sm font-medium text-violet">📖 Concept</Text>
      </View>

      <Text variant="h3" className="mb-4">
        {content.title}
      </Text>

      <Text className="mb-6 leading-relaxed">{content.explanation}</Text>

      <Text className="mb-3 font-semibold">Points clés :</Text>
      <View className="mb-6 gap-2">
        {content.keyPoints.map((point, index) => (
          <View key={`${index}-${point}`} className="flex-row gap-2">
            <Text className="text-primary">•</Text>
            <Text className="flex-1">{point}</Text>
          </View>
        ))}
      </View>

      {content.example && (
        <View className="mb-4 rounded-xl bg-muted p-4">
          <Text className="mb-2 font-semibold">Exemple :</Text>
          <Text>{content.example}</Text>
        </View>
      )}

      {content.formula && (
        <View className="rounded-xl bg-info/10 p-4">
          <Text className="mb-2 font-semibold">Formule :</Text>
          <Text className="text-center font-mono text-lg">{content.formula}</Text>
        </View>
      )}
    </ScrollView>
  );
}
