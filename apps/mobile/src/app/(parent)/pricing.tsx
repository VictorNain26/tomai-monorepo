/**
 * Mobile Pricing Screen
 *
 * Displays Free vs Premium plans using RevenueCat for in-app purchases.
 * Handles Expo Go mode where purchases are unavailable.
 */

import { View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Check,
  X,
  Shield,
  Sparkles,
  Clock,
  AlertCircle,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks';
import { useTheme } from '@/hooks';

// ============================================================================
// CONSTANTS
// ============================================================================

const FREE_FEATURES = [
  { text: '10 questions/jour', included: true },
  { text: 'Historique 7 jours', included: true },
  { text: 'Aide aux devoirs basique', included: true },
  { text: 'Accès illimité', included: false },
  { text: 'Cartes mémo avancées', included: false },
  { text: 'Support prioritaire', included: false },
];

const PREMIUM_FEATURES = [
  { text: 'Questions illimitées', included: true },
  { text: 'Historique complet', included: true },
  { text: 'Aide aux devoirs avancée', included: true },
  { text: 'Accès illimité', included: true },
  { text: 'Cartes mémo avancées', included: true },
  { text: 'Support prioritaire', included: true },
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function PricingScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const subscription = useSubscription();

  const iconColor = isDark ? 'hsl(210, 40%, 98%)' : 'hsl(222.2, 47.4%, 11.2%)';
  const mutedColor = isDark ? 'hsl(215, 20.2%, 65.1%)' : 'hsl(215.4, 16.3%, 46.9%)';

  // Get first available package for purchase
  const availablePackage = subscription.offering?.availablePackages[0];
  const priceString = availablePackage?.product.priceString ?? '—';

  const handlePurchase = async () => {
    if (!availablePackage) return;
    await subscription.purchase(availablePackage);
  };

  const handleRestore = async () => {
    await subscription.restore();
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <ArrowLeft color={iconColor} size={24} />
        </TouchableOpacity>
        <Text variant="h3">Abonnement</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-6">
        {/* Expo Go Warning */}
        {subscription.isExpoGo && (
          <View className="mb-6 flex-row items-start gap-3 rounded-xl border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-700 dark:bg-yellow-900/20">
            <AlertCircle color="#ca8a04" size={20} />
            <View className="flex-1">
              <Text className="font-semibold text-yellow-800 dark:text-yellow-200">
                Mode Expo Go
              </Text>
              <Text className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                Les achats in-app ne sont pas disponibles dans Expo Go.
                Utilisez un development build pour tester les achats.
              </Text>
            </View>
          </View>
        )}

        {/* Already Premium Banner */}
        {subscription.isPro && (
          <View className="mb-6 flex-row items-start gap-3 rounded-xl border border-green-300 bg-green-50 p-4 dark:border-green-700 dark:bg-green-900/20">
            <Sparkles color="#16a34a" size={20} />
            <View className="flex-1">
              <Text className="font-semibold text-green-800 dark:text-green-200">
                Vous êtes Premium !
              </Text>
              {subscription.expirationDate && (
                <Text className="mt-1 text-sm text-green-700 dark:text-green-300">
                  {subscription.willRenew ? 'Renouvellement le' : 'Expire le'}{' '}
                  {subscription.expirationDate.toLocaleDateString('fr-FR')}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Header Text */}
        <View className="mb-8 items-center">
          <Text className="text-center text-2xl font-bold">
            Choisissez votre plan
          </Text>
          <Text variant="muted" className="mt-2 text-center">
            Offrez à vos enfants un accompagnement personnalisé
          </Text>
        </View>

        {/* Plans */}
        <View className="gap-4">
          {/* Free Plan */}
          <PlanCard
            title="Gratuit"
            price="0€"
            period="/mois"
            features={FREE_FEATURES}
            isCurrentPlan={!subscription.isPro}
            mutedColor={mutedColor}
          />

          {/* Premium Plan */}
          <PlanCard
            title="Premium"
            price={priceString}
            period="/mois"
            features={PREMIUM_FEATURES}
            isCurrentPlan={subscription.isPro}
            isPremium
            mutedColor={mutedColor}
          />
        </View>

        {/* Purchase Button */}
        {!subscription.isPro && (
          <View className="mt-6">
            <Button
              onPress={handlePurchase}
              disabled={
                subscription.isLoading ||
                subscription.isExpoGo ||
                !availablePackage
              }
              className="w-full"
            >
              {subscription.isLoading ? (
                <View className="flex-row items-center gap-2">
                  <ActivityIndicator size="small" color="white" />
                  <Text className="font-semibold text-primary-foreground">
                    Chargement...
                  </Text>
                </View>
              ) : (
                <Text className="font-semibold text-primary-foreground">
                  Passer Premium - {priceString}/mois
                </Text>
              )}
            </Button>

            {/* Restore Button */}
            <TouchableOpacity
              onPress={handleRestore}
              disabled={subscription.isLoading || subscription.isExpoGo}
              className="mt-3 items-center py-2"
            >
              <Text variant="muted" className="text-sm underline">
                Restaurer mes achats
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Trust Badges */}
        <View className="mt-8 gap-3">
          <View className="flex-row items-center justify-center gap-2">
            <Shield color="#16a34a" size={16} />
            <Text variant="muted" className="text-sm">
              Paiement sécurisé via {subscription.isExpoGo ? 'App Store / Play Store' : 'votre store'}
            </Text>
          </View>
          <View className="flex-row items-center justify-center gap-2">
            <Clock color={mutedColor} size={16} />
            <Text variant="muted" className="text-sm">
              Annulation à tout moment
            </Text>
          </View>
        </View>

        {/* FAQ */}
        <View className="mt-10">
          <Text className="mb-4 text-center text-lg font-semibold">
            Questions fréquentes
          </Text>

          <FAQItem
            question="Comment fonctionne l'abonnement ?"
            answer="L'abonnement Premium est mensuel et se renouvelle automatiquement. Vous pouvez l'annuler à tout moment depuis les paramètres de votre store."
          />

          <FAQItem
            question="Comment annuler mon abonnement ?"
            answer="Allez dans Réglages > [Votre nom] > Abonnements sur iOS, ou Google Play > Menu > Abonnements sur Android."
          />

          <FAQItem
            question="Puis-je utiliser mon abonnement sur plusieurs appareils ?"
            answer="Oui ! Votre abonnement est lié à votre compte et fonctionne sur tous vos appareils connectés."
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface PlanCardProps {
  title: string;
  price: string;
  period: string;
  features: { text: string; included: boolean }[];
  isCurrentPlan: boolean;
  isPremium?: boolean;
  mutedColor: string;
}

function PlanCard({
  title,
  price,
  period,
  features,
  isCurrentPlan,
  isPremium = false,
  mutedColor,
}: PlanCardProps) {
  return (
    <View
      className={`rounded-xl border p-4 ${
        isPremium
          ? 'border-primary bg-primary/5'
          : 'border-border bg-card'
      }`}
    >
      {/* Header */}
      <View className="mb-4 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          {isPremium && <Sparkles color="hsl(262, 83%, 58%)" size={20} />}
          <Text className="text-lg font-bold">{title}</Text>
        </View>
        {isCurrentPlan && (
          <View className="rounded-full bg-primary/10 px-3 py-1">
            <Text className="text-xs font-semibold text-primary">
              Plan actuel
            </Text>
          </View>
        )}
      </View>

      {/* Price */}
      <View className="mb-4 flex-row items-baseline">
        <Text className="text-3xl font-bold">{price}</Text>
        <Text variant="muted" className="ml-1">
          {period}
        </Text>
      </View>

      {/* Features */}
      <View className="gap-2">
        {features.map((feature) => (
          <View key={feature.text} className="flex-row items-center gap-3">
            {feature.included ? (
              <View className="h-5 w-5 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <Check color="#16a34a" size={12} />
              </View>
            ) : (
              <View className="h-5 w-5 items-center justify-center rounded-full bg-muted">
                <X color={mutedColor} size={12} />
              </View>
            )}
            <Text
              className={feature.included ? '' : 'text-muted-foreground'}
            >
              {feature.text}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

interface FAQItemProps {
  question: string;
  answer: string;
}

function FAQItem({ question, answer }: FAQItemProps) {
  return (
    <View className="mb-4 rounded-xl border border-border bg-card p-4">
      <Text className="mb-2 font-semibold">{question}</Text>
      <Text variant="muted" className="text-sm leading-relaxed">
        {answer}
      </Text>
    </View>
  );
}
