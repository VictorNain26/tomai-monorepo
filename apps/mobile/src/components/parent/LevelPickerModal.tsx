/**
 * LevelPickerModal Component
 *
 * Modal for selecting school level in CreateChildModal.
 */

import { Modal, ScrollView, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Check } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { getLevelLabel, LV2_ELIGIBLE_LEVELS } from '@/constants/levels';
import type { SchoolLevel } from '@/hooks/useParentDashboard';

interface LevelPickerModalProps {
  visible: boolean;
  onClose: () => void;
  levels: SchoolLevel[];
  selectedLevel: string;
  onSelect: (levelKey: string, isLv2Eligible: boolean) => void;
}

export function LevelPickerModal({
  visible,
  onClose,
  levels,
  selectedLevel,
  onSelect,
}: LevelPickerModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <Text className="text-lg font-semibold">Niveau scolaire</Text>
          <TouchableOpacity onPress={onClose}>
            <X color="hsl(215.4, 16.3%, 46.9%)" size={24} />
          </TouchableOpacity>
        </View>
        <ScrollView className="flex-1">
          {levels.map((level) => (
            <TouchableOpacity
              key={level.key}
              onPress={() => {
                const isLv2Eligible = LV2_ELIGIBLE_LEVELS.includes(level.key);
                onSelect(level.key, isLv2Eligible);
                onClose();
              }}
              className="flex-row items-center justify-between border-b border-border px-4 py-4"
            >
              <Text>{getLevelLabel(level.key)}</Text>
              {selectedLevel === level.key && (
                <Check color="hsl(222.2, 47.4%, 11.2%)" size={20} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
