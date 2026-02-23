/**
 * Reset Password Screen
 *
 * Handles password reset with token from email link.
 * Can be accessed via deep link: tomia://auth/reset-password?token=xxx
 */

import { useState, useEffect } from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import { Lock, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react-native';
import { resetPassword } from '@/lib/auth';

import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useIconColors } from '@/hooks';
import { bgColors, colors } from '@/lib/styles';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const toast = useToast();
  const { token } = useLocalSearchParams<{ token?: string }>();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const iconColors = useIconColors();
  const [tokenValid, setTokenValid] = useState(true);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenValid(false);
    }
  }, [token]);

  function validatePassword(value: string): string | null {
    if (!value) return 'Mot de passe requis';
    if (value.length < 8) return 'Minimum 8 caractères';
    if (!/[A-Z]/.test(value)) return 'Une majuscule requise';
    if (!/[a-z]/.test(value)) return 'Une minuscule requise';
    if (!/[0-9]/.test(value)) return 'Un chiffre requis';
    return null;
  }

  async function handleResetPassword() {
    if (!token) {
      toast.error('Erreur', 'Token de réinitialisation manquant');
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      toast.error('Erreur', passwordError);
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }

    setIsLoading(true);

    try {
      await resetPassword(token, password);
      setResetSuccess(true);
    } catch (error) {
      toast.error(
        'Erreur',
        (error as Error).message || 'Impossible de réinitialiser le mot de passe'
      );
    } finally {
      setIsLoading(false);
    }
  }

  // Success state
  if (resetSuccess) {
    return (
      <View className="flex-1 justify-center bg-background px-6">
        <View className="items-center">
          <View className="mb-6 h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: bgColors.success[10] }}>
            <CheckCircle color={colors.success.DEFAULT} size={32} />
          </View>

          <Text variant="h2" className="text-center">
            Mot de passe modifié !
          </Text>

          <Text variant="muted" className="mt-4 text-center">
            Votre mot de passe a été réinitialisé avec succès.
            Vous pouvez maintenant vous connecter.
          </Text>

          <Button
            onPress={() => router.replace('/(auth)/login')}
            className="mt-8 w-full"
          >
            <Text className="font-semibold text-primary-foreground">
              Se connecter
            </Text>
          </Button>
        </View>
      </View>
    );
  }

  // Invalid token state
  if (!tokenValid) {
    return (
      <View className="flex-1 justify-center bg-background px-6">
        <View className="items-center">
          <View className="mb-6 h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: bgColors.destructive[10] }}>
            <AlertCircle color={colors.destructive.DEFAULT} size={32} />
          </View>

          <Text variant="h2" className="text-center">
            Lien invalide
          </Text>

          <Text variant="muted" className="mt-4 text-center">
            Ce lien de récupération est expiré ou invalide.
            Les liens expirent après 24 heures.
          </Text>

          <Button
            onPress={() => router.push('/(auth)/forgot-password')}
            className="mt-8 w-full"
          >
            <Text className="font-semibold text-primary-foreground">
              Demander un nouveau lien
            </Text>
          </Button>

          <Link href="/(auth)/login" asChild>
            <TouchableOpacity className="mt-4" accessibilityLabel="Retour à la connexion">
              <Text className="text-primary">Retour à la connexion</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    );
  }

  // Form state
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 justify-center px-6 py-12">
          {/* Back button */}
          <TouchableOpacity
            onPress={() => router.back()}
            className="absolute left-6 top-16 flex-row items-center"
            style={{ minHeight: 44 }}
            accessibilityLabel="Retour"
            accessibilityRole="button"
          >
            <ArrowLeft color={iconColors.foreground} size={20} />
            <Text className="ml-1 text-primary">Retour</Text>
          </TouchableOpacity>

          {/* Header */}
          <View className="mb-8 items-center">
            <View className="mb-6 h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: bgColors.primary[10] }}>
              <Lock color={iconColors.foreground} size={32} />
            </View>

            <Text variant="h2" className="text-center">
              Nouveau mot de passe
            </Text>

            <Text variant="muted" className="mt-2 text-center">
              Choisissez un mot de passe sécurisé (min. 8 caractères, majuscule,
              minuscule, chiffre)
            </Text>
          </View>

          {/* Form */}
          <View className="gap-4">
            <View>
              <Text variant="small" className="mb-2 font-medium">
                Nouveau mot de passe
              </Text>
              <Input
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                disabled={isLoading}
              />
            </View>

            <View>
              <Text variant="small" className="mb-2 font-medium">
                Confirmer le mot de passe
              </Text>
              <Input
                placeholder="••••••••"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                disabled={isLoading}
              />
            </View>

            <Button
              onPress={handleResetPassword}
              disabled={isLoading}
              className="mt-4"
            >
              <Text className="font-semibold text-primary-foreground">
                {isLoading ? 'Modification...' : 'Confirmer le mot de passe'}
              </Text>
            </Button>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
