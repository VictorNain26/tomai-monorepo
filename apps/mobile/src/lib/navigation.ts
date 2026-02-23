/**
 * Shared Navigation Config - TomAI 2026
 *
 * React Navigation 7 + Expo Router SDK 54 best practices.
 * Centralized to avoid duplication across 9+ layout files.
 *
 * @see https://reactnavigation.org/docs/native-stack-navigator
 * @see https://reactnavigation.org/docs/bottom-tab-navigator
 */

import { useMemo } from 'react';
import { Easing } from 'react-native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { useTheme } from '@/hooks';
import { colors } from '@/lib/styles';

/**
 * Shared Stack screenOptions for all Stack navigators.
 *
 * - `animation: 'default'` → platform-native transitions (iOS slide, Android material)
 * - `gestureEnabled: true` → swipe-back gesture
 * - `fullScreenGestureEnabled: true` → swipe from anywhere (iOS)
 * - `freezeOnBlur: true` → performance: freeze inactive screens
 * - `contentStyle` → theme-aware background to prevent white flash
 */
export function useStackScreenOptions(): NativeStackNavigationOptions {
  const { isDark } = useTheme();

  return useMemo(
    () => ({
      headerShown: false,
      animation: 'default' as const,
      gestureEnabled: true,
      fullScreenGestureEnabled: true,
      freezeOnBlur: true,
      contentStyle: {
        backgroundColor: isDark ? colors.background.dark : colors.background.light,
      },
    }),
    [isDark]
  );
}

/**
 * Shared Tab screenOptions additions for all Tab navigators.
 *
 * Merge these with each Tab layout's own color/style options.
 *
 * - `animation: 'fade'` → cross-fade between tabs (React Navigation 7)
 * - `transitionSpec` → snappy 150ms ease-in-out timing
 * - `freezeOnBlur: true` → performance: freeze inactive tab content
 * - `tabBarHideOnKeyboard: true` → hide tab bar when keyboard shows
 * - `sceneStyle` → theme-aware background to prevent white flash
 */
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
