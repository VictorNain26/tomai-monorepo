/**
 * The 95 % Wilson score interval of a proportion: a rate is never published alone
 * (docs/etudes/2026-10-06/refonte-evaluation.md, décision 3). Unlike the normal approximation, it
 * stays inside [0, 1] and keeps a width when nothing or everything was seen (Brown, Cai and
 * DasGupta, « Interval Estimation for a Binomial Proportion », Statistical Science, 2001).
 */

const Z_95 = 1.959963984540054;

export function wilson(successes: number, trials: number, z = Z_95): { low: number; high: number } {
  if (trials === 0) return { low: 0, high: 1 };
  const p = successes / trials;
  const z2 = z * z;
  const denominator = 1 + z2 / trials;
  const center = (p + z2 / (2 * trials)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p)) / trials + z2 / (4 * trials * trials))) / denominator;
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin) };
}
