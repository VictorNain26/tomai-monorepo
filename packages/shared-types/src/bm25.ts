/**
 * BM25 sparse-vector tokeniser — strict mirror of
 * `tomai-curriculum/schema/bm25.py`.
 *
 * Qdrant doesn't tokenise: it receives `{indices: u32[], values: f32[]}`
 * and computes IDF from the cumulated counts. For IDF to be stable, the
 * SAME `(regex, lowercase, FNV-1a hash, 31-bit mask)` chain must run at
 * ingest (Python) AND at query (TypeScript). Any divergence silently breaks
 * recall — the same word hashes to two indices and BM25 becomes useless.
 *
 * Used by:
 *   - `apps/server/src/services/rag.service.ts:toSparseVector` (query side)
 *   - `tomai-curriculum/schema/bm25.py:to_sparse_vector` (ingest side)
 *
 * Test parity: `apps/server/src/tests/bm25-parity.test.ts` runs against a
 * fixture JSON (`apps/server/src/tests/fixtures/bm25_parity.json`)
 * generated from the Python tokeniser. Any byte-level drift fails CI.
 *
 * Source: `https://qdrant.tech/articles/sparse-vectors`.
 */

/**
 * Characters accepted inside a token (mirror of the Python regex):
 * - latin a-z
 * - French accented vowels: à â ä é è ê ë ï î ô ù û ü ÿ
 * - French ligatures: œ æ
 * - cedilla: ç
 * - digits
 */
export const TOKEN_RE = /[a-zàâäéèêëïîôùûüÿœæç0-9]+/g;

/**
 * FNV-1a 32-bit hash, masked to a 31-bit positive integer.
 * Mirrors Python `_hash_token_fnv1a` exactly.
 */
export function hashTokenFnv1a(token: string): number {
  let h = 2166136261; // FNV offset basis (32-bit)
  for (let i = 0; i < token.length; i++) {
    h = (h ^ token.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 16777619) >>> 0; // FNV prime, mod 2^32
  }
  return h & 0x7fffffff; // 31-bit positive
}

/** Lowercase + regex-tokenise. */
export function tokenizeFr(text: string): string[] {
  return text.toLowerCase().match(TOKEN_RE) ?? [];
}

export interface SparseVector {
  indices: number[];
  values: number[];
}

/**
 * Convert a text into a Qdrant sparse vector. Term frequency = raw count
 * per hash. Qdrant computes IDF server-side from cumulated counts.
 */
export function toSparseVector(text: string): SparseVector {
  const tokens = tokenizeFr(text);
  const counts = new Map<number, number>();
  for (const token of tokens) {
    const idx = hashTokenFnv1a(token);
    counts.set(idx, (counts.get(idx) ?? 0) + 1);
  }
  return {
    indices: Array.from(counts.keys()),
    values: Array.from(counts.values()),
  };
}
