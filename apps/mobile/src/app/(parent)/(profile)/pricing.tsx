/**
 * Mobile Pricing Screen
 *
 * Displays Free vs Premium plans using RevenueCat for in-app purchases.
 * Handles Expo Go mode where purchases are unavailable.
 */

import { View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
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
import { useTheme, useThemeColors } from '@/hooks';
import { useIconColors } from '@/hooks/useIconColors';
import { bgColors, borderColors } from '@/lib/styles';

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
  useTheme(); // Trigger re-render on theme change
  const iconColors = useIconColors();
  const colors = useThemeColors();
  const subscription = useSubscription();

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
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <View className="flex-row items-center gap-3 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-full">
          <ArrowLeft color={iconColors.foreground} size={24} />
        </TouchableOpacity>
        <Text variant="h3">Abonnement</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-6">
        {/* Expo Go Warning */}
        {subscription.isExpoGo && (
          <View
            className="mb-6 flex-row items-start gap-3 rounded-xl p-4"
            style={{ backgroundColor: bgColors.warning[10], borderWidth: 1, borderColor: borderColors.warning[20] }}
          >
            <AlertCircle color={colors.warning} size={20} />
            <View className="flex-1">
              <Text className="font-semibold" style={{ color: colors.warning }}>
                Mode Expo Go
              </Text>
              <Text className="mt-1 text-sm" style={{ color: colors.warning }}>
                Les achats in-app ne sont pas disponibles dans Expo Go.
                Utilisez un development build pour tester les achats.
              </Text>
            </View>
          </View>
        )}

        {/* Already Premium Banner */}
        {subscription.isPro && (
          <View
            className="mb-6 flex-row items-start gap-3 rounded-xl p-4"
            style={{ backgroundColor: bgColors.success[10], borderWidth: 1, borderColor: borderColors.success[20] }}
          >
            <Sparkles color={colors.success} size={20} />
            <View className="flex-1">
              <Text className="font-semibold" style={{ color: colors.success }}>
                Vous êtes Premium !
              </Text>
              {subscription.expirationDate && (
                <Text className="mt-1 text-sm" style={{ color: colors.success }}>
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
          />

          {/* Premium Plan */}
          <PlanCard
            title="Premium"
            price={priceString}
            period="/mois"
            features={PREMIUM_FEATURES}
            isCurrentPlan={subscription.isPro}
            isPremium
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
                  <Text className="font-semibold text-white dark:text-slate-900">
                    Chargement...
                  </Text>
                </View>
              ) : (
                <Text className="font-semibold text-white dark:text-slate-900">
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
            <Shield color={iconColors.success} size={16} />
            <Text variant="muted" className="text-sm">
              Paiement sécurisé via {subscription.isExpoGo ? 'App Store / Play Store' : 'votre store'}
            </Text>
          </View>
          <View className="flex-row items-center justify-center gap-2">
            <Clock color={iconColors.muted} size={16} />
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
}

function PlanCard({
  title,
  price,
  period,
  features,
  isCurrentPlan,
  isPremium = false,
}: PlanCardProps) {
  const iconColors = useIconColors();

  return (
    <View
      className={`rounded-xl border p-4 ${
        isPremium
          ? 'border-blue-600 dark:border-blue-400'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
      }`}
      style={isPremium ? { backgroundColor: bgColors.primary[5] } : undefined}
    >
      {/* Header */}
      <View className="mb-4 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          {isPremium && <Sparkles color={iconColors.primary} size={20} />}
          <Text className="text-lg font-bold">{title}</Text>
        </View>
        {isCurrentPlan && (
          <View className="rounded-full px-3 py-1" style={{ backgroundColor: bgColors.primary[10] }}>
            <Text className="text-xs font-semibold text-blue-600 dark:text-blue-400">
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
              <View className="h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: bgColors.success[10] }}>
                <Check color={iconColors.success} size={12} />
              </View>
            ) : (
              <View className="h-5 w-5 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <X color={iconColors.muted} size={12} />
              </View>
            )}
            <Text
              className={feature.included ? '' : 'text-slate-500 dark:text-slate-400'}
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
    <View className="mb-4 rounded-xl bg-white dark:bg-slate-800 p-4">
      <Text className="mb-2 font-semibold">{question}</Text>
      <Text variant="muted" className="text-sm leading-relaxed">
        {answer}
      </Text>
    </View>
  );
}
