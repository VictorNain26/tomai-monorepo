/**
 * Register Screen - TomAI 2026
 *
 * Parent registration screen with progressive password validation.
 */

import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { Check, Circle } from 'lucide-react-native';
import { signUp, signInWithGoogle } from '@/lib/auth';

import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TomAvatar } from '@/components/common';
import { GoogleIcon } from '@/components/icons/google-icon';
import { AuthScreen } from '@/components/auth/auth-screen';
import { useThemeColors } from '@/hooks';
import { bgColors } from '@/lib/styles';

function PasswordCriterion({ met, label }: { met: boolean; label: string }) {
  const colors = useThemeColors();
  return (
    <View className="flex-row items-center gap-2">
      {met ? (
        <Check size={14} color={colors.success} />
      ) : (
        <Circle size={14} color={colors.mutedForeground} />
      )}
      <Text
        variant="tiny"
        className={met ? 'text-success' : 'text-stone-400'}
      >
        {label}
      </Text>
    </View>
  );
}

export default function RegisterScreen() {
  // Auth redirect handled by Stack.Protected in root _layout.tsx
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleRegister() {
    setIsLoading(true);
    setError(null);
    try {
      const result = await signInWithGoogle();
      if (result === null) return; // User cancelled
      if (result?.error) {
        setError(result.error.message ?? 'Impossible de se connecter avec Google');
      }
    } catch (err) {
      console.error('[Register] Google OAuth failed:', err);
      setError("Impossible de s'inscrire avec Google");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRegister() {
    setError(null);

    if (!name || !email || !password || !confirmPassword) {
      setError('Veuillez remplir tous les champs');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Adresse email invalide');
      return;
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setError('Le mot de passe doit contenir une majuscule');
      return;
    }

    if (!/[a-z]/.test(password)) {
      setError('Le mot de passe doit contenir une minuscule');
      return;
    }

    if (!/[0-9]/.test(password)) {
      setError('Le mot de passe doit contenir un chiffre');
      return;
    }

    setIsLoading(true);

    try {
      const result = await signUp({ email, password, name });

      if (result.error) {
        setError(result.error.message ?? "Erreur lors de l'inscription");
        return;
      }

      // Stack.Protected auto-redirects when session becomes available
    } catch (err) {
      console.error('[Register] Registration failed:', err);
      setError("Erreur lors de l'inscription. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthScreen>
      {/* Header */}
      <View className="mb-8 items-center">
        <TomAvatar size="lg" className="mb-4" />
        <Text variant="h1" className="text-center text-primary">
          Inscription
        </Text>
        <Text variant="muted" className="mt-2 text-center px-4">
          Créez votre compte pour suivre la scolarité de vos enfants
        </Text>
      </View>

      {/* Error message */}
      {error && (
        <View
          className="mb-4 rounded-xl p-3"
          style={{ backgroundColor: bgColors.destructive[10] }}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <Text className="text-center text-destructive">{error}</Text>
        </View>
      )}

      {/* Form */}
      <View className="gap-4">
        <Input
          label="Nom complet"
          placeholder="Marie Dupont"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoComplete="name"
          disabled={isLoading}
        />

        <Input
          label="Email"
          placeholder="marie.dupont@exemple.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          disabled={isLoading}
        />

        <Input
          label="Mot de passe"
          placeholder="8 caractères, majuscule, chiffre"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          disabled={isLoading}
        />

        {/* Password strength indicator */}
        {password.length > 0 && (
          <View className="gap-1.5">
            <PasswordCriterion met={password.length >= 8} label="8 caractères minimum" />
            <PasswordCriterion met={/[A-Z]/.test(password)} label="Une majuscule" />
            <PasswordCriterion met={/[a-z]/.test(password)} label="Une minuscule" />
            <PasswordCriterion met={/[0-9]/.test(password)} label="Un chiffre" />
          </View>
        )}

        <Input
          label="Confirmer le mot de passe"
          placeholder="Confirmez votre mot de passe"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
          disabled={isLoading}
        />

        <Button onPress={handleRegister} isLoading={isLoading} className="mt-2">
          Créer mon compte
        </Button>
      </View>

      {/* Google OAuth */}
      <View className="my-6 flex-row items-center">
        <View className="h-px flex-1 bg-muted" />
        <Text variant="muted" className="px-4">
          ou
        </Text>
        <View className="h-px flex-1 bg-muted" />
      </View>

      <Button variant="outline" onPress={handleGoogleRegister} disabled={isLoading}>
        <GoogleIcon size={20} />
        <Text className="font-semibold">Continuer avec Google</Text>
      </Button>

      {/* Login link */}
      <View className="mt-8 flex-row justify-center">
        <Text variant="muted">Déjà un compte ? </Text>
        <Link href="/(auth)/login" asChild>
          <Pressable>
            <Text className="font-semibold text-primary">Se connecter</Text>
          </Pressable>
        </Link>
      </View>
    </AuthScreen>
  );
}
