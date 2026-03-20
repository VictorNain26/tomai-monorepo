/**
 * History Viewers - Timeline, Matching Era, Cause Effect
 * For history and geography subjects
 */

import { useState } from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { bgColors } from '@/lib/styles';

// ============================================================================
// TYPES
// ============================================================================

export interface TimelineContent {
  instruction: string;
  events: Array<{ event: string; date: string; hint?: string }>;
  correctOrder: number[];
}

export interface MatchingEraContent {
  instruction: string;
  items: string[];
  eras: string[];
  correctPairs: Array<[number, number]>;
}

export interface CauseEffectContent {
  context: string;
  cause: string;
  possibleEffects: string[];
  correctIndex: number;
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
// TIMELINE
// ============================================================================

export function TimelineViewer({ content }: { content: TimelineContent }) {
  const [userOrder, setUserOrder] = useState<number[]>([]);
  const [validated, setValidated] = useState(false);

  const remainingEvents = content.events
    .map((e, i) => ({ ...e, originalIndex: i }))
    .filter((e) => !userOrder.includes(e.originalIndex));

  const isCorrect =
    validated && JSON.stringify(userOrder) === JSON.stringify(content.correctOrder);

  const handleEventPress = (originalIndex: number) => {
    if (validated) return;
    setUserOrder([...userOrder, originalIndex]);
  };

  const handleRemove = (index: number) => {
    if (validated) return;
    setUserOrder(userOrder.filter((_, i) => i !== index));
  };

  return (
    <ScrollView className="flex-1">
      <Text className="mb-4 text-center font-medium">{content.instruction}</Text>

      <View className="mb-6">
        <Text variant="muted" className="mb-2 text-sm">
          Ta chronologie :
        </Text>
        {userOrder.length === 0 ? (
          <View className="rounded-xl border border-dashed border-stone-200 dark:border-stone-700 p-4">
            <Text variant="muted" className="text-center">
              Appuie sur les événements pour les ordonner
            </Text>
          </View>
        ) : (
          <View className="gap-2">
            {userOrder.map((originalIndex, position) => {
              const event = content.events[originalIndex];
              return (
                <TouchableOpacity
                  key={position}
                  onPress={() => handleRemove(position)}
                  className="flex-row items-center gap-3 rounded-lg border border-blue-600 dark:border-blue-400 p-3"
                  style={{ backgroundColor: bgColors.primary[10] }}
                >
                  <View className="h-6 w-6 items-center justify-center rounded-full bg-blue-600 dark:bg-blue-400">
                    <Text className="text-xs text-white dark:text-stone-900">{position + 1}</Text>
                  </View>
                  <View className="flex-1">
                    <Text>{event.event}</Text>
                    <Text variant="muted" className="text-xs">
                      {event.date}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {remainingEvents.length > 0 && (
        <View className="gap-2">
          {remainingEvents.map((event) => (
            <TouchableOpacity
              key={event.originalIndex}
              onPress={() => handleEventPress(event.originalIndex)}
              disabled={validated}
              className="rounded-lg bg-white dark:bg-stone-800 p-3"
            >
              <Text>{event.event}</Text>
              {event.hint && (
                <Text variant="muted" className="text-xs">
                  💡 {event.hint}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {remainingEvents.length === 0 && !validated && (
        <Button onPress={() => setValidated(true)} className="mt-4">
          <Text className="font-semibold text-white dark:text-stone-900">Valider</Text>
        </Button>
      )}

      {validated && <FeedbackBox isCorrect={isCorrect} />}
    </ScrollView>
  );
}

// ============================================================================
// MATCHING ERA
// ============================================================================

export function MatchingEraViewer({ content }: { content: MatchingEraContent }) {
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<Record<number, number>>({});
  const [validated, setValidated] = useState(false);

  const handleItemPress = (itemIndex: number) => {
    if (validated || assignments[itemIndex] !== undefined) return;
    setSelectedItem(selectedItem === itemIndex ? null : itemIndex);
  };

  const handleEraPress = (eraIndex: number) => {
    if (validated || selectedItem === null) return;
    setAssignments({ ...assignments, [selectedItem]: eraIndex });
    setSelectedItem(null);
  };

  const allAssigned = Object.keys(assignments).length === content.items.length;
  const isCorrect =
    validated &&
    content.correctPairs.every(([itemIdx, eraIdx]) => assignments[itemIdx] === eraIdx);

  return (
    <ScrollView className="flex-1">
      <Text className="mb-4 text-center font-medium">{content.instruction}</Text>

      <View className="mb-4 flex-row flex-wrap gap-2">
        {content.eras.map((era, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => handleEraPress(index)}
            disabled={validated || selectedItem === null}
            className={`rounded-lg border p-2 ${
              selectedItem !== null ? 'border-blue-600 dark:border-blue-400' : 'border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-stone-800'
            }`}
            style={selectedItem !== null ? { backgroundColor: bgColors.primary[10] } : undefined}
          >
            <Text className="text-sm font-medium">{era}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View className="gap-2">
        {content.items.map((item, index) => {
          const assignedEra = assignments[index];
          const isSelected = selectedItem === index;

          return (
            <TouchableOpacity
              key={index}
              onPress={() => handleItemPress(index)}
              disabled={validated || assignedEra !== undefined}
              className={`flex-row items-center justify-between rounded-lg border p-3 ${
                assignedEra !== undefined
                  ? 'border-green-500 bg-green-50'
                  : isSelected
                    ? 'border-blue-600 dark:border-blue-400'
                    : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800'
              }`}
              style={assignedEra === undefined && isSelected ? { backgroundColor: bgColors.primary[10] } : undefined}
            >
              <Text className="flex-1">{item}</Text>
              {assignedEra !== undefined && (
                <View className="rounded bg-green-200 px-2 py-1">
                  <Text className="text-xs">{content.eras[assignedEra]}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {allAssigned && !validated && (
        <Button onPress={() => setValidated(true)} className="mt-4">
          <Text className="font-semibold text-white dark:text-stone-900">Valider</Text>
        </Button>
      )}

      {validated && <FeedbackBox isCorrect={isCorrect} />}
    </ScrollView>
  );
}

// ============================================================================
// CAUSE EFFECT
// ============================================================================

export function CauseEffectViewer({ content }: { content: CauseEffectContent }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [validated, setValidated] = useState(false);
  const isCorrect = selected === content.correctIndex;

  return (
    <ScrollView className="flex-1">
      {content.context && (
        <View className="mb-4 rounded-lg bg-stone-100 dark:bg-stone-800 p-3">
          <Text variant="muted" className="text-sm">
            {content.context}
          </Text>
        </View>
      )}

      <View className="mb-6 rounded-xl bg-orange-50 p-4">
        <Text className="mb-1 text-sm font-medium text-orange-700">Cause :</Text>
        <Text className="text-lg">{content.cause}</Text>
      </View>

      <Text className="mb-3 font-medium">Quelle est la conséquence ?</Text>

      <View className="gap-2">
        {content.possibleEffects.map((effect, index) => {
          const isSelected = selected === index;
          const isCorrectOption = index === content.correctIndex;

          let bgClass = 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700';
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
              <Text>{effect}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {!validated && selected !== null && (
        <Button onPress={() => setValidated(true)} className="mt-4">
          <Text className="font-semibold text-white dark:text-stone-900">Valider</Text>
        </Button>
      )}

      {validated && <FeedbackBox isCorrect={isCorrect} explanation={content.explanation} />}
    </ScrollView>
  );
}
