import { useMemo } from 'react';
import { useTheme } from './useTheme';

export interface ThemeColors {
  primary: string;
  primaryForeground: string;
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;
  destructive: string;
  destructiveForeground: string;
  info: string;
  infoForeground: string;
  foreground: string;
  muted: string;
  background: string;
  border: string;
  card: string;
}

const LIGHT: ThemeColors = {
  primary: '#3B82F6',
  primaryForeground: '#FFFFFF',
  success: '#059669',
  successForeground: '#FFFFFF',
  warning: '#D97706',
  warningForeground: '#FFFFFF',
  destructive: '#DC2626',
  destructiveForeground: '#FFFFFF',
  info: '#0EA5E9',
  infoForeground: '#FFFFFF',
  foreground: '#1C1917',
  muted: '#57534E',
  background: '#FAFAF9',
  border: '#E7E5E4',
  card: '#FFFFFF',
};

const DARK: ThemeColors = {
  primary: '#60A5FA',
  primaryForeground: '#1C1917',
  success: '#34D399',
  successForeground: '#1C1917',
  warning: '#FBBF24',
  warningForeground: '#1C1917',
  destructive: '#F87171',
  destructiveForeground: '#1C1917',
  info: '#38BDF8',
  infoForeground: '#1C1917',
  foreground: '#F5F5F4',
  muted: '#A8A29E',
  background: '#1C1917',
  border: '#44403C',
  card: '#292524',
};

export function useThemeColors(): ThemeColors {
  const { isDark } = useTheme();
  return useMemo(() => (isDark ? DARK : LIGHT), [isDark]);
}
