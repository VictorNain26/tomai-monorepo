/**
 * Forgot Password Screen
 *
 * Sends password reset email to user.
 * Reset link opens in web browser (Better Auth limitation).
 */

import { useState } from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Mail, CheckCircle, ArrowLeft } from 'lucide-react-native';
import { requestPasswordReset } from '@/lib/auth';
import { getBaseUrl } from '@repo/api';

import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  function validateEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  async function handleSendResetEmail() {
    if (!email.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir votre adresse email');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Erreur', 'Veuillez saisir une adresse email valide');
      return;
    }

    setIsLoading(true);

    try {
      // Send reset email with web redirect URL
      // User will reset password in browser, then return to app
      const baseUrl = getBaseUrl();
      const webUrl = baseUrl.replace('/api', '').replace(':3000', ':5173');

      await requestPasswordReset(email, `${webUrl}/auth/reset-password`);
      setEmailSent(true);
    } catch (error) {
      Alert.alert(
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
          <View className="mb-6 h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle color="hsl(142, 76%, 36%)" size={32} />
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
            <Text className="font-semibold text-primary-foreground">
              Retour à la connexion
            </Text>
          </Button>
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
          >
            <ArrowLeft color="hsl(222.2, 47.4%, 11.2%)" size={20} />
            <Text className="ml-1 text-primary">Retour</Text>
          </TouchableOpacity>

          {/* Header */}
          <View className="mb-8 items-center">
            <View className="mb-6 h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Mail color="hsl(222.2, 47.4%, 11.2%)" size={32} />
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
                editable={!isLoading}
              />
            </View>

            <Button
              onPress={handleSendResetEmail}
              disabled={isLoading}
              className="mt-4"
            >
              <Text className="font-semibold text-primary-foreground">
                {isLoading ? 'Envoi en cours...' : 'Envoyer le lien'}
              </Text>
            </Button>
          </View>

          {/* Login link */}
          <View className="mt-8 flex-row justify-center">
            <Text variant="muted">Vous vous souvenez ? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text className="font-semibold text-primary">Se connecter</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
