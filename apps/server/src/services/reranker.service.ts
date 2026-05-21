/**
 * Reranker service — bge-reranker-v2-m3 self-hosted Scaleway.
 *
 * Stage 2 du RAG pipeline : après le hybrid search Qdrant (dense + sparse +
 * RRF native), on re-classe les top-N candidats avec un cross-encoder.
 * Mesuré dans la littérature à +5-15 % de recall@5 vs hybrid pur (Pinecone /
 * Cohere benchmarks 2026, ZeroEntropy report).
 *
 * Modèle : `BAAI/bge-reranker-v2-m3` (568M params, MIT, multilingue FR/EN
 * natif). Servi par HuggingFace `text-embeddings-inference` (TEI) en mode
 * reranker — endpoint POST `/rerank` qui accepte `{query, texts: [...]}` et
 * répond `[{index, score}, ...]`. Voir `apps/server/RERANKER_DEPLOY.md`
 * pour la procédure Scaleway.
 *
 * Souveraineté : MIT + auto-hébergé EU (`fr-par`). Aucun appel hors EU.
 *
 * Toggle : `RERANKER_ENABLED=true` + `RERANKER_URL=https://...` dans .env.
 * Si `RERANKER_URL` absent ou unreachable, le service répond `enabled=false`
 * et `rag.service` se rabat sur l'ordre hybrid RRF sans rerank — donc pas de
 * single-point-of-failure : un reranker down n'écroule pas le chat.
 */

import { withGenAiSpan } from '../lib/otel/index.js';
import { logger } from '../lib/observability.js';

interface RerankerResponse {
  /** Index of the input text (0-based, same order as candidates passed). */
  index: number;
  /** Cross-encoder score, higher is more relevant. TEI normalises to ~[0, 1]. */
  score: number;
}

export interface RerankCandidate {
  id: string;
  text: string;
}

export interface RerankedCandidate extends RerankCandidate {
  /** Cross-encoder score (sigmoid of the model logit, ~[0, 1]). */
  rerankScore: number;
  /** Rank in the reranked list (1-based). */
  rank: number;
}

const RERANKER_URL = Bun.env['RERANKER_URL'];
const RERANKER_ENABLED = Bun.env['RERANKER_ENABLED'] !== 'false' && Boolean(RERANKER_URL);
const RERANKER_TIMEOUT_MS = parseInt(Bun.env['RERANKER_TIMEOUT_MS'] ?? '8000', 10);
const RERANKER_MODEL = Bun.env['RERANKER_MODEL'] ?? 'BAAI/bge-reranker-v2-m3';

class RerankerService {
  /**
   * Re-classe les candidats d'un retrieval Qdrant via un cross-encoder.
   *
   * Si le reranker n'est pas configuré ou échoue, retourne les candidats
   * d'origine inchangés (best-effort) — l'appelant ne voit pas la
   * différence sauf via les logs / spans OTel.
   */
  async rerank(
    query: string,
    candidates: RerankCandidate[],
    options?: { topN?: number },
  ): Promise<RerankedCandidate[]> {
    if (!RERANKER_ENABLED || !RERANKER_URL) {
      return this.passthrough(candidates);
    }
    if (candidates.length === 0) return [];

    const topN = options?.topN ?? candidates.length;

    return withGenAiSpan(
      {
        operation: 'execute_tool',
        provider: 'mistral_ai', // semconv: closest stable value for self-hosted model
        model: RERANKER_MODEL,
        serverAddress: new URL(RERANKER_URL).host,
      },
      async (recordResponse) => {
        try {
          const response = await fetch(`${RERANKER_URL.replace(/\/$/, '')}/rerank`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query,
              texts: candidates.map((c) => c.text),
              return_documents: false,
              raw_scores: false,
            }),
            // Cf. mistral-client.ts: confined RequestInit cast for mobile
            // typecheck transitivity through Eden Treaty.
            signal: AbortSignal.timeout(RERANKER_TIMEOUT_MS) as RequestInit['signal'],
          });

          if (!response.ok) {
            const body = await response.text();
            throw new Error(`reranker ${response.status}: ${body.slice(0, 200)}`);
          }

          const data = (await response.json()) as RerankerResponse[];
          recordResponse({
            model: RERANKER_MODEL,
            inputTokens: candidates.length, // proxy: number of pairs scored
            outputTokens: data.length,
          });

          const reranked: RerankedCandidate[] = data
            .map((r, rankFromZero) => {
              const src = candidates[r.index];
              if (!src) return null;
              return {
                ...src,
                rerankScore: r.score,
                rank: rankFromZero + 1,
              };
            })
            .filter((x): x is RerankedCandidate => x !== null)
            .slice(0, topN);

          logger.info('Reranker reordered candidates', {
            operation: 'reranker:rerank',
            inputCount: candidates.length,
            outputCount: reranked.length,
            topScore: reranked[0]?.rerankScore.toFixed(3) ?? 'N/A',
          });

          return reranked;
        } catch (err) {
          // Best-effort: log + fallback. The chat path must keep working
          // when the reranker pod is restarting or out of capacity.
          logger.warn('Reranker failed, returning passthrough order', {
            operation: 'reranker:fallback',
            _error: err instanceof Error ? err.message : String(err),
            inputCount: candidates.length,
          });
          return this.passthrough(candidates);
        }
      },
    );
  }

  /** Identity transform when the reranker is disabled or down. */
  private passthrough(candidates: RerankCandidate[]): RerankedCandidate[] {
    return candidates.map((c, i) => ({ ...c, rerankScore: 0, rank: i + 1 }));
  }

  isEnabled(): boolean {
    return RERANKER_ENABLED;
  }
}

export const rerankerService = new RerankerService();
