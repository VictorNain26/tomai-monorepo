/**
 * Tokens motion — miroir TS des variables --duration-* de theme.css
 * (cohérence garantie par motion.test.ts). Les easings reprennent les
 * courbes standard Tailwind (ease-out / ease-in-out) pour Reanimated,
 * qui ne lit pas le CSS.
 */
export const motionDurations = {
  fast: 150,
  base: 250,
  slow: 400,
  pulse: 1000,
} as const;

export const motionEasings = {
  out: [0, 0, 0.2, 1],
  inOut: [0.4, 0, 0.2, 1],
} as const;
