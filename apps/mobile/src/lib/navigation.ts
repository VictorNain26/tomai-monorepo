import { useMemo, type ComponentProps } from 'react';
import { Easing } from 'react-native';
import { Tabs } from 'expo-router';
import type { NativeStackNavigationOptions } from 'expo-router';
import type { MaterialTopTabNavigationOptions } from 'expo-router/js-top-tabs';
import { useThemeColors } from '@/hooks';

// Expo Router 56 decoupled from the standalone @react-navigation packages and
// ships its own bottom-tabs types. Derive the option type from the <Tabs>
// component so it stays identical to what its screenOptions prop accepts
// (the standalone @react-navigation/bottom-tabs types are a different identity).
type BottomTabScreenOptions = Exclude<
  NonNullable<ComponentProps<typeof Tabs>['screenOptions']>,
  (...args: never[]) => unknown
>;

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

export function useTabScreenOptions(tabBackground: string): Partial<BottomTabScreenOptions> {
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
  tabBarStyle: BottomTabScreenOptions['tabBarStyle'];
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

/**
 * Material Top Tabs config for swipeable tab navigation.
 * Used by parent layout with tabBarPosition: 'bottom'.
 *
 * @see https://reactnavigation.org/docs/material-top-tab-navigator
 */
export function useSwipeableTabConfig(): MaterialTopTabNavigationOptions {
  const colors = useThemeColors();

  return useMemo(
    () => ({
      tabBarShowIcon: true,
      tabBarShowLabel: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.muted,
      tabBarPressColor: 'transparent',
      tabBarIndicatorStyle: { backgroundColor: colors.primary, height: 2 },
      tabBarStyle: { backgroundColor: colors.background },
      tabBarIconStyle: { width: 28, height: 28 },
      swipeEnabled: true,
      lazy: true,
    }),
    [colors.primary, colors.muted, colors.background]
  );
}
