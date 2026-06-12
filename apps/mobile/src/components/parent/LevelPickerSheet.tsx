import { View, TouchableOpacity, Modal, ScrollView, Pressable } from 'react-native';
import { X, Check } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { useThemeColors } from '@/hooks';
import { LEVEL_LABELS, type EducationLevelType } from '@/constants/levels';

interface LevelPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (level: EducationLevelType) => void;
  selectedLevel?: string;
}

const LEVEL_GROUPS: { title: string; levels: EducationLevelType[] }[] = [
  { title: 'Primaire', levels: ['cp', 'ce1', 'ce2', 'cm1', 'cm2'] },
  { title: 'College', levels: ['sixieme', 'cinquieme', 'quatrieme', 'troisieme'] },
  { title: 'Lycee', levels: ['seconde', 'premiere', 'terminale'] },
];

export function LevelPickerSheet({ visible, onClose, onSelect, selectedLevel }: LevelPickerSheetProps) {
  const colors = useThemeColors();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={onClose}>
        <Pressable
          className="rounded-t-3xl bg-background pb-8"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle bar */}
          <View className="items-center pt-3 pb-2">
            <View className="h-1 w-10 rounded-full bg-stone-300 dark:bg-stone-600" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between px-5 pb-3">
            <Text className="text-lg font-semibold">Niveau scolaire</Text>
            <TouchableOpacity onPress={onClose} className="p-1">
              <X color={colors.mutedForeground} size={20} />
            </TouchableOpacity>
          </View>

          {/* Level list */}
          <ScrollView className="max-h-96 px-5" showsVerticalScrollIndicator={false}>
            {LEVEL_GROUPS.map((group) => (
              <View key={group.title} className="mb-4">
                <Text variant="muted" className="mb-2 text-xs font-semibold uppercase tracking-wider">
                  {group.title}
                </Text>
                {group.levels.map((level) => {
                  const isSelected = selectedLevel === level;
                  return (
                    <TouchableOpacity
                      key={level}
                      onPress={() => { onSelect(level); onClose(); }}
                      className="flex-row items-center justify-between rounded-xl px-4 py-3 mb-1"
                      style={isSelected ? { backgroundColor: colors.primary + '14' } : undefined}
                    >
                      <Text className={isSelected ? 'font-semibold' : ''}>
                        {LEVEL_LABELS[level]}
                      </Text>
                      {isSelected && <Check color={colors.primary} size={18} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
