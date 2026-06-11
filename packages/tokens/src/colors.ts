/**
 * Tokens couleur en valeurs JS pour les consommateurs hors CSS — NativeWind v5
 * côté mobile (VariableContextProvider) où le bloc `.dark` n'existe pas.
 * Sources CSS : theme.css (light) et theme-dark.css (dark) ; la cohérence
 * CSS ↔ TS est garantie par colors.test.ts. Les deux palettes sont exhaustives
 * (Record<ColorToken, string>) : l'injection runtime ne fait pas d'héritage
 * de cascade, contrairement au CSS.
 */
export const lightColors = {
  "--color-background": "#FFFFFF",
  "--color-foreground": "#0F172A",
  "--color-primary": "#2563EB",
  "--color-primary-foreground": "#FFFFFF",
  "--color-secondary": "#F1F5F9",
  "--color-secondary-foreground": "#0F172A",
  "--color-muted": "#F1F5F9",
  "--color-muted-foreground": "#64748B",
  "--color-accent": "#F1F5F9",
  "--color-accent-foreground": "#0F172A",
  "--color-card": "#FFFFFF",
  "--color-card-foreground": "#0F172A",
  "--color-popover": "#FFFFFF",
  "--color-popover-foreground": "#0F172A",
  "--color-destructive": "#DC2626",
  "--color-destructive-foreground": "#FFFFFF",
  "--color-success": "#059669",
  "--color-success-foreground": "#FFFFFF",
  "--color-warning": "#D97706",
  "--color-warning-foreground": "#FFFFFF",
  "--color-info": "#0EA5E9",
  "--color-info-foreground": "#FFFFFF",
  "--color-border": "#E2E8F0",
  "--color-input": "#E2E8F0",
  "--color-ring": "#2563EB",
  "--color-violet": "#7C3AED",
  "--color-violet-foreground": "#FFFFFF",
} as const;

export type ColorToken = keyof typeof lightColors;

export const darkColors: Record<ColorToken, string> = {
  "--color-background": "#020617",
  "--color-foreground": "#F8FAFC",
  "--color-primary": "#3B82F6",
  "--color-primary-foreground": "#0F172A",
  "--color-secondary": "#1E293B",
  "--color-secondary-foreground": "#F8FAFC",
  "--color-muted": "#1E293B",
  "--color-muted-foreground": "#94A3B8",
  "--color-accent": "#1E293B",
  "--color-accent-foreground": "#F8FAFC",
  "--color-card": "#0F172A",
  "--color-card-foreground": "#F8FAFC",
  "--color-popover": "#0F172A",
  "--color-popover-foreground": "#F8FAFC",
  "--color-destructive": "#F87171",
  "--color-destructive-foreground": "#0F172A",
  "--color-success": "#34D399",
  "--color-success-foreground": "#0F172A",
  "--color-warning": "#FBBF24",
  "--color-warning-foreground": "#0F172A",
  "--color-info": "#38BDF8",
  "--color-info-foreground": "#0F172A",
  "--color-border": "#1E293B",
  "--color-input": "#1E293B",
  "--color-ring": "#3B82F6",
  "--color-violet": "#8B5CF6",
  "--color-violet-foreground": "#FFFFFF",
} as const;
