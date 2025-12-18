import { useState } from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Link, useRouter } from 'expo-router';

import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!email) {
      setError('Veuillez entrer votre email');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // TODO: Implement password reset API call
      // await resetPassword(email);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      setIsSubmitted(true);
    } catch {
      setError("Erreur lors de l'envoi. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isSubmitted) {
    return (
      <View className="flex-1 justify-center bg-background px-6">
        <View className="items-center">
          <View className="mb-6 h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Text className="text-3xl">✉️</Text>
          </View>
          <Text variant="h2" className="text-center">
            Email envoyé
          </Text>
          <Text variant="muted" className="mt-2 text-center">
            Si un compte existe avec cet email, vous recevrez un lien pour
            réinitialiser votre mot de passe.
          </Text>
          <Button
            onPress={() => router.replace('/(auth)/login')}
            className="mt-8"
          >
            <Text className="font-semibold text-primary-foreground">
              Retour à la connexion
            </Text>
          </Button>
        </View>
      </View>
    );
  }

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
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity className="mb-4">
              <Text className="text-primary">← Retour</Text>
            </TouchableOpacity>
          </Link>

          {/* Header */}
          <View className="mb-8">
            <Text variant="h2" className="text-primary">
              Mot de passe oublié
            </Text>
            <Text variant="muted" className="mt-2">
              Entrez votre email pour recevoir un lien de réinitialisation
            </Text>
          </View>

          {/* Error message */}
          {error && (
            <View className="mb-4 rounded-md bg-destructive/10 p-3">
              <Text className="text-center text-destructive">{error}</Text>
            </View>
          )}

          {/* Form */}
          <View className="gap-4">
            <View>
              <Text variant="small" className="mb-2 font-medium">
                Email
              </Text>
              <Input
                placeholder="votre@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!isLoading}
              />
            </View>

            <Button
              onPress={handleSubmit}
              disabled={isLoading}
              className="mt-2"
            >
              <Text className="font-semibold text-primary-foreground">
                {isLoading ? 'Envoi...' : 'Envoyer le lien'}
              </Text>
            </Button>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
