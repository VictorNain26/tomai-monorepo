/**
 * Cohere Rerank 3.5 — optional stage-2 reranker on top of BM25+RRF.
 *
 * Activation: set COHERE_API_KEY in the environment. No fallback mode — if
 * the key is absent, `isConfigured()` returns false and rag.service.ts keeps
 * the existing BM25+RRF output unchanged. If the key IS set but an API call
 * fails, the rerank call throws and the caller decides whether to surface
 * the error or drop back to stage-1 output; we never "silently degrade".
 *
 * Why: BM25+RRF is good first-stage recall but a learned cross-encoder like
 * Rerank 3.5 materially improves top-k precision on French curriculum
 * content (+8 to +12 pts nDCG in published evals on multilingual corpora).
 *
 * Docs: https://docs.cohere.com/docs/rerank-overview
 */

import { logger } from '../lib/observability.js';
import { withTimeout } from '../lib/retry.js';
import type { RerankedResult } from './rerank.service.js';

const COHERE_API_URL = 'https://api.cohere.com/v2/rerank';
const COHERE_MODEL = 'rerank-v3.5';
const COHERE_TIMEOUT_MS = 6_000;

function getApiKey(): string | undefined {
  const key = Bun.env['COHERE_API_KEY'];
  return key && key.length > 0 ? key : undefined;
}

export function isCohereRerankConfigured(): boolean {
  return getApiKey() !== undefined;
}

interface CohereRerankResult {
  index: number;
  relevance_score: number;
}

interface CohereRerankResponse {
  results: CohereRerankResult[];
  id?: string;
  meta?: { billed_units?: { search_units?: number } };
}

/**
 * Apply Cohere Rerank 3.5 as a second-stage reranker. Returns the input
 * documents re-ordered by cohere's relevance score, truncated to topK.
 *
 * Throws if the API key is missing (caller must check `isCohereRerankConfigured`
 * before invoking) or if the HTTP call fails. Never degrades silently.
 */
export async function rerankWithCohere(
  query: string,
  documents: RerankedResult[],
  topK: number,
): Promise<RerankedResult[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('COHERE_API_KEY is not configured');
  }

  if (documents.length === 0) return [];
  if (documents.length === 1) return documents.slice(0, topK);

  const startTime = Date.now();

  // Concatenate title + content so the reranker sees the full passage. Cap
  // per-doc text at ~2000 chars — Cohere's rerank model handles long inputs
  // but latency grows linearly and our chunks are <=800 tokens anyway.
  const texts = documents.map(d => {
    const combined = `${d.title}\n${d.content}`;
    return combined.length > 2000 ? combined.slice(0, 2000) : combined;
  });

  const response = await withTimeout(
    fetch(COHERE_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: COHERE_MODEL,
        query,
        documents: texts,
        top_n: Math.min(topK, documents.length),
      }),
    }),
    COHERE_TIMEOUT_MS,
    'cohere:rerank',
  );

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Cohere rerank HTTP ${response.status}: ${body.slice(0, 200)}`);
  }

  const payload = (await response.json()) as CohereRerankResponse;
  if (!Array.isArray(payload.results)) {
    throw new Error('Cohere rerank response missing `results` array');
  }

  // Reorder documents by cohere score. Preserve the original BM25/RRF
  // scores on each entry and overwrite final_score with cohere's relevance
  // so downstream thresholding uses the best-available ranking signal.
  const reordered = payload.results
    .filter(r => r.index >= 0 && r.index < documents.length)
    .map(r => {
      const source = documents[r.index];
      if (!source) return null;
      return { ...source, final_score: r.relevance_score };
    })
    .filter((d): d is RerankedResult => d !== null);

  logger.info('Cohere rerank applied', {
    operation: 'cohere:rerank',
    inputCount: documents.length,
    outputCount: reordered.length,
    topCohereScore: reordered[0]?.final_score.toFixed(3) ?? 'N/A',
    durationMs: Date.now() - startTime,
  });

  return reordered;
}
