import { useMemo } from 'react';
import { Easing } from 'react-native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
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

export interface TabBarConfig {
  tabColors: {
    active: string;
    inactive: string;
    background: string;
  };
  tabBarStyle: BottomTabNavigationOptions['tabBarStyle'];
}

/**
 * Tab bar config following Expo Router docs:
 * tabBarStyle only sets backgroundColor (the only documented property).
 * Height, padding, safe area, borders are handled by React Navigation internally.
 *
 * @see https://docs.expo.dev/router/advanced/tabs
 * @see https://docs.expo.dev/tutorial/add-navigation
 */
export function useTabBarConfig(): TabBarConfig {
  const colors = useThemeColors();

  const tabColors = useMemo(
    () => ({
      active: colors.primary,
      inactive: colors.muted,
      background: colors.background,
    }),
    [colors.primary, colors.muted, colors.background]
  );

  const tabBarStyle = useMemo(
    () => ({
      backgroundColor: tabColors.background,
    }),
    [tabColors]
  );

  return { tabColors, tabBarStyle };
}
