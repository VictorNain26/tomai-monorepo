import { useState } from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Link } from 'expo-router';
import { signUp } from '@repo/api';

import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Role = 'student' | 'parent';

export default function RegisterScreen() {
  const [step, setStep] = useState<'role' | 'form'>('role');
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleRoleSelect(selectedRole: Role) {
    setRole(selectedRole);
    setStep('form');
  }

  async function handleRegister() {
    setError(null);

    if (!name || !email || !password || !confirmPassword) {
      setError('Veuillez remplir tous les champs');
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

    setIsLoading(true);

    try {
      const result = await signUp({ email, password, name });

      if (result.error) {
        setError(result.error.message ?? "Erreur lors de l'inscription");
        return;
      }

      // Registration successful - AuthGuard will handle redirect
    } catch {
      setError("Erreur lors de l'inscription. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  }

  // Role selection screen
  if (step === 'role') {
    return (
      <View className="flex-1 justify-center bg-background px-6">
        <View className="mb-8">
          <Text variant="h1" className="text-center text-primary">
            Inscription
          </Text>
          <Text variant="muted" className="mt-2 text-center">
            Choisissez votre profil
          </Text>
        </View>

        <View className="gap-4">
          <TouchableOpacity
            onPress={() => handleRoleSelect('student')}
            className="rounded-xl border-2 border-border bg-card p-6"
            activeOpacity={0.7}
          >
            <Text variant="h3" className="mb-2">
              Je suis élève
            </Text>
            <Text variant="muted">
              Accédez à un tuteur IA personnalisé pour vos révisions
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleRoleSelect('parent')}
            className="rounded-xl border-2 border-border bg-card p-6"
            activeOpacity={0.7}
          >
            <Text variant="h3" className="mb-2">
              Je suis parent
            </Text>
            <Text variant="muted">
              Gérez les comptes de vos enfants et suivez leur progression
            </Text>
          </TouchableOpacity>
        </View>

        <View className="mt-8 flex-row justify-center">
          <Text variant="muted">Déjà un compte ? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text className="font-semibold text-primary">Se connecter</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    );
  }

  // Registration form
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
          <TouchableOpacity onPress={() => setStep('role')} className="mb-4">
            <Text className="text-primary">← Retour</Text>
          </TouchableOpacity>

          {/* Header */}
          <View className="mb-8">
            <Text variant="h2" className="text-primary">
              {role === 'student' ? 'Compte élève' : 'Compte parent'}
            </Text>
            <Text variant="muted" className="mt-2">
              Créez votre compte pour commencer
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
                Nom complet
              </Text>
              <Input
                placeholder="Jean Dupont"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoComplete="name"
                editable={!isLoading}
              />
            </View>

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

            <View>
              <Text variant="small" className="mb-2 font-medium">
                Mot de passe
              </Text>
              <Input
                placeholder="8 caractères minimum"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>

            <View>
              <Text variant="small" className="mb-2 font-medium">
                Confirmer le mot de passe
              </Text>
              <Input
                placeholder="Confirmez votre mot de passe"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>

            <Button
              onPress={handleRegister}
              disabled={isLoading}
              className="mt-4"
            >
              <Text className="font-semibold text-primary-foreground">
                {isLoading ? 'Création...' : 'Créer mon compte'}
              </Text>
            </Button>
          </View>

          {/* Login link */}
          <View className="mt-8 flex-row justify-center">
            <Text variant="muted">Déjà un compte ? </Text>
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
