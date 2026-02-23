/**
 * Edit Child Screen
 *
 * Allows parents to update child's school level.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  GraduationCap,
  Check,
  ChevronDown,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { useParentDashboard, useIconColors } from '@/hooks';
import {
  getLevelLabel,
  type EducationLevelType,
} from '@/constants/levels';
import { bgColors, colors } from '@/lib/styles';

// ============================================================================
// COMPONENT
// ============================================================================

export default function EditChildScreen() {
  const router = useRouter();
  const toast = useToast();
  const iconColors = useIconColors();
  const { id } = useLocalSearchParams<{ id: string }>();

  const {
    children,
    levels,
    isLoadingChildren,
    isLoadingLevels,
    updateChild,
    isUpdating,
  } = useParentDashboard();

  // Find child
  const child = useMemo(
    () => children.find((c) => c.id === id),
    [children, id]
  );

  // Form state (backend returns string, cast to typed values)
  const [schoolLevel, setSchoolLevel] = useState<EducationLevelType | null>(
    (child?.schoolLevel as EducationLevelType) ?? null
  );

  // Modal states
  const [showLevelPicker, setShowLevelPicker] = useState(false);

  // Has changes
  const hasChanges = schoolLevel !== child?.schoolLevel;

  // Handle save
  const handleSave = useCallback(async () => {
    if (!id || !child || !hasChanges) return;

    try {
      const updateData: Partial<{ schoolLevel: EducationLevelType }> = {};

      if (schoolLevel && schoolLevel !== child.schoolLevel) {
        updateData.schoolLevel = schoolLevel;
      }

      await updateChild({ childId: id, data: updateData });

      toast.success('Succès', 'Profil mis à jour avec succès');
      router.back();
    } catch (error) {
      toast.error(
        'Erreur',
        error instanceof Error ? error.message : 'Impossible de mettre à jour le profil'
      );
    }
  }, [id, child, schoolLevel, hasChanges, updateChild, router, toast]);

  // Loading state
  if (isLoadingChildren || isLoadingLevels || !id) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-6 w-32 rounded" />
        </View>
        <View className="flex-1 px-4 py-6">
          <Skeleton className="mb-4 h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </View>
      </SafeAreaView>
    );
  }

  // Child not found
  if (!child) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-destructive">Enfant non trouvé</Text>
          <Button onPress={() => router.back()} className="mt-4">
            <Text className="text-primary-foreground">Retour</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const fullName = `${child.firstName} ${child.lastName}`;

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full"
            accessibilityLabel="Retour"
            accessibilityRole="button"
          >
            <ArrowLeft color={iconColors.foreground} size={20} />
          </TouchableOpacity>
          <Text variant="h3">Modifier {child.firstName}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView className="flex-1 px-4 py-6">
          {/* Child Info */}
          <View className="mb-6 items-center">
            <View className="mb-3 h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: bgColors.primary[10] }}>
              <Text className="text-2xl">
                {fullName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text className="font-semibold">{fullName}</Text>
            <Text variant="muted" className="text-sm">
              @{child.username}
            </Text>
          </View>

          {/* School Level */}
          <View className="mb-6">
            <Text className="mb-2 font-medium">Niveau scolaire</Text>
            <TouchableOpacity
              onPress={() => setShowLevelPicker(true)}
              className="flex-row items-center justify-between rounded-xl border border-border bg-card px-4 py-4"
              accessibilityLabel="Sélectionner le niveau scolaire"
              accessibilityHint={schoolLevel ? getLevelLabel(schoolLevel) : 'Non sélectionné'}
            >
              <View className="flex-row items-center gap-3">
                <GraduationCap color={iconColors.foreground} size={20} />
                <Text>
                  {schoolLevel ? getLevelLabel(schoolLevel) : 'Sélectionner'}
                </Text>
              </View>
              <ChevronDown color={iconColors.muted} size={20} />
            </TouchableOpacity>
          </View>

          {/* Save Button */}
          <Button
            onPress={handleSave}
            disabled={!hasChanges || isUpdating}
            style={!hasChanges ? { opacity: 0.5 } : undefined}
          >
            <Text className="font-semibold text-primary-foreground">
              {isUpdating ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </Text>
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Level Picker Modal */}
      <Modal
        visible={showLevelPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowLevelPicker(false)}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: bgColors.black[50] }}>
          <View className="max-h-[70%] rounded-t-3xl bg-card">
            <View className="flex-row items-center justify-between border-b border-border p-4">
              <Text className="font-semibold">Niveau scolaire</Text>
              <TouchableOpacity onPress={() => setShowLevelPicker(false)}>
                <Text className="text-primary">Fermer</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={levels}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setSchoolLevel(item.key);
                    setShowLevelPicker(false);
                  }}
                  className="flex-row items-center justify-between border-b border-border px-4 py-4"
                >
                  <Text>{getLevelLabel(item.key)}</Text>
                  {schoolLevel === item.key && (
                    <Check color={colors.success.DEFAULT} size={20} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
