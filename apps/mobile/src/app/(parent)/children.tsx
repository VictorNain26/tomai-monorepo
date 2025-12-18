import { View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, User, ChevronRight, Mail, Clock, Trophy } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';

interface Child {
  id: string;
  name: string;
  email: string;
  level: string;
  lastActive: string;
  streakDays: number;
}

// Placeholder - will be fetched from API
const children: Child[] = [];

export default function ChildrenScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4 py-6">
        {/* Header */}
        <View className="mb-6 flex-row items-center justify-between">
          <View>
            <Text variant="h2" className="text-primary">
              Mes enfants
            </Text>
            <Text variant="muted" className="mt-1">
              Gérez les comptes de vos enfants
            </Text>
          </View>
          <TouchableOpacity
            className="h-10 w-10 items-center justify-center rounded-full bg-primary"
            activeOpacity={0.7}
          >
            <Plus color="hsl(210, 40%, 98%)" size={20} />
          </TouchableOpacity>
        </View>

        {/* Children List */}
        {children.length > 0 ? (
          <View className="gap-3">
            {children.map(child => (
              <TouchableOpacity
                key={child.id}
                className="rounded-xl border border-border bg-card p-4"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center">
                  <View className="mr-3 h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Text className="text-lg font-semibold">
                      {child.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-semibold">{child.name}</Text>
                    <Text variant="muted" className="text-sm">
                      {child.level}
                    </Text>
                  </View>
                  <ChevronRight color="hsl(215.4, 16.3%, 46.9%)" size={20} />
                </View>

                <View className="mt-3 flex-row gap-4 border-t border-border pt-3">
                  <View className="flex-row items-center gap-1">
                    <Clock color="hsl(215.4, 16.3%, 46.9%)" size={14} />
                    <Text variant="muted" className="text-xs">
                      {child.lastActive}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <Trophy color="hsl(215.4, 16.3%, 46.9%)" size={14} />
                    <Text variant="muted" className="text-xs">
                      {child.streakDays} jours
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          /* Empty State */
          <View className="rounded-xl border border-border bg-card p-8">
            <View className="items-center">
              <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-muted">
                <User color="hsl(215.4, 16.3%, 46.9%)" size={40} />
              </View>
              <Text variant="h3" className="text-center">
                Aucun enfant inscrit
              </Text>
              <Text variant="muted" className="mt-2 text-center">
                Ajoutez vos enfants pour suivre leur progression et gérer leur
                apprentissage.
              </Text>
              <Button onPress={() => {}} className="mt-6">
                <View className="flex-row items-center gap-2">
                  <Plus color="hsl(210, 40%, 98%)" size={18} />
                  <Text className="font-semibold text-primary-foreground">
                    Ajouter un enfant
                  </Text>
                </View>
              </Button>
            </View>
          </View>
        )}

        {/* Invite Section */}
        <View className="mt-6 rounded-xl border border-border bg-muted/50 p-4">
          <View className="flex-row items-start gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Mail color="hsl(222.2, 47.4%, 11.2%)" size={20} />
            </View>
            <View className="flex-1">
              <Text className="font-semibold">Inviter par email</Text>
              <Text variant="muted" className="mt-1 text-sm">
                Envoyez une invitation à votre enfant pour qu'il crée son compte
                et le lie à votre espace parent.
              </Text>
              <TouchableOpacity className="mt-3">
                <Text className="font-semibold text-primary">
                  Envoyer une invitation →
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Help Section */}
        <View className="mt-6 rounded-xl border border-border bg-card p-4">
          <Text variant="h4" className="mb-2">
            Comment ça marche ?
          </Text>
          <View className="gap-2">
            <View className="flex-row gap-2">
              <Text className="text-primary">1.</Text>
              <Text variant="muted" className="flex-1 text-sm">
                Créez un compte pour votre enfant ou invitez-le par email
              </Text>
            </View>
            <View className="flex-row gap-2">
              <Text className="text-primary">2.</Text>
              <Text variant="muted" className="flex-1 text-sm">
                Votre enfant utilise Tom pour réviser et apprendre
              </Text>
            </View>
            <View className="flex-row gap-2">
              <Text className="text-primary">3.</Text>
              <Text variant="muted" className="flex-1 text-sm">
                Suivez sa progression et ses statistiques depuis votre tableau
                de bord
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
