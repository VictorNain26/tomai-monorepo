/**
 * Lv2PickerModal Component
 *
 * Modal for selecting LV2 language in CreateChildModal.
 */

import { Modal, ScrollView, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Check } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { LV2_OPTIONS, type Lv2Option } from '@/constants/levels';

interface Lv2PickerModalProps {
  visible: boolean;
  onClose: () => void;
  selectedLv2: Lv2Option | undefined;
  onSelect: (lv2: Lv2Option | undefined) => void;
}

export function Lv2PickerModal({
  visible,
  onClose,
  selectedLv2,
  onSelect,
}: Lv2PickerModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <Text className="text-lg font-semibold">Langue vivante 2</Text>
          <TouchableOpacity onPress={onClose}>
            <X color="hsl(215.4, 16.3%, 46.9%)" size={24} />
          </TouchableOpacity>
        </View>
        <ScrollView className="flex-1">
          {/* None option */}
          <TouchableOpacity
            onPress={() => {
              onSelect(undefined);
              onClose();
            }}
            className="flex-row items-center justify-between border-b border-border px-4 py-4"
          >
            <Text className="text-muted-foreground">Aucune</Text>
            {!selectedLv2 && (
              <Check color="hsl(222.2, 47.4%, 11.2%)" size={20} />
            )}
          </TouchableOpacity>
          {LV2_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              onPress={() => {
                onSelect(option.value);
                onClose();
              }}
              className="flex-row items-center justify-between border-b border-border px-4 py-4"
            >
              <Text>{option.label}</Text>
              {selectedLv2 === option.value && (
                <Check color="hsl(222.2, 47.4%, 11.2%)" size={20} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
