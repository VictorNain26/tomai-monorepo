/**
 * Forgot Password Screen
 *
 * Sends password reset email to user.
 * Reset link opens in web browser (Better Auth limitation).
 */

import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Mail, CheckCircle, ArrowLeft } from 'lucide-react-native';
import { requestPasswordReset } from '@/lib/auth';
import { getBaseUrl } from '@repo/api';

import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { AuthScreen } from '@/components/auth/auth-screen';
import { useThemeColors } from '@/hooks';
import { bgColors } from '@/lib/styles';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const toast = useToast();
  const colors = useThemeColors();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  function validateEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  async function handleSendResetEmail() {
    if (!email.trim()) {
      toast.error('Erreur', 'Veuillez saisir votre adresse email');
      return;
    }

    if (!validateEmail(email)) {
      toast.error('Erreur', 'Veuillez saisir une adresse email valide');
      return;
    }

    setIsLoading(true);

    try {
      // Derive frontend URL from API URL:
      //   Dev:     http://localhost:3000        → http://localhost:3001
      //   Staging: https://api-staging.tomia.fr → https://staging.tomia.fr
      //   Prod:    https://api.tomia.fr         → https://tomia.fr
      const apiUrl = getBaseUrl();
      let webUrl: string;
      if (apiUrl.includes('localhost')) {
        webUrl = apiUrl.replace(':3000', ':3001');
      } else {
        // api.X → X | api-staging.X → staging.X
        webUrl = apiUrl.replace(
          /\/\/api([.-])/,
          (_: string, sep: string) => (sep === '.' ? '//' : '//')
        );
      }

      await requestPasswordReset(email, `${webUrl}/auth/reset-password`);
      setEmailSent(true);
    } catch (error) {
      toast.error(
        'Erreur',
        (error as Error).message || "Impossible d'envoyer l'email de récupération"
      );
    } finally {
      setIsLoading(false);
    }
  }

  // Success state
  if (emailSent) {
    return (
      <View className="flex-1 justify-center bg-background px-6">
        <View className="items-center">
          <View className="mb-6 h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: bgColors.success[10] }}>
            <CheckCircle color={colors.success} size={32} />
          </View>

          <Text variant="h2" className="text-center">
            Email envoyé !
          </Text>

          <Text variant="muted" className="mt-4 text-center">
            Nous avons envoyé un lien de réinitialisation à{' '}
            <Text className="font-semibold">{email}</Text>
          </Text>

          <Text variant="muted" className="mt-4 text-center text-sm">
            Cliquez sur le lien dans l'email pour réinitialiser votre mot de passe.
            Le lien expire dans 24 heures.
          </Text>

          <Text variant="muted" className="mt-2 text-center text-sm">
            Vérifiez vos courriers indésirables si vous ne recevez rien.
          </Text>

          <Button
            onPress={() => router.replace('/(auth)/login')}
            className="mt-8 w-full"
          >
            Retour à la connexion
          </Button>
        </View>
      </View>
    );
  }

  // Form state
  return (
    <AuthScreen>
      {/* Back button */}
      <Pressable
        onPress={() => router.back()}
        className="absolute left-6 top-16 flex-row items-center"
        style={{ minHeight: 44 }}
        accessibilityLabel="Retour"
        accessibilityRole="button"
      >
        <ArrowLeft color={colors.foreground} size={20} />
        <Text className="ml-1 text-primary">Retour</Text>
      </Pressable>

      {/* Header */}
      <View className="mb-8 items-center">
        <View className="mb-6 h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: bgColors.primary[10] }}>
          <Mail color={colors.foreground} size={32} />
        </View>

        <Text variant="h2" className="text-center">
          Mot de passe oublié ?
        </Text>

        <Text variant="muted" className="mt-2 text-center">
          Saisissez votre email pour recevoir un lien de réinitialisation
        </Text>
      </View>

      {/* Form */}
      <View className="gap-4">
        <View>
          <Text variant="small" className="mb-2 font-medium">
            Adresse email
          </Text>
          <Input
            placeholder="marie.dupont@exemple.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            disabled={isLoading}
          />
        </View>

        <Button onPress={handleSendResetEmail} isLoading={isLoading} className="mt-4">
          Envoyer le lien
        </Button>
      </View>

      {/* Login link */}
      <View className="mt-8 flex-row justify-center">
        <Text variant="muted">Vous vous souvenez ? </Text>
        <Link href="/(auth)/login" asChild>
          <Pressable accessibilityLabel="Se connecter">
            <Text className="font-semibold text-primary">Se connecter</Text>
          </Pressable>
        </Link>
      </View>
    </AuthScreen>
  );
}
