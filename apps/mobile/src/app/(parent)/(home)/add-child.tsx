/**
 * Add Child Screen - TomAI 2026
 *
 * Dedicated route replacing CreateChildModal.
 * Uses react-hook-form + Zod for validation.
 */

import { useState } from 'react';
import { View, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Wand2, Eye, EyeOff, ChevronDown } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { LevelPickerSheet } from '@/components/parent';
import { useParentDashboard, useThemeColors } from '@/hooks';
import {
  createChildFormSchema,
  type CreateChildFormData,
  formatDateInput,
  toIsoDate,
  generateUsername,
  generatePassword,
} from '@/lib/child-form-schema';
import { getLevelLabel } from '@/constants/levels';
import type { EducationLevelType } from '@/constants/levels';

// react-hook-form's watch() is incompatible with React Compiler memoization
/* eslint-disable react-hooks/incompatible-library */
export default function AddChildScreen() {
  const router = useRouter();
  const toast = useToast();
  const colors = useThemeColors();
  const { createChild, isCreating } = useParentDashboard();

  const [showLevelPicker, setShowLevelPicker] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid },
  } = useForm<CreateChildFormData>({
    resolver: zodResolver(createChildFormSchema),
    mode: 'onChange',
    defaultValues: {
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      schoolLevel: '' as EducationLevelType,
      username: '',
      password: '',
    },
  });

  const firstName = watch('firstName');
  const lastName = watch('lastName');
  const selectedLevel = watch('schoolLevel');

  const handleGenerate = () => {
    if (firstName && lastName) {
      setValue('username', generateUsername(firstName, lastName), { shouldValidate: true });
    }
    setValue('password', generatePassword(), { shouldValidate: true });
    setShowPassword(true);
  };

  const onSubmit = async (data: CreateChildFormData) => {
    try {
      await createChild({
        firstName: data.firstName,
        lastName: data.lastName,
        username: data.username,
        password: data.password,
        schoolLevel: data.schoolLevel,
        dateOfBirth: toIsoDate(data.dateOfBirth),
      });
      toast.success('Enfant cree', `${data.firstName} peut maintenant utiliser Tom !`);
      router.back();
    } catch (error) {
      toast.error('Erreur', error instanceof Error ? error.message : 'Erreur lors de la creation');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-stone-50 dark:bg-stone-900" edges={['bottom']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 py-5 gap-6"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Section: Identite */}
          <View>
            <Text className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-400">
              Identite
            </Text>

            {/* Prenom */}
            <View className="mb-3">
              <Text className="mb-1 text-sm font-medium">Prenom</Text>
              <Controller
                control={control}
                name="firstName"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Prenom de l'enfant"
                    autoFocus
                    autoCapitalize="words"
                    className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-4 py-3 text-base text-stone-900 dark:text-stone-100"
                    placeholderTextColor="#9ca3af"
                  />
                )}
              />
              {errors.firstName && <Text className="mt-1 text-xs text-red-500">{errors.firstName.message}</Text>}
            </View>

            {/* Nom */}
            <View className="mb-3">
              <Text className="mb-1 text-sm font-medium">Nom</Text>
              <Controller
                control={control}
                name="lastName"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Nom de famille"
                    autoCapitalize="words"
                    className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-4 py-3 text-base text-stone-900 dark:text-stone-100"
                    placeholderTextColor="#9ca3af"
                  />
                )}
              />
              {errors.lastName && <Text className="mt-1 text-xs text-red-500">{errors.lastName.message}</Text>}
            </View>

            {/* Date de naissance */}
            <View className="mb-3">
              <Text className="mb-1 text-sm font-medium">Date de naissance</Text>
              <Controller
                control={control}
                name="dateOfBirth"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={(raw) => onChange(formatDateInput(raw, value))}
                    placeholder="JJ/MM/AAAA"
                    keyboardType="number-pad"
                    maxLength={10}
                    className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-4 py-3 text-base text-stone-900 dark:text-stone-100"
                    placeholderTextColor="#9ca3af"
                  />
                )}
              />
              {errors.dateOfBirth && <Text className="mt-1 text-xs text-red-500">{errors.dateOfBirth.message}</Text>}
            </View>

            {/* Niveau scolaire */}
            <View className="mb-3">
              <Text className="mb-1 text-sm font-medium">Niveau scolaire</Text>
              <TouchableOpacity
                onPress={() => setShowLevelPicker(true)}
                className="flex-row items-center justify-between rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-4 py-3"
              >
                <Text className={selectedLevel ? 'text-base text-stone-900 dark:text-stone-100' : 'text-base text-stone-400'}>
                  {selectedLevel ? getLevelLabel(selectedLevel) : 'Selectionner le niveau'}
                </Text>
                <ChevronDown color={colors.muted} size={18} />
              </TouchableOpacity>
              {errors.schoolLevel && <Text className="mt-1 text-xs text-red-500">{errors.schoolLevel.message}</Text>}
            </View>
          </View>

          {/* Section: Identifiants */}
          <View>
            <Text className="mb-1 text-sm font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-400">
              Identifiants de connexion
            </Text>
            <Text variant="muted" className="mb-3 text-xs">
              Ces identifiants permettront a votre enfant de se connecter a Tom.
            </Text>

            {/* Generate button */}
            <TouchableOpacity
              onPress={handleGenerate}
              className="mb-3 flex-row items-center justify-center gap-2 rounded-xl border border-stone-300 dark:border-stone-600 py-2.5"
            >
              <Wand2 color={colors.primary} size={16} />
              <Text className="font-medium text-sm" style={{ color: colors.primary }}>
                Generer automatiquement
              </Text>
            </TouchableOpacity>

            {/* Username */}
            <View className="mb-3">
              <Text className="mb-1 text-sm font-medium">Nom d&apos;utilisateur</Text>
              <Controller
                control={control}
                name="username"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Nom d'utilisateur"
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-4 py-3 text-base text-stone-900 dark:text-stone-100"
                    placeholderTextColor="#9ca3af"
                  />
                )}
              />
              {errors.username && <Text className="mt-1 text-xs text-red-500">{errors.username.message}</Text>}
            </View>

            {/* Password */}
            <View className="mb-1">
              <Text className="mb-1 text-sm font-medium">Mot de passe</Text>
              <View className="flex-row items-center rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800">
                <Controller
                  control={control}
                  name="password"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="Mot de passe"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      className="flex-1 px-4 py-3 text-base text-stone-900 dark:text-stone-100"
                      placeholderTextColor="#9ca3af"
                    />
                  )}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="px-3">
                  {showPassword ? (
                    <EyeOff color={colors.muted} size={20} />
                  ) : (
                    <Eye color={colors.muted} size={20} />
                  )}
                </TouchableOpacity>
              </View>
              {errors.password && <Text className="mt-1 text-xs text-red-500">{errors.password.message}</Text>}
              <Text variant="muted" className="mt-1 text-xs">
                Min. 8 caracteres, 1 majuscule, 1 minuscule, 1 chiffre
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Sticky submit button */}
        <View className="border-t border-stone-200 dark:border-stone-700 px-5 py-4">
          <Button
            onPress={handleSubmit(onSubmit)}
            disabled={!isValid || isCreating}
            style={{ opacity: !isValid || isCreating ? 0.5 : 1 }}
          >
            <Text className="font-semibold text-white dark:text-stone-900">
              {isCreating ? 'Creation en cours...' : 'Creer le compte'}
            </Text>
          </Button>
        </View>
      </KeyboardAvoidingView>

      <LevelPickerSheet
        visible={showLevelPicker}
        onClose={() => setShowLevelPicker(false)}
        onSelect={(level) => setValue('schoolLevel', level, { shouldValidate: true })}
        selectedLevel={selectedLevel}
      />
    </SafeAreaView>
  );
}
