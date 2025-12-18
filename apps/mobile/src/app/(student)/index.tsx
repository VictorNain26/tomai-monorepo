import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MessageCircle, BookOpen, Trophy, Clock } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useUser } from '@repo/api';

export default function StudentDashboard() {
  const router = useRouter();
  const user = useUser();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4 py-6">
        {/* Header */}
        <View className="mb-6">
          <Text variant="h2" className="text-primary">
            Bonjour{user?.name ? `, ${user.name.split(' ')[0]}` : ''} 👋
          </Text>
          <Text variant="muted" className="mt-1">
            Prêt pour une session de révision ?
          </Text>
        </View>

        {/* Quick Actions */}
        <View className="mb-6 gap-3">
          <Button
            onPress={() => router.push('/(student)/chat')}
            className="flex-row items-center justify-start gap-3 p-4"
          >
            <MessageCircle color="hsl(210, 40%, 98%)" size={24} />
            <View>
              <Text className="font-semibold text-primary-foreground">
                Nouvelle conversation
              </Text>
              <Text className="text-sm text-primary-foreground/80">
                Pose tes questions à Tom
              </Text>
            </View>
          </Button>

          <Button
            variant="outline"
            onPress={() => router.push('/(student)/learning')}
            className="flex-row items-center justify-start gap-3 p-4"
          >
            <BookOpen color="hsl(222.2, 47.4%, 11.2%)" size={24} />
            <View>
              <Text className="font-semibold">Réviser mes flashcards</Text>
              <Text variant="muted" className="text-sm">
                Continue ton apprentissage
              </Text>
            </View>
          </Button>
        </View>

        {/* Stats Cards */}
        <Text variant="h3" className="mb-4">
          Tes statistiques
        </Text>
        <View className="flex-row gap-3">
          <View className="flex-1 rounded-xl border border-border bg-card p-4">
            <View className="mb-2 h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Trophy color="hsl(222.2, 47.4%, 11.2%)" size={20} />
            </View>
            <Text variant="h3">0</Text>
            <Text variant="muted" className="text-sm">
              Séries complétées
            </Text>
          </View>

          <View className="flex-1 rounded-xl border border-border bg-card p-4">
            <View className="mb-2 h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Clock color="hsl(222.2, 47.4%, 11.2%)" size={20} />
            </View>
            <Text variant="h3">0h</Text>
            <Text variant="muted" className="text-sm">
              Temps de révision
            </Text>
          </View>
        </View>

        {/* Recent Activity */}
        <Text variant="h3" className="mb-4 mt-6">
          Activité récente
        </Text>
        <View className="rounded-xl border border-border bg-card p-6">
          <Text variant="muted" className="text-center">
            Aucune activité récente.{'\n'}Commence une conversation avec Tom !
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
