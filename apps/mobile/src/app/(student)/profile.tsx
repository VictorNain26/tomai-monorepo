import { View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  User,
  Settings,
  HelpCircle,
  LogOut,
  ChevronRight,
  Crown,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useUser, signOut } from '@/lib/auth';

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  danger?: boolean;
}

export default function ProfileScreen() {
  const router = useRouter();
  const user = useUser();

  async function handleLogout() {
    Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnexion',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  const menuItems: MenuItem[] = [
    {
      icon: <User color="hsl(222.2, 47.4%, 11.2%)" size={20} />,
      label: 'Mon profil',
      onPress: () => router.push('/(student)/profile-info'),
    },
    {
      icon: <Settings color="hsl(222.2, 47.4%, 11.2%)" size={20} />,
      label: 'Paramètres',
      onPress: () => router.push('/(student)/settings'),
    },
    {
      icon: <HelpCircle color="hsl(222.2, 47.4%, 11.2%)" size={20} />,
      label: 'Aide et support',
      onPress: () => {},
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4 py-6">
        {/* Profile Header */}
        <View className="mb-6 items-center">
          <View className="mb-4 h-24 w-24 items-center justify-center rounded-full bg-primary/10">
            <Text className="text-4xl">
              {user?.name ? user.name.charAt(0).toUpperCase() : '👤'}
            </Text>
          </View>
          <Text variant="h2">{user?.name ?? 'Utilisateur'}</Text>
          <Text variant="muted">{user?.email ?? ''}</Text>

          {/* Subscription badge */}
          <View className="mt-3 flex-row items-center gap-1 rounded-full bg-primary/10 px-3 py-1">
            <Crown color="hsl(222.2, 47.4%, 11.2%)" size={14} />
            <Text className="text-sm font-medium">Plan gratuit</Text>
          </View>
        </View>

        {/* Subscription Card */}
        <View className="mb-6 rounded-xl border border-primary bg-primary/5 p-4">
          <Text variant="h3" className="mb-1">
            Passe à Premium
          </Text>
          <Text variant="muted" className="mb-3 text-sm">
            Accès illimité à Tom, flashcards avancées et plus encore !
          </Text>
          <Button onPress={() => {}} className="self-start">
            <Text className="font-semibold text-primary-foreground">
              Voir les offres
            </Text>
          </Button>
        </View>

        {/* Menu Items */}
        <View className="rounded-xl border border-border bg-card">
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              onPress={item.onPress}
              className={`flex-row items-center justify-between px-4 py-4 ${
                index !== menuItems.length - 1 ? 'border-b border-border' : ''
              }`}
              activeOpacity={0.7}
            >
              <View className="flex-row items-center gap-3">
                {item.icon}
                <Text>{item.label}</Text>
              </View>
              <ChevronRight color="hsl(215.4, 16.3%, 46.9%)" size={20} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          onPress={handleLogout}
          className="mt-6 flex-row items-center justify-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 py-4"
          activeOpacity={0.7}
        >
          <LogOut color="hsl(0, 84.2%, 60.2%)" size={20} />
          <Text className="font-semibold text-destructive">Se déconnecter</Text>
        </TouchableOpacity>

        {/* App Version */}
        <Text variant="muted" className="mt-6 text-center text-sm">
          TomIA v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
