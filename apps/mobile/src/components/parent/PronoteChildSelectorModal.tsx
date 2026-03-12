/**
 * PronoteChildSelectorModal Component
 *
 * Modal to select which Pronote child to map to a TomAI child.
 * Used after QR code scan when parent has multiple children in Pronote.
 */

import { useState, useCallback } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { X, User, Check, School } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useIconColors } from '@/hooks/useIconColors';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { PronoteResource } from '@/services/pronote/pronote-types';
import { bgColors } from '@/lib/styles';

// ============================================================================
// TYPES
// ============================================================================

interface PronoteChildSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (resourceIndex: number, resource: PronoteResource) => Promise<void>;
  resources: PronoteResource[];
  childName: string;
  establishmentName?: string;
  isSubmitting: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PronoteChildSelectorModal({
  visible,
  onClose,
  onSelect,
  resources,
  childName,
  establishmentName,
  isSubmitting,
}: PronoteChildSelectorModalProps) {
  const iconColors = useIconColors();
  const colors = useThemeColors();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleSelect = useCallback(async () => {
    if (selectedIndex === null || isSubmitting) return;
    const resource = resources[selectedIndex];
    if (resource) {
      await onSelect(selectedIndex, resource);
    }
  }, [selectedIndex, resources, onSelect, isSubmitting]);

  const handleClose = useCallback(() => {
    setSelectedIndex(null);
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-slate-200 dark:border-slate-700 px-4 py-3">
          <Text variant="h3">Associer un compte Pronote</Text>
          <TouchableOpacity
            onPress={handleClose}
            disabled={isSubmitting}
            className="p-2"
          >
            <X color={iconColors.muted} size={24} />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-4 py-6">
          {/* Establishment info */}
          {establishmentName && (
            <View
              className="mb-6 flex-row items-center gap-3 rounded-xl p-4"
              style={{ backgroundColor: bgColors.success[10] }}
            >
              <School color={colors.success} size={20} />
              <Text className="flex-1 font-medium text-emerald-600 dark:text-emerald-400">
                {establishmentName}
              </Text>
            </View>
          )}

          {/* Instructions */}
          <View className="mb-6">
            <Text className="text-lg font-semibold">
              Quel compte Pronote pour {childName} ?
            </Text>
            <Text variant="muted" className="mt-2">
              Sélectionnez le compte Pronote qui correspond à {childName}.
              Ses devoirs et notes seront synchronisés automatiquement.
            </Text>
          </View>

          {/* Children list */}
          <View className="gap-3">
            {resources.map((resource, index) => {
              const isSelected = selectedIndex === index;
              return (
                <TouchableOpacity
                  key={resource.id}
                  onPress={() => setSelectedIndex(index)}
                  disabled={isSubmitting}
                  className={`rounded-xl border-2 p-4 ${
                    isSelected ? 'border-blue-600 dark:border-blue-400' : 'border-slate-200 dark:border-slate-700'
                  }`}
                  style={
                    isSelected ? { backgroundColor: bgColors.primary[5] } : undefined
                  }
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center gap-3">
                    <View
                      className="h-12 w-12 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: isSelected
                          ? bgColors.primary[20]
                          : bgColors.muted[50],
                      }}
                    >
                      <User
                        color={isSelected ? colors.primary : iconColors.muted}
                        size={24}
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="font-semibold">{resource.name}</Text>
                      {resource.className && (
                        <Text variant="muted" className="text-sm">
                          Classe: {resource.className}
                        </Text>
                      )}
                    </View>
                    {isSelected && (
                      <View
                        className="h-8 w-8 items-center justify-center rounded-full"
                        style={{ backgroundColor: colors.primary }}
                      >
                        <Check color={colors.primaryForeground} size={18} />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Empty state */}
          {resources.length === 0 && (
            <View className="items-center py-8">
              <Text variant="muted" className="text-center">
                Aucun enfant trouvé dans votre compte Pronote.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View className="border-t border-slate-200 dark:border-slate-700 p-4">
          <Button
            onPress={handleSelect}
            disabled={selectedIndex === null || isSubmitting}
          >
            <Text className="font-semibold text-white dark:text-slate-900">
              {isSubmitting ? 'Association en cours...' : 'Associer ce compte'}
            </Text>
          </Button>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
