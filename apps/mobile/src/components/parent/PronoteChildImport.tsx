/**
 * PronoteChildImport Component
 *
 * Multi-select children from Pronote resources.
 * Pre-selects all available, filters out already-imported children.
 */

import { useState, useCallback, useMemo } from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { Check, School } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useThemeColors } from '@/hooks';
import { bgColors, borderColors } from '@/lib/styles';
import type { PronoteResource } from '@/services/pronote/pronote-types';

// ============================================================================
// TYPES
// ============================================================================

interface PronoteChildImportProps {
  resources: PronoteResource[];
  existingChildNames: string[];
  onImport: (selected: PronoteResource[]) => void;
  isSubmitting: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PronoteChildImport({
  resources,
  existingChildNames,
  onImport,
  isSubmitting,
}: PronoteChildImportProps) {
  const colors = useThemeColors();

  const available = useMemo(
    () => resources.filter((r) => !existingChildNames.includes(r.name)),
    [resources, existingChildNames],
  );

  const alreadyImported = useMemo(
    () => resources.filter((r) => existingChildNames.includes(r.name)),
    [resources, existingChildNames],
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(available.map((r) => r.id)),
  );

  const allSelected = selectedIds.size === available.length && available.length > 0;

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(available.map((r) => r.id)));
    }
  }, [allSelected, available]);

  const toggleResource = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleContinue = useCallback(() => {
    if (isSubmitting) return;
    const selected = available.filter((r) => selectedIds.has(r.id));
    onImport(selected);
  }, [available, selectedIds, onImport, isSubmitting]);

  const selectedCount = selectedIds.size;

  return (
    <View className="flex-1">
      <ScrollView className="flex-1 px-4 py-6" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text className="mb-6 text-lg font-semibold">
          Sélectionnez les enfants à ajouter
        </Text>

        {/* Select all toggle — only shown if >1 available */}
        {available.length > 1 && (
          <TouchableOpacity
            onPress={toggleAll}
            disabled={isSubmitting}
            className="mb-4 flex-row items-center gap-3 rounded-xl px-4 py-3"
            style={{ backgroundColor: bgColors.primary[10] }}
            activeOpacity={0.7}
          >
            <View
              className="h-6 w-6 items-center justify-center rounded-md border-2"
              style={{
                borderColor: allSelected ? colors.primary : colors.border,
                backgroundColor: allSelected ? colors.primary : 'transparent',
              }}
            >
              {allSelected && <Check color={colors.primaryForeground} size={14} />}
            </View>
            <Text className="font-medium" style={{ color: colors.primary }}>
              Tout sélectionner
            </Text>
          </TouchableOpacity>
        )}

        {/* Available children */}
        <View className="gap-3">
          {available.map((resource) => {
            const isSelected = selectedIds.has(resource.id);
            return (
              <TouchableOpacity
                key={resource.id}
                onPress={() => toggleResource(resource.id)}
                disabled={isSubmitting}
                activeOpacity={0.7}
              >
                <Card
                  className="overflow-hidden rounded-xl border-2 p-4"
                  style={{
                    borderColor: isSelected
                      ? colors.primary
                      : colors.border,
                    backgroundColor: isSelected
                      ? bgColors.primary[5]
                      : undefined,
                  }}
                >
                  <View className="flex-row items-center gap-3">
                    {/* Checkbox */}
                    <View
                      className="h-6 w-6 items-center justify-center rounded-md border-2"
                      style={{
                        borderColor: isSelected ? colors.primary : colors.border,
                        backgroundColor: isSelected ? colors.primary : 'transparent',
                      }}
                    >
                      {isSelected && (
                        <Check color={colors.primaryForeground} size={14} />
                      )}
                    </View>

                    {/* Info */}
                    <View className="flex-1">
                      <Text className="font-semibold">{resource.name}</Text>
                      {resource.className && (
                        <View className="mt-1 flex-row items-center gap-1">
                          <School color={colors.mutedForeground} size={13} />
                          <Text variant="muted" className="text-sm">
                            {resource.className}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Already-imported children */}
        {alreadyImported.length > 0 && (
          <View className="mt-6 gap-3">
            <Text variant="muted" className="text-xs font-semibold uppercase tracking-wider">
              Déjà ajoutés
            </Text>
            {alreadyImported.map((resource) => (
              <Card
                key={resource.id}
                className="overflow-hidden rounded-xl border p-4 opacity-50"
                style={{ borderColor: borderColors.muted[20] }}
              >
                <View className="flex-row items-center gap-3">
                  <View
                    className="h-6 w-6 items-center justify-center rounded-md"
                    style={{ backgroundColor: bgColors.muted[30] }}
                  />
                  <View className="flex-1">
                    <Text className="font-semibold">{resource.name}</Text>
                    <View className="mt-1 flex-row items-center gap-2">
                      {resource.className && (
                        <>
                          <School color={colors.mutedForeground} size={13} />
                          <Text variant="muted" className="text-sm">
                            {resource.className}
                          </Text>
                        </>
                      )}
                      <Text variant="muted" className="text-xs italic">
                        (déjà ajouté)
                      </Text>
                    </View>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* Empty state */}
        {available.length === 0 && alreadyImported.length === 0 && (
          <View className="items-center py-8">
            <Text variant="muted" className="text-center">
              Aucun enfant trouvé dans votre compte Pronote.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View
        className="border-t px-4 py-4"
        style={{ borderColor: colors.border }}
      >
        <Button
          onPress={handleContinue}
          disabled={selectedCount === 0 || isSubmitting}
        >
          <Text className="font-semibold text-white dark:text-stone-900">
            {isSubmitting
              ? 'En cours...'
              : selectedCount > 0
                ? `Continuer (${selectedCount})`
                : 'Continuer'}
          </Text>
        </Button>
      </View>
    </View>
  );
}
