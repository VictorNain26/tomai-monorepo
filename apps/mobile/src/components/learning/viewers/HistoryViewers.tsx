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
    <View className={`mt-4 rounded-xl p-4 ${isCorrect ? 'bg-success/15' : 'bg-destructive/15'}`}>
      <Text className={isCorrect ? 'text-success' : 'text-destructive'}>
        {isCorrect ? '✓ Bonne réponse !' : '✗ Mauvaise réponse'}
      </Text>
      {explanation && <Text className="mt-2 text-sm text-foreground">{explanation}</Text>}
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
          <View className="rounded-xl border border-dashed border-border p-4">
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
                  key={`${position}-${originalIndex}`}
                  onPress={() => handleRemove(position)}
                  className="flex-row items-center gap-3 rounded-lg border border-primary p-3"
                  style={{ backgroundColor: bgColors.primary[10] }}
                >
                  <View className="h-6 w-6 items-center justify-center rounded-full bg-primary">
                    <Text className="text-xs text-primary-foreground">{position + 1}</Text>
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
              className="rounded-lg bg-card p-3"
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
          <Text className="font-semibold text-primary-foreground">Valider</Text>
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
            key={era}
            onPress={() => handleEraPress(index)}
            disabled={validated || selectedItem === null}
            className={`rounded-lg border p-2 ${
              selectedItem !== null ? 'border-primary' : 'border-border bg-muted'
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
              key={`${index}-${item}`}
              onPress={() => handleItemPress(index)}
              disabled={validated || assignedEra !== undefined}
              className={`flex-row items-center justify-between rounded-lg border p-3 ${
                assignedEra !== undefined
                  ? 'border-success bg-success/15'
                  : isSelected
                    ? 'border-primary'
                    : 'border-border bg-card'
              }`}
              style={assignedEra === undefined && isSelected ? { backgroundColor: bgColors.primary[10] } : undefined}
            >
              <Text className="flex-1">{item}</Text>
              {assignedEra !== undefined && (
                <View className="rounded bg-success/25 px-2 py-1">
                  <Text className="text-xs">{content.eras[assignedEra]}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {allAssigned && !validated && (
        <Button onPress={() => setValidated(true)} className="mt-4">
          <Text className="font-semibold text-primary-foreground">Valider</Text>
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
        <View className="mb-4 rounded-lg bg-muted p-3">
          <Text variant="muted" className="text-sm">
            {content.context}
          </Text>
        </View>
      )}

      <View className="mb-6 rounded-xl bg-warning/15 p-4">
        <Text className="mb-1 text-sm font-medium text-warning">Cause :</Text>
        <Text className="text-lg">{content.cause}</Text>
      </View>

      <Text className="mb-3 font-medium">Quelle est la conséquence ?</Text>

      <View className="gap-2">
        {content.possibleEffects.map((effect, index) => {
          const isSelected = selected === index;
          const isCorrectOption = index === content.correctIndex;

          let bgClass = 'bg-card border-border';
          let useInlineStyle = false;
          if (validated && isCorrectOption) {
            bgClass = 'bg-success/15 border-success';
          } else if (validated && isSelected && !isCorrectOption) {
            bgClass = 'bg-destructive/15 border-destructive';
          } else if (isSelected) {
            bgClass = 'border-primary';
            useInlineStyle = true;
          }

          return (
            <TouchableOpacity
              key={`${index}-${effect}`}
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
          <Text className="font-semibold text-primary-foreground">Valider</Text>
        </Button>
      )}

      {validated && <FeedbackBox isCorrect={isCorrect} explanation={content.explanation} />}
    </ScrollView>
  );
}
