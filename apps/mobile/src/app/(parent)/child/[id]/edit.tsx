/**
 * Edit Child Screen
 *
 * Allows parents to update child's school level and LV2.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
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
  Globe,
  Check,
  ChevronDown,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useParentDashboard } from '@/hooks';
import {
  getLevelLabel,
  isLv2Eligible as checkLv2Eligible,
  LV2_OPTIONS,
  LV2_ELIGIBLE_LEVELS,
  type EducationLevelType,
  type Lv2Option,
} from '@/constants/levels';
import { bgColors } from '@/lib/styles';

// ============================================================================
// COMPONENT
// ============================================================================

export default function EditChildScreen() {
  const router = useRouter();
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
  const [selectedLv2, setSelectedLv2] = useState<Lv2Option | null>(
    child?.selectedLv2 ?? null
  );

  // Modal states
  const [showLevelPicker, setShowLevelPicker] = useState(false);
  const [showLv2Picker, setShowLv2Picker] = useState(false);

  // Check if LV2 is available for selected level
  const isLv2Eligible = schoolLevel ? checkLv2Eligible(schoolLevel) : false;

  // Has changes
  const hasChanges =
    schoolLevel !== child?.schoolLevel || selectedLv2 !== child?.selectedLv2;

  // Handle save
  const handleSave = useCallback(async () => {
    if (!id || !child || !hasChanges) return;

    try {
      const updateData: Partial<{ schoolLevel: EducationLevelType; selectedLv2: Lv2Option | null }> = {};

      if (schoolLevel && schoolLevel !== child.schoolLevel) {
        updateData.schoolLevel = schoolLevel;
      }

      if (selectedLv2 !== child.selectedLv2) {
        updateData.selectedLv2 = isLv2Eligible ? selectedLv2 : null;
      }

      await updateChild({ childId: id, data: updateData });

      Alert.alert('Succès', 'Profil mis à jour avec succès', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert(
        'Erreur',
        error instanceof Error ? error.message : 'Impossible de mettre à jour le profil'
      );
    }
  }, [id, child, schoolLevel, selectedLv2, isLv2Eligible, hasChanges, updateChild, router]);

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
          <TouchableOpacity onPress={() => router.back()} className="p-1">
            <ArrowLeft color="hsl(222.2, 47.4%, 11.2%)" size={24} />
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
          <View className="mb-4">
            <Text className="mb-2 font-medium">Niveau scolaire</Text>
            <TouchableOpacity
              onPress={() => setShowLevelPicker(true)}
              className="flex-row items-center justify-between rounded-xl border border-border bg-card px-4 py-4"
            >
              <View className="flex-row items-center gap-3">
                <GraduationCap color="hsl(222.2, 47.4%, 11.2%)" size={20} />
                <Text>
                  {schoolLevel ? getLevelLabel(schoolLevel) : 'Sélectionner'}
                </Text>
              </View>
              <ChevronDown color="hsl(215.4, 16.3%, 46.9%)" size={20} />
            </TouchableOpacity>
          </View>

          {/* LV2 */}
          <View className="mb-6">
            <Text className="mb-2 font-medium">LV2</Text>
            <TouchableOpacity
              onPress={() => isLv2Eligible && setShowLv2Picker(true)}
              disabled={!isLv2Eligible}
              className="flex-row items-center justify-between rounded-xl border border-border bg-card px-4 py-4"
              style={!isLv2Eligible ? { opacity: 0.5 } : undefined}
            >
              <View className="flex-row items-center gap-3">
                <Globe color="hsl(222.2, 47.4%, 11.2%)" size={20} />
                <Text>
                  {isLv2Eligible
                    ? selectedLv2
                      ? LV2_OPTIONS.find((o) => o.value === selectedLv2)?.label ?? selectedLv2
                      : 'Sélectionner'
                    : 'Disponible à partir de la 5ème'}
                </Text>
              </View>
              {isLv2Eligible && <ChevronDown color="hsl(215.4, 16.3%, 46.9%)" size={20} />}
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
                    // Reset LV2 if new level is not eligible
                    if (!LV2_ELIGIBLE_LEVELS.includes(item.key)) {
                      setSelectedLv2(null);
                    }
                    setShowLevelPicker(false);
                  }}
                  className="flex-row items-center justify-between border-b border-border px-4 py-4"
                >
                  <Text>{getLevelLabel(item.key)}</Text>
                  {schoolLevel === item.key && (
                    <Check color="hsl(142, 76%, 36%)" size={20} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* LV2 Picker Modal */}
      <Modal
        visible={showLv2Picker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowLv2Picker(false)}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: bgColors.black[50] }}>
          <View className="rounded-t-3xl bg-card">
            <View className="flex-row items-center justify-between border-b border-border p-4">
              <Text className="font-semibold">Langue vivante 2</Text>
              <TouchableOpacity onPress={() => setShowLv2Picker(false)}>
                <Text className="text-primary">Fermer</Text>
              </TouchableOpacity>
            </View>
            {LV2_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                onPress={() => {
                  setSelectedLv2(option.value);
                  setShowLv2Picker(false);
                }}
                className="flex-row items-center justify-between border-b border-border px-4 py-4"
              >
                <Text>{option.label}</Text>
                {selectedLv2 === option.value && (
                  <Check color="hsl(142, 76%, 36%)" size={20} />
                )}
              </TouchableOpacity>
            ))}
            {/* Clear option */}
            <TouchableOpacity
              onPress={() => {
                setSelectedLv2(null);
                setShowLv2Picker(false);
              }}
              className="px-4 py-4"
            >
              <Text variant="muted">Aucune</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
