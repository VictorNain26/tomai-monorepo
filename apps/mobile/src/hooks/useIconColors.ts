import { useThemeColors, type ThemeColors } from './useThemeColors';

export type IconColors = Pick<
  ThemeColors,
  'foreground' | 'muted' | 'primary' | 'destructive' | 'success' | 'warning' | 'info' | 'white'
>;

export function useIconColors(): IconColors {
  return useThemeColors();
}
