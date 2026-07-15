/**
 * @repo/tokens — design system partagé.
 *
 * Les valeurs vivent dans `theme.css` (light) et `theme-dark.css` (dark),
 * consommés en CSS par web et landing. `colors.ts` expose les mêmes palettes
 * aux consommateurs JS (NativeWind v5 mobile) — cohérence CSS ↔ TS garantie
 * par `colors.test.ts`.
 */
export { darkColors, lightColors, type ColorToken } from "./colors";
export { motionDurations, motionEasings } from "./motion";
