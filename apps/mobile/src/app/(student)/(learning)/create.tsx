/**
 * Create Deck Screen - AI Generation
 *
 * 2-step form: Subject -> Domain/Theme -> AI generates deck
 * Uses backend /api/learning/generate for AI card generation
 */

import { useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Book,
  FolderOpen,
  ChevronRight,
  Sparkles,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { shadows, bgColors } from '@/lib/styles';
import {
  useGenerateDeck,
  useLearningSubjects,
  useLearningTopics,
  type LearningSubject,
  type SchoolLevel,
} from '@/hooks/useLearning';
import { useUser } from '@/lib/auth';
import { useTheme, useThemeColors } from '@/hooks';

// ============================================================================
// TYPES
// ============================================================================

type Step = 'subject' | 'theme';

// ============================================================================
// COMPONENT
// ============================================================================

export default function CreateDeckScreen() {
  const router = useRouter();
  const toast = useToast();
  const user = useUser();
  const colors = useThemeColors();
  const { isDark } = useTheme();
  // schoolLevel is a runtime-valid stored level; narrow once at this boundary
  const niveau = (user?.schoolLevel ?? 'sixieme') as SchoolLevel;

  const [step, setStep] = useState<Step>('subject');
  const [selectedSubject, setSelectedSubject] = useState<LearningSubject | null>(null);

  const subjectsQuery = useLearningSubjects(niveau);
  const topicsQuery = useLearningTopics(selectedSubject?.id ?? '', niveau);
  const generateMutation = useGenerateDeck();

  // Handle subject selection
  const handleSelectSubject = (subject: LearningSubject) => {
    setSelectedSubject(subject);
    setStep('theme');
  };

  // Handle theme selection - triggers AI generation
  const handleSelectTheme = async (domaine: string, theme?: string) => {
    if (!selectedSubject) return;

    try {
      const result = await generateMutation.mutateAsync({
        subject: selectedSubject.id,
        domaine,
        topic: theme,
      });

      toast.success('Deck généré !', `${result.cards.length} cartes créées sur "${theme ?? domaine}"`);
      // Navigate to deck detail - updated path for new structure
      router.replace(`/(student)/(learning)/${result.deck.id}`);
    } catch (error) {
      const err = error as { code?: string; message?: string };

      if (err.code === 'SUBSCRIPTION_REQUIRED') {
        toast.warning(
          'Abonnement requis',
          'Demande à tes parents de souscrire un abonnement pour générer des cartes de révision.'
        );
        return;
      }

      if (err.code === 'DECK_LIMIT_REACHED') {
        toast.warning(
          'Limite atteinte',
          'Tu as atteint ta limite de decks. Reviens demain !'
        );
        return;
      }

      toast.error('Erreur', err.message ?? 'Impossible de générer le deck.');
    }
  };

  // Handle back navigation
  const handleBack = () => {
    if (generateMutation.isPending) return;

    if (step === 'theme') {
      setStep('subject');
      setSelectedSubject(null);
    } else {
      router.back();
    }
  };

  // Step indicator
  const stepNumber = step === 'subject' ? 1 : 2;

  return (
    <SafeAreaView className="flex-1 bg-stone-50 dark:bg-stone-900">
      {/* Loading overlay during generation */}
      {generateMutation.isPending && (
        <View className="absolute inset-0 z-50 items-center justify-center" style={{ backgroundColor: isDark ? 'rgba(28, 25, 23, 0.9)' : 'rgba(250, 250, 249, 0.9)' }}>
          <View className="items-center gap-4 rounded-2xl bg-white dark:bg-stone-800 p-8" style={shadows.lg}>
            <ActivityIndicator size="large" color={colors.primary} />
            <View className="items-center gap-2">
              <Text className="text-lg font-semibold">Génération en cours...</Text>
              <Text variant="muted" className="text-center">
                L'IA crée tes cartes de révision
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Header */}
      <View className="flex-row items-center gap-3 border-b border-stone-200 dark:border-stone-700 px-4 py-3">
        <TouchableOpacity
          onPress={handleBack}
          disabled={generateMutation.isPending}
          className="h-10 w-10 items-center justify-center rounded-full"
          accessibilityLabel="Retour"
          accessibilityRole="button"
        >
          <ArrowLeft color={generateMutation.isPending ? colors.mutedForeground : colors.foreground} size={24} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text variant="h3">Créer un deck</Text>
          <Text variant="muted" className="text-sm">
            Étape {stepNumber}/2
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 py-6"
        contentContainerStyle={{ flexGrow: 1 }}
      >
          {/* STEP 1: Subject Selection */}
          {step === 'subject' && (
            <>
              <View className="mb-4 flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-blue-600 dark:bg-blue-400">
                  <Book color="white" size={20} />
                </View>
                <View>
                  <Text className="font-semibold">Choisir une matière</Text>
                  <Text variant="muted" className="text-sm">
                    Sélectionne la matière pour ton deck
                  </Text>
                </View>
              </View>

              {subjectsQuery.isLoading && (
                <View className="gap-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </View>
              )}

              {subjectsQuery.error && (
                <View className="rounded-xl p-4" style={{ backgroundColor: bgColors.destructive[10] }}>
                  <Text className="text-center text-red-600 dark:text-red-400">
                    Erreur de chargement des matières
                  </Text>
                </View>
              )}

              {subjectsQuery.data && (
                <View className="gap-3">
                  {subjectsQuery.data.map((subject) => (
                    <TouchableOpacity
                      key={subject.id}
                      onPress={() => handleSelectSubject(subject)}
                      className="flex-row items-center justify-between rounded-xl bg-white dark:bg-stone-800 p-4"
                      activeOpacity={0.7}
                    >
                      <Text className="text-base font-medium">{subject.label}</Text>
                      <ChevronRight color={colors.mutedForeground} size={20} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          {/* STEP 2: Theme Selection */}
          {step === 'theme' && (
            <>
              <View className="mb-4 flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-blue-600 dark:bg-blue-400">
                  <FolderOpen color="white" size={20} />
                </View>
                <View className="flex-1">
                  <Text className="font-semibold">Choisir un thème</Text>
                  <Text variant="muted" className="text-sm">
                    {selectedSubject?.label}
                  </Text>
                </View>
              </View>

              {topicsQuery.isLoading && (
                <View className="gap-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-xl" />
                  ))}
                </View>
              )}

              {topicsQuery.error && (
                <View className="rounded-xl p-4" style={{ backgroundColor: bgColors.destructive[10] }}>
                  <Text className="text-center text-red-600 dark:text-red-400">
                    Erreur de chargement des thèmes
                  </Text>
                </View>
              )}

              {topicsQuery.data && topicsQuery.data.length === 0 && (
                <View className="items-center py-8">
                  <Text variant="muted">Aucun thème disponible</Text>
                </View>
              )}

              {topicsQuery.data && topicsQuery.data.length > 0 && (
                <View className="gap-4" pointerEvents={generateMutation.isPending ? 'none' : 'auto'}>
                  {topicsQuery.data.map((domaine) => (
                    <View
                      key={domaine.domaine}
                      className="rounded-xl bg-white dark:bg-stone-800"
                      style={generateMutation.isPending ? { opacity: 0.5 } : undefined}
                    >
                      {/* Domaine header - clickable for whole domaine */}
                      <TouchableOpacity
                        onPress={() => handleSelectTheme(domaine.domaine)}
                        disabled={generateMutation.isPending}
                        className="flex-row items-center justify-between border-b border-stone-200 dark:border-stone-700 p-4"
                        activeOpacity={0.7}
                      >
                        <Text className="flex-1 font-semibold">{domaine.domaine}</Text>
                        <View className="flex-row items-center gap-2">
                          <Text variant="muted" className="text-sm">
                            {domaine.themes.length} thèmes
                          </Text>
                          <Sparkles color={colors.success} size={16} />
                        </View>
                      </TouchableOpacity>

                      {/* Individual themes */}
                      {domaine.themes.map((theme, index) => (
                        <TouchableOpacity
                          key={theme}
                          onPress={() => handleSelectTheme(domaine.domaine, theme)}
                          disabled={generateMutation.isPending}
                          className={`flex-row items-center justify-between px-4 py-3 ${
                            index !== domaine.themes.length - 1
                              ? 'border-b border-stone-200 dark:border-stone-700'
                              : ''
                          }`}
                          activeOpacity={0.7}
                        >
                          <Text className="flex-1 text-sm">{theme}</Text>
                          <ChevronRight color={colors.mutedForeground} size={16} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

      </ScrollView>
    </SafeAreaView>
  );
}
