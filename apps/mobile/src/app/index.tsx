import { View, Text, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-4xl font-bold text-foreground mb-2">TomIA</Text>
        <Text className="text-lg text-muted-foreground text-center mb-8">
          Ton tuteur IA pour réussir à l'école
        </Text>

        <Link href="/login" asChild>
          <Pressable className="bg-primary px-8 py-4 rounded-lg active:opacity-80">
            <Text className="text-primary-foreground font-semibold text-lg">
              Commencer
            </Text>
          </Pressable>
        </Link>

        <Text className="text-sm text-muted-foreground mt-12">
          Du CP à la Terminale • Pédagogie socratique
        </Text>
      </View>
    </SafeAreaView>
  );
}
