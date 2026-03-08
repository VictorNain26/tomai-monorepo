import { useMemo } from 'react';
import { Easing, type ViewStyle } from 'react-native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/hooks';

export function useStackScreenOptions(): NativeStackNavigationOptions {
  const colors = useThemeColors();

  return useMemo(
    () => ({
      headerShown: false,
      animation: 'default' as const,
      gestureEnabled: true,
      fullScreenGestureEnabled: true,
      freezeOnBlur: true,
      contentStyle: {
        backgroundColor: colors.background,
      },
    }),
    [colors.background]
  );
}

export function useTabScreenOptions(tabBackground: string): Partial<BottomTabNavigationOptions> {
  return useMemo(
    () => ({
      animation: 'fade' as const,
      transitionSpec: {
        animation: 'timing' as const,
        config: {
          duration: 150,
          easing: Easing.inOut(Easing.ease),
        },
      },
      freezeOnBlur: true,
      tabBarHideOnKeyboard: true,
      sceneStyle: { backgroundColor: tabBackground },
    }),
    [tabBackground]
  );
}

const TAB_BAR_HEIGHT = 48;
const TAB_BAR_PADDING_TOP = 6;

export interface TabBarConfig {
  tabColors: {
    active: string;
    inactive: string;
    background: string;
    border: string;
  };
  tabBarStyle: ViewStyle;
}

export function useTabBarConfig(): TabBarConfig {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const tabColors = useMemo(
    () => ({
      active: colors.primary,
      inactive: colors.muted,
      background: colors.background,
      border: colors.border,
    }),
    [colors.primary, colors.muted, colors.background, colors.border]
  );

  const tabBarStyle = useMemo(
    () => ({
      backgroundColor: tabColors.background,
      borderTopColor: tabColors.border,
      borderTopWidth: 1,
      paddingTop: TAB_BAR_PADDING_TOP,
      paddingBottom: Math.max(insets.bottom, 8),
      height: TAB_BAR_HEIGHT + Math.max(insets.bottom, 8),
    }),
    [tabColors, insets.bottom]
  );

  return { tabColors, tabBarStyle };
}
