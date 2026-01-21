/**
 * Parent Settings Screen
 *
 * Preferences and app settings for parents.
 */

import { View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { useTheme, type ThemeMode } from '@/hooks';

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

export default function ParentSettingsScreen() {
  const router = useRouter();
  const { themeMode, setThemeMode, isDark } = useTheme();

  const iconColor = isDark ? 'hsl(210, 40%, 98%)' : 'hsl(222.2, 47.4%, 11.2%)';
  const mutedColor = isDark ? 'hsl(215, 20.2%, 65.1%)' : 'hsl(215.4, 16.3%, 46.9%)';

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <ArrowLeft color={iconColor} size={24} />
        </TouchableOpacity>
        <Text variant="h3">Paramètres</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-6">
        {/* Theme Section */}
        <View className="mb-6">
          <Text className="mb-3 font-semibold">Apparence</Text>
          <View className="rounded-xl border border-border bg-card">
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
                    <Icon color={iconColor} size={20} />
                    <Text>{option.label}</Text>
                  </View>
                  {isSelected && <Check color="hsl(142, 76%, 36%)" size={20} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Other Settings (Placeholders) */}
        <View className="mb-6">
          <Text className="mb-3 font-semibold">Préférences</Text>
          <View className="rounded-xl border border-border bg-card">
            <TouchableOpacity
              className="flex-row items-center justify-between border-b border-border px-4 py-4"
              activeOpacity={0.7}
            >
              <View className="flex-row items-center gap-3">
                <Bell color={iconColor} size={20} />
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
              activeOpacity={0.7}
            >
              <View className="flex-row items-center gap-3">
                <Shield color={iconColor} size={20} />
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
          <View className="rounded-xl border border-border bg-card">
            <View className="flex-row items-center justify-between px-4 py-4">
              <View className="flex-row items-center gap-3">
                <Info color={mutedColor} size={20} />
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
