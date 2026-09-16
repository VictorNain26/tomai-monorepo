/**
 * LevelPicker — inline school-level selector for add-child form.
 *
 * Displays the levels the server serves (same source as child edition) as a
 * scrollable row of pressable chips.
 * Extracted from add-child.tsx to keep that file ≤400 lines.
 */

import { ScrollView, Pressable, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { getLevelLabel, type EducationLevelType } from '@/constants/levels';
import { useAvailableLevels } from '@/hooks/useAvailableLevels';

interface LevelPickerProps {
  value: EducationLevelType;
  onChange: (level: EducationLevelType) => void;
}

export function LevelPicker({ value, onChange }: LevelPickerProps) {
  const { levels } = useAvailableLevels();

  return (
    <View className="gap-1.5">
      <Text variant="small" className="text-foreground">
        Niveau scolaire
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 py-1"
        accessibilityLabel="Sélecteur de niveau scolaire"
        accessibilityRole="tablist"
        testID="add-child-level-picker"
      >
        {levels.map(({ key: level }) => {
          const selected = level === value;
          return (
            <Pressable
              key={level}
              onPress={() => onChange(level)}
              accessibilityLabel={`Niveau ${getLevelLabel(level)}`}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              className={[
                'h-11 min-w-[64px] items-center justify-center rounded-lg border px-3',
                selected
                  ? 'border-primary bg-primary'
                  : 'border-border bg-background active:bg-accent',
              ].join(' ')}
            >
              <Text
                variant="small"
                className={selected ? 'text-primary-foreground' : 'text-foreground'}
              >
                {getLevelLabel(level)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
