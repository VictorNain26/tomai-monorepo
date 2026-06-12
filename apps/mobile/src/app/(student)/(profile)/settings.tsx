/**
 * Student Settings Screen
 *
 * Preferences and app settings for students.
 */

import { View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Sun,
  Moon,
  Smartphone,
  Check,
  Bell,
  Shield,
  Info,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { useTheme, useThemeColors, type ThemeMode } from '@/hooks';

// ============================================================================
// CONSTANTS
// ============================================================================

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Clair', icon: Sun },
  { value: 'dark', label: 'Sombre', icon: Moon },
  { value: 'system', label: 'Système', icon: Smartphone },
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function SettingsScreen() {
  const router = useRouter();
  const { themeMode, setThemeMode } = useTheme();
  const colors = useThemeColors();

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-full">
          <ArrowLeft color={colors.foreground} size={24} />
        </TouchableOpacity>
        <Text variant="h3">Paramètres</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-6">
        {/* Theme Section */}
        <View className="mb-6">
          <Text className="mb-3 font-semibold">Apparence</Text>
          <View className="rounded-xl bg-card">
            {THEME_OPTIONS.map((option, index) => {
              const Icon = option.icon;
              const isSelected = themeMode === option.value;

              return (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setThemeMode(option.value)}
                  className={`flex-row items-center justify-between px-4 py-4 ${
                    index !== THEME_OPTIONS.length - 1 ? 'border-b border-border' : ''
                  }`}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center gap-3">
                    <Icon color={colors.foreground} size={20} />
                    <Text>{option.label}</Text>
                  </View>
                  {isSelected && <Check color={colors.success} size={20} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Other Settings (Placeholders) */}
        <View className="mb-6">
          <Text className="mb-3 font-semibold">Préférences</Text>
          <View className="rounded-xl bg-card">
            <TouchableOpacity
              className="flex-row items-center justify-between border-b border-border px-4 py-4"
              activeOpacity={1}
              disabled={true}
              style={{ opacity: 0.5 }}
            >
              <View className="flex-row items-center gap-3">
                <Bell color={colors.foreground} size={20} />
                <View>
                  <Text>Notifications</Text>
                  <Text variant="muted" className="text-sm">
                    Bientôt disponible
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-center justify-between px-4 py-4"
              activeOpacity={1}
              disabled={true}
              style={{ opacity: 0.5 }}
            >
              <View className="flex-row items-center gap-3">
                <Shield color={colors.foreground} size={20} />
                <View>
                  <Text>Confidentialité</Text>
                  <Text variant="muted" className="text-sm">
                    Bientôt disponible
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* App Info */}
        <View className="mb-6">
          <Text className="mb-3 font-semibold">À propos</Text>
          <View className="rounded-xl bg-card">
            <View className="flex-row items-center justify-between px-4 py-4">
              <View className="flex-row items-center gap-3">
                <Info color={colors.mutedForeground} size={20} />
                <Text>Version</Text>
              </View>
              <Text variant="muted">1.0.0</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
