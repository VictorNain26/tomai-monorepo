/**
 * LevelPickerModal Component
 *
 * Modal for selecting school level in CreateChildModal.
 */

import { Modal, ScrollView, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { X, Check } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { useIconColors } from '@/hooks';
import { getLevelLabel } from '@/constants/levels';
import type { SchoolLevel } from '@/hooks/useParentDashboard';

interface LevelPickerModalProps {
  visible: boolean;
  onClose: () => void;
  levels: SchoolLevel[];
  selectedLevel: string;
  onSelect: (levelKey: string) => void;
}

export function LevelPickerModal({
  visible,
  onClose,
  levels,
  selectedLevel,
  onSelect,
}: LevelPickerModalProps) {
  const iconColors = useIconColors();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
        <View className="flex-row items-center justify-between border-b border-slate-200 dark:border-slate-700 px-4 py-3">
          <Text className="text-lg font-semibold">Niveau scolaire</Text>
          <TouchableOpacity onPress={onClose}>
            <X color={iconColors.muted} size={24} />
          </TouchableOpacity>
        </View>
        <ScrollView className="flex-1">
          {levels.map((level) => (
            <TouchableOpacity
              key={level.key}
              onPress={() => {
                onSelect(level.key);
                onClose();
              }}
              className="flex-row items-center justify-between border-b border-slate-200 dark:border-slate-700 px-4 py-4"
            >
              <Text>{getLevelLabel(level.key)}</Text>
              {selectedLevel === level.key && (
                <Check color={iconColors.foreground} size={20} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
