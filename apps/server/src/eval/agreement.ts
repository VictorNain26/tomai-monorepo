export type Level = 'nominal' | 'ordinal';

/**
 * Krippendorff's alpha over units each rated by at least two coders, from the coincidence
 * matrix (Krippendorff, « Computing Krippendorff's Alpha-Reliability », 2011). Null when
 * a single value occurs: agreement is then undefined, as in the `krippendorff` package of
 * PyPI, whose values the tests reproduce.
 */
export function krippendorffAlpha(units: readonly (readonly number[])[], level: Level): number | null {
  const pairable = units.filter((values) => values.length >= 2);
  const values = [...new Set(pairable.flat())].sort((a, b) => a - b);
  if (values.length < 2) return null;
  // Coincidences: each ordered pair of values within a unit, weighted by 1 / (coders - 1).
  const pairs = pairable.flatMap((unit) =>
    unit.flatMap((a, i) => unit.flatMap((b, j) => (i === j ? [] : [{ c: values.indexOf(a), k: values.indexOf(b), weight: 1 / (unit.length - 1) }]))),
  );
  const totals = values.map((_, c) => pairs.reduce((sum, pair) => sum + (pair.c === c ? pair.weight : 0), 0));
  const n = totals.reduce((sum, t) => sum + t, 0);
  const distance = (c: number, k: number, nc: number, nk: number): number => {
    if (level === 'nominal') return c === k ? 0 : 1;
    const between = totals.slice(Math.min(c, k), Math.max(c, k) + 1).reduce((sum, t) => sum + t, 0);
    return (between - (nc + nk) / 2) ** 2;
  };
  const observed = pairs.reduce((sum, { c, k, weight }) => sum + weight * distance(c, k, totals[c] ?? 0, totals[k] ?? 0), 0);
  let expected = 0;
  for (const [c, nc] of totals.entries()) {
    for (const [k, nk] of totals.entries()) expected += nc * nk * distance(c, k, nc, nk);
  }
  return 1 - ((n - 1) * observed) / expected;
}

/** Share of units on which every coder gave the same value. */
export function rawAgreement(units: readonly (readonly number[])[]): number {
  return units.filter((values) => values.every((v) => v === values[0])).length / units.length;
}

/** Deterministic PRNG (mulberry32): the same seed gives the same interval on every run. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 95 % percentile interval of alpha, resampling units with replacement. Resamples where
 * alpha is undefined are dropped; null when none is defined.
 */
export function alphaInterval(units: readonly (readonly number[])[], level: Level, { samples = 2000, seed = 1 } = {}): [number, number] | null {
  const next = random(seed);
  const alphas: number[] = [];
  for (let s = 0; s < samples; s++) {
    const resample = units.map(() => units[Math.floor(next() * units.length)] ?? []);
    const alpha = krippendorffAlpha(resample, level);
    if (alpha !== null) alphas.push(alpha);
  }
  if (alphas.length === 0) return null;
  alphas.sort((a, b) => a - b);
  const at = (q: number) => alphas[Math.min(alphas.length - 1, Math.floor(q * alphas.length))] ?? 0;
  return [at(0.025), at(0.975)];
}
