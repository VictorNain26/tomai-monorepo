/**
 * AddChild Screen — manual child creation (Pronote-independent)
 *
 * Collects: firstName, lastName, username, password, schoolLevel, dateOfBirth.
 * Matches createChildSchema (server/src/schemas/validation.ts):
 *   - username: min 3, max 30, [a-zA-Z0-9_.]
 *   - password: min 8, must contain lower+upper+digit
 *   - dateOfBirth: YYYY-MM-DD, age 5-19
 * On success → router.back(). On error → inline error banner.
 */

import { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';

import { SafeAreaView } from '@/components/ui/safe-area-view';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useParentDashboard } from '@/hooks/useParentDashboard';
import { LevelPicker } from './add-child-level-picker';
import type { EducationLevelType } from '@/constants/levels';

// ============================================================================
// VALIDATION
// ============================================================================

interface FormValues {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  dateOfBirth: string;
  schoolLevel: EducationLevelType;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  username?: string;
  password?: string;
  dateOfBirth?: string;
  schoolLevel?: string;
  api?: string;
}

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};

  if (!values.firstName.trim()) {
    errors.firstName = 'Prénom requis';
  }
  if (!values.lastName.trim()) {
    errors.lastName = 'Nom requis';
  }
  if (!values.username.trim()) {
    errors.username = 'Identifiant requis';
  } else if (values.username.trim().length < 3) {
    errors.username = 'Identifiant : 3 caractères minimum';
  } else if (values.username.trim().length > 30) {
    errors.username = 'Identifiant : 30 caractères maximum';
  } else if (!/^[a-zA-Z0-9_.]+$/.test(values.username.trim())) {
    errors.username = 'Identifiant : lettres, chiffres, points, underscores';
  }
  if (!values.password) {
    errors.password = 'Mot de passe requis';
  } else if (values.password.length < 8) {
    errors.password = 'Mot de passe : 8 caractères minimum';
  } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(values.password)) {
    errors.password = 'Mot de passe : majuscule, minuscule, chiffre requis';
  }
  if (!values.dateOfBirth) {
    errors.dateOfBirth = 'Date de naissance requise';
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(values.dateOfBirth)) {
    errors.dateOfBirth = 'Format : AAAA-MM-JJ';
  } else {
    const parsed = new Date(values.dateOfBirth + 'T00:00:00Z');
    if (isNaN(parsed.getTime())) {
      errors.dateOfBirth = 'Date invalide';
    } else {
      const now = new Date();
      let age = now.getFullYear() - parsed.getFullYear();
      const monthDiff = now.getMonth() - parsed.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < parsed.getDate())) {
        age--;
      }
      if (age < 5 || age > 19) {
        errors.dateOfBirth = 'Âge doit être entre 5 et 19 ans';
      }
    }
  }

  return errors;
}

function hasErrors(errors: FormErrors): boolean {
  return Object.keys(errors).length > 0;
}

function passwordStrength(password: string): 'weak' | 'medium' | 'strong' {
  if (password.length < 8) return 'weak';
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  const score = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;
  if (score <= 2) return 'weak';
  if (score === 3) return 'medium';
  return 'strong';
}

// ============================================================================
// PASSWORD STRENGTH INDICATOR
// ============================================================================

function PasswordStrengthBar({ password }: { password: string }) {
  if (!password) return null;
  const strength = passwordStrength(password);
  const label =
    strength === 'weak' ? 'Faible' : strength === 'medium' ? 'Moyen' : 'Fort';
  const barClass =
    strength === 'weak'
      ? 'bg-destructive'
      : strength === 'medium'
        ? 'bg-warning'
        : 'bg-success';
  const width = strength === 'weak' ? 'w-1/3' : strength === 'medium' ? 'w-2/3' : 'w-full';

  return (
    <View className="mt-1 gap-1">
      <View className="h-1 w-full rounded-full bg-muted">
        <View className={`h-1 rounded-full ${barClass} ${width}`} />
      </View>
      <Text variant="tiny">{`Force : ${label}`}</Text>
    </View>
  );
}

// ============================================================================
// SCREEN
// ============================================================================

const DEFAULT_LEVEL: EducationLevelType = 'sixieme';

export default function AddChildScreen() {
  const router = useRouter();
  const { createChild, isCreating } = useParentDashboard();

  const [values, setValues] = useState<FormValues>({
    firstName: '',
    lastName: '',
    username: '',
    password: '',
    dateOfBirth: '',
    schoolLevel: DEFAULT_LEVEL,
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const set = useCallback(
    <K extends keyof FormValues>(field: K, value: FormValues[K]) => {
      setValues((prev) => ({ ...prev, [field]: value }));
      // Clear field-specific error on change
      setErrors((prev) => {
        if (!prev[field as keyof FormErrors]) return prev;
        const next = { ...prev };
        delete next[field as keyof FormErrors];
        return next;
      });
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    const fieldErrors = validate(values);
    if (hasErrors(fieldErrors)) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    try {
      await createChild({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        username: values.username.trim().toLowerCase(),
        password: values.password,
        schoolLevel: values.schoolLevel,
        dateOfBirth: values.dateOfBirth,
      });
      router.back();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Une erreur est survenue. Veuillez réessayer.';
      setErrors({ api: message });
    }
  }, [values, createChild, router]);

  // First field-level error or api error for the banner
  const bannerError =
    errors.api ??
    errors.firstName ??
    errors.lastName ??
    errors.username ??
    errors.password ??
    errors.dateOfBirth;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-6 py-8 gap-6"
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View className="gap-1">
            <Text variant="h2">Ajouter un enfant</Text>
            <Text variant="muted">
              Créez un profil pour accéder aux fonctionnalités de suivi.
            </Text>
          </View>

          {/* Error banner */}
          {bannerError ? (
            <View
              className="rounded-lg bg-destructive/10 px-4 py-3"
              accessibilityLiveRegion="assertive"
              testID="add-child-error"
            >
              <Text variant="error">{bannerError}</Text>
            </View>
          ) : null}

          {/* First name */}
          <Input
            label="Prénom"
            placeholder="ex. Alice"
            value={values.firstName}
            onChangeText={(v) => set('firstName', v)}
            variant={errors.firstName ? 'error' : 'default'}
            errorMessage={errors.firstName}
            accessibilityLabel="Prénom de l'enfant"
            autoCapitalize="words"
            autoCorrect={false}
            testID="add-child-first-name"
          />

          {/* Last name */}
          <Input
            label="Nom"
            placeholder="ex. Dupont"
            value={values.lastName}
            onChangeText={(v) => set('lastName', v)}
            variant={errors.lastName ? 'error' : 'default'}
            errorMessage={errors.lastName}
            accessibilityLabel="Nom de famille de l'enfant"
            autoCapitalize="words"
            autoCorrect={false}
            testID="add-child-last-name"
          />

          {/* Username */}
          <Input
            label="Identifiant"
            placeholder="ex. alice.dupont (min. 3 caractères)"
            value={values.username}
            onChangeText={(v) => set('username', v)}
            variant={errors.username ? 'error' : 'default'}
            errorMessage={errors.username}
            accessibilityLabel="Identifiant de connexion de l'enfant"
            autoCapitalize="none"
            autoCorrect={false}
            testID="add-child-username"
          />

          {/* Password */}
          <View className="gap-1">
            <Input
              label="Mot de passe"
              placeholder="min. 8 caractères"
              value={values.password}
              onChangeText={(v) => set('password', v)}
              variant={errors.password ? 'error' : 'default'}
              errorMessage={errors.password}
              accessibilityLabel="Mot de passe de l'enfant"
              secureTextEntry
              testID="add-child-password"
            />
            <PasswordStrengthBar password={values.password} />
          </View>

          {/* Date of birth */}
          <Input
            label="Date de naissance"
            placeholder="AAAA-MM-JJ (ex. 2012-05-15)"
            value={values.dateOfBirth}
            onChangeText={(v) => set('dateOfBirth', v)}
            variant={errors.dateOfBirth ? 'error' : 'default'}
            errorMessage={errors.dateOfBirth}
            accessibilityLabel="Date de naissance de l'enfant au format AAAA-MM-JJ"
            keyboardType="numeric"
            maxLength={10}
            testID="add-child-dob"
          />

          {/* School level */}
          <LevelPicker
            value={values.schoolLevel}
            onChange={(v) => set('schoolLevel', v)}
          />

          {/* Submit */}
          <Button
            onPress={handleSubmit}
            isLoading={isCreating}
            disabled={isCreating}
            accessibilityLabel="Créer le profil enfant"
            accessibilityHint="Soumet le formulaire et crée le compte enfant"
            className="mt-2"
            testID="add-child-submit"
          >
            Créer le profil
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
