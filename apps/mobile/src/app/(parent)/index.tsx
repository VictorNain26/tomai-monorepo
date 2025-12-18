import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Users, Plus, TrendingUp, Clock } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useUser } from '@repo/api';

export default function ParentDashboard() {
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
            Suivez la progression de vos enfants
          </Text>
        </View>

        {/* Quick Actions */}
        <View className="mb-6 gap-3">
          <Button
            onPress={() => router.push('/(parent)/children')}
            className="flex-row items-center justify-start gap-3 p-4"
          >
            <Users color="hsl(210, 40%, 98%)" size={24} />
            <View>
              <Text className="font-semibold text-primary-foreground">
                Gérer les comptes
              </Text>
              <Text className="text-sm text-primary-foreground/80">
                Ajouter ou gérer vos enfants
              </Text>
            </View>
          </Button>

          <Button
            variant="outline"
            onPress={() => {}}
            className="flex-row items-center justify-start gap-3 p-4"
          >
            <Plus color="hsl(222.2, 47.4%, 11.2%)" size={24} />
            <View>
              <Text className="font-semibold">Ajouter un enfant</Text>
              <Text variant="muted" className="text-sm">
                Créer un nouveau compte élève
              </Text>
            </View>
          </Button>
        </View>

        {/* Stats Overview */}
        <Text variant="h3" className="mb-4">
          Vue d'ensemble
        </Text>
        <View className="flex-row gap-3">
          <View className="flex-1 rounded-xl border border-border bg-card p-4">
            <View className="mb-2 h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Users color="hsl(222.2, 47.4%, 11.2%)" size={20} />
            </View>
            <Text variant="h3">0</Text>
            <Text variant="muted" className="text-sm">
              Enfants inscrits
            </Text>
          </View>

          <View className="flex-1 rounded-xl border border-border bg-card p-4">
            <View className="mb-2 h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Clock color="hsl(222.2, 47.4%, 11.2%)" size={20} />
            </View>
            <Text variant="h3">0h</Text>
            <Text variant="muted" className="text-sm">
              Temps total
            </Text>
          </View>
        </View>

        {/* Children Progress */}
        <Text variant="h3" className="mb-4 mt-6">
          Progression des enfants
        </Text>
        <View className="rounded-xl border border-border bg-card p-6">
          <View className="items-center">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Users color="hsl(215.4, 16.3%, 46.9%)" size={32} />
            </View>
            <Text variant="muted" className="text-center">
              Aucun enfant inscrit pour le moment.
            </Text>
            <Button
              onPress={() => {}}
              variant="outline"
              className="mt-4"
            >
              <Text className="font-semibold">Ajouter un enfant</Text>
            </Button>
          </View>
        </View>

        {/* Weekly Activity */}
        <Text variant="h3" className="mb-4 mt-6">
          Activité de la semaine
        </Text>
        <View className="rounded-xl border border-border bg-card p-4">
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <TrendingUp color="hsl(222.2, 47.4%, 11.2%)" size={24} />
            </View>
            <View className="flex-1">
              <Text className="font-semibold">Pas encore de données</Text>
              <Text variant="muted" className="text-sm">
                Les statistiques apparaîtront ici
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
