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

import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useParentDashboard } from '@/hooks/useParentDashboard';
import { ChildCredentialsFields } from '@/components/parent/ChildCredentialsFields';
import type { ChildCredentialsErrors } from '@/components/parent/ChildCredentialsFields';
import { validateUsername, validatePassword } from '@/lib/child-credential-validators';
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

interface FormErrors extends ChildCredentialsErrors {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
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

  const usernameError = validateUsername(values.username);
  if (usernameError) errors.username = usernameError;

  const passwordError = validatePassword(values.password);
  if (passwordError) errors.password = passwordError;

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

  const handleCredentialsChange = useCallback(
    (field: 'username' | 'password' | 'schoolLevel', value: string) => {
      set(field as keyof FormValues, value as FormValues[keyof FormValues]);
    },
    [set]
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
    <Screen edges={['top', 'bottom']}>
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

          {/* Credentials: username + password + level */}
          <ChildCredentialsFields
            username={values.username}
            password={values.password}
            schoolLevel={values.schoolLevel}
            onChange={handleCredentialsChange}
            errors={{ username: errors.username, password: errors.password }}
          />

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
    </Screen>
  );
}
