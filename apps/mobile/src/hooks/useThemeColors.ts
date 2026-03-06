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
  white: string;
}

const LIGHT: ThemeColors = {
  primary: '#2563EB',
  primaryForeground: '#FFFFFF',
  success: '#059669',
  successForeground: '#FFFFFF',
  warning: '#D97706',
  warningForeground: '#FFFFFF',
  destructive: '#DC2626',
  destructiveForeground: '#FFFFFF',
  info: '#0EA5E9',
  infoForeground: '#FFFFFF',
  foreground: '#1E293B',
  muted: '#64748B',
  background: '#F8FAFC',
  border: '#E2E8F0',
  card: '#FFFFFF',
  white: '#FFFFFF',
};

const DARK: ThemeColors = {
  primary: '#60A5FA',
  primaryForeground: '#1E293B',
  success: '#34D399',
  successForeground: '#1E293B',
  warning: '#FBBF24',
  warningForeground: '#1E293B',
  destructive: '#F87171',
  destructiveForeground: '#1E293B',
  info: '#38BDF8',
  infoForeground: '#1E293B',
  foreground: '#F1F5F9',
  muted: '#94A3B8',
  background: '#0F172A',
  border: '#334155',
  card: '#374151',
  white: '#FFFFFF',
};

export function useThemeColors(): ThemeColors {
  const { isDark } = useTheme();
  return useMemo(() => (isDark ? DARK : LIGHT), [isDark]);
}
