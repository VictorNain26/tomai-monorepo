/**
 * @repo/tokens — design system partagé.
 *
 * Les valeurs vivent dans `theme.css` (bloc Tailwind v4 `@theme`), importé par
 * chaque app. Ce module expose la liste des noms de tokens pour les futurs
 * consommateurs JS (ex. dark mode impératif côté mobile) et comme garde-fou
 * anti-dérive. Tenir synchronisé avec `theme.css`.
 */
export const tokenNames = [
  "font-sans",
  "font-heading",
  "font-mono",
  "radius",
  "radius-2xl",
  "radius-xl",
  "radius-lg",
  "radius-md",
  "radius-sm",
  "radius-xs",
  "spacing-18",
  "spacing-22",
  "text-2xs",
  "color-background",
  "color-foreground",
  "color-primary",
  "color-primary-foreground",
  "color-secondary",
  "color-secondary-foreground",
  "color-muted",
  "color-muted-foreground",
  "color-accent",
  "color-accent-foreground",
  "color-card",
  "color-card-foreground",
  "color-popover",
  "color-popover-foreground",
  "color-destructive",
  "color-destructive-foreground",
  "color-success",
  "color-success-foreground",
  "color-warning",
  "color-warning-foreground",
  "color-info",
  "color-info-foreground",
  "color-border",
  "color-input",
  "color-ring",
  "color-violet",
  "color-violet-foreground",
] as const;

export type TokenName = (typeof tokenNames)[number];
