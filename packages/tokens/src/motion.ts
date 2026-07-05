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
