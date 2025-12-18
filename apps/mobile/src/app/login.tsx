import { View, Text, TextInput, Pressable } from 'react-native';
import { useState } from 'react';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    // TODO: Implement login with @repo/api
    console.log('Login with:', { email, password });
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6 pt-12">
        <Link href="/" asChild>
          <Pressable className="mb-8">
            <Text className="text-muted-foreground">← Retour</Text>
          </Pressable>
        </Link>

        <Text className="text-3xl font-bold text-foreground mb-2">
          Connexion
        </Text>
        <Text className="text-muted-foreground mb-8">
          Connecte-toi à ton compte TomIA
        </Text>

        <View className="gap-4">
          <View>
            <Text className="text-sm text-foreground mb-2">Email</Text>
            <TextInput
              className="border border-input rounded-lg px-4 py-3 text-foreground bg-background"
              placeholder="ton@email.com"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View>
            <Text className="text-sm text-foreground mb-2">Mot de passe</Text>
            <TextInput
              className="border border-input rounded-lg px-4 py-3 text-foreground bg-background"
              placeholder="••••••••"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <Pressable
            className="bg-primary py-4 rounded-lg active:opacity-80 mt-4"
            onPress={handleLogin}
          >
            <Text className="text-primary-foreground font-semibold text-center text-lg">
              Se connecter
            </Text>
          </Pressable>

          <Text className="text-center text-muted-foreground mt-4">
            Pas encore de compte ?{' '}
            <Text className="text-primary font-semibold">S'inscrire</Text>
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
