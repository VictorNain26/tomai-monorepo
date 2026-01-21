/**
 * Science Viewers - Classification, Process Order
 * For SVT and science subjects
 */

import { useState } from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';

// ============================================================================
// TYPES
// ============================================================================

export interface ClassificationContent {
  instruction: string;
  items: string[];
  categories: string[];
  correctClassification: Record<string, number[]>;
  explanation?: string;
}

export interface ProcessOrderContent {
  instruction: string;
  processName: string;
  steps: string[];
  correctOrder: number[];
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
// CLASSIFICATION
// ============================================================================

export function ClassificationViewer({ content }: { content: ClassificationContent }) {
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [classifications, setClassifications] = useState<Record<number, string>>({});
  const [validated, setValidated] = useState(false);

  const handleItemPress = (itemIndex: number) => {
    if (validated || classifications[itemIndex] !== undefined) return;
    setSelectedItem(selectedItem === itemIndex ? null : itemIndex);
  };

  const handleCategoryPress = (category: string) => {
    if (validated || selectedItem === null) return;
    setClassifications({ ...classifications, [selectedItem]: category });
    setSelectedItem(null);
  };

  const allClassified = Object.keys(classifications).length === content.items.length;
  const isCorrect =
    validated &&
    Object.entries(content.correctClassification).every(([category, indices]) =>
      indices.every((idx) => classifications[idx] === category)
    );

  return (
    <ScrollView className="flex-1">
      <Text className="mb-4 text-center font-medium">{content.instruction}</Text>

      <View className="mb-4 flex-row flex-wrap gap-2">
        {content.categories.map((category) => (
          <TouchableOpacity
            key={category}
            onPress={() => handleCategoryPress(category)}
            disabled={validated || selectedItem === null}
            className={`rounded-lg border p-2 ${
              selectedItem !== null ? 'border-primary bg-primary/10' : 'border-border bg-muted'
            }`}
          >
            <Text className="text-sm font-medium">{category}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View className="gap-2">
        {content.items.map((item, index) => {
          const assignedCategory = classifications[index];
          const isSelected = selectedItem === index;

          return (
            <TouchableOpacity
              key={index}
              onPress={() => handleItemPress(index)}
              disabled={validated || assignedCategory !== undefined}
              className={`flex-row items-center justify-between rounded-lg border p-3 ${
                assignedCategory !== undefined
                  ? 'border-green-500 bg-green-50'
                  : isSelected
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-card'
              }`}
            >
              <Text className="flex-1">{item}</Text>
              {assignedCategory !== undefined && (
                <View className="rounded bg-green-200 px-2 py-1">
                  <Text className="text-xs">{assignedCategory}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {allClassified && !validated && (
        <Button onPress={() => setValidated(true)} className="mt-4">
          <Text className="font-semibold text-primary-foreground">Valider</Text>
        </Button>
      )}

      {validated && <FeedbackBox isCorrect={isCorrect} explanation={content.explanation} />}
    </ScrollView>
  );
}

// ============================================================================
// PROCESS ORDER
// ============================================================================

export function ProcessOrderViewer({ content }: { content: ProcessOrderContent }) {
  const [userOrder, setUserOrder] = useState<number[]>([]);
  const [validated, setValidated] = useState(false);

  const remainingSteps = content.steps
    .map((s, i) => ({ step: s, originalIndex: i }))
    .filter((s) => !userOrder.includes(s.originalIndex));

  const isCorrect =
    validated && JSON.stringify(userOrder) === JSON.stringify(content.correctOrder);

  const handleStepPress = (originalIndex: number) => {
    if (validated) return;
    setUserOrder([...userOrder, originalIndex]);
  };

  const handleRemove = (index: number) => {
    if (validated) return;
    setUserOrder(userOrder.filter((_, i) => i !== index));
  };

  return (
    <ScrollView className="flex-1">
      <View className="mb-4 rounded-lg bg-blue-50 p-3">
        <Text className="font-medium text-blue-700">{content.processName}</Text>
      </View>

      <Text className="mb-4 text-center">{content.instruction}</Text>

      <View className="mb-6">
        {userOrder.length === 0 ? (
          <View className="rounded-xl border border-dashed border-border p-4">
            <Text variant="muted" className="text-center">
              Appuie sur les étapes dans l'ordre correct
            </Text>
          </View>
        ) : (
          <View className="gap-2">
            {userOrder.map((originalIndex, position) => (
              <TouchableOpacity
                key={position}
                onPress={() => handleRemove(position)}
                className="flex-row items-center gap-3 rounded-lg border border-primary bg-primary/10 p-3"
              >
                <View className="h-6 w-6 items-center justify-center rounded-full bg-primary">
                  <Text className="text-xs text-primary-foreground">{position + 1}</Text>
                </View>
                <Text className="flex-1">{content.steps[originalIndex]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {remainingSteps.length > 0 && (
        <View className="gap-2">
          {remainingSteps.map((item) => (
            <TouchableOpacity
              key={item.originalIndex}
              onPress={() => handleStepPress(item.originalIndex)}
              disabled={validated}
              className="rounded-lg border border-border bg-card p-3"
            >
              <Text>{item.step}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {remainingSteps.length === 0 && !validated && (
        <Button onPress={() => setValidated(true)} className="mt-4">
          <Text className="font-semibold text-primary-foreground">Valider</Text>
        </Button>
      )}

      {validated && <FeedbackBox isCorrect={isCorrect} explanation={content.explanation} />}
    </ScrollView>
  );
}
