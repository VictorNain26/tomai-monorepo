/**
 * Client HTTP du service Python tomai-ai-service.
 *
 * Centralise les 2 appels qu'on fait au service AI :
 * - `embed(text)` → BGE-M3 dense (1024D) + sparse (`{indices, values}` Qdrant)
 * - `rerank(query, texts, topN)` → bge-reranker-v2-m3 (compat TEI)
 *
 * Pourquoi un service Python séparé ? Le sparse natif BGE-M3 (lexical_weights)
 * n'est exposé que par la lib Python FlagEmbedding officielle BAAI. Aucun
 * serveur HTTP TS/Node OSS mature ne le reproduit (audit mai 2026 :
 * TEI/Infinity/Xinference → tous non). Plus de détails et bench chiffré :
 * `tomai-curriculum/docs/ARCHITECTURE.md §Décision benchmark embedder`.
 *
 * Toggle d'urgence : `AI_SERVICE_URL` non défini → throw au boot (le RAG
 * dépend de ce service). Pas de fallback silencieux : si l'AI est down, on
 * veut un crash explicite pour alerter, pas un retrieval cassé.
 */

import { withGenAiSpan } from '../lib/otel/index.js';
import { logger } from '../lib/observability.js';

const AI_SERVICE_URL = Bun.env['AI_SERVICE_URL'] ?? '';
const AI_SERVICE_TOKEN = Bun.env['AI_SERVICE_TOKEN'] ?? '';
const AI_SERVICE_TIMEOUT_MS = parseInt(Bun.env['AI_SERVICE_TIMEOUT_MS'] ?? '15000', 10);

// Warn at startup if token is missing (non-prod concern but should be explicit)
if (!AI_SERVICE_TOKEN) {
  logger.warn(
    'AI_SERVICE_TOKEN not set: ai-service endpoints will be called without Bearer auth. ' +
      'This is acceptable for local development but not recommended for production. ' +
      'Set AI_SERVICE_TOKEN to enable request authentication.',
    { operation: 'ai-service:init' },
  );
}

export interface SparseVector {
  indices: number[];
  values: number[];
}

export interface EmbedResult {
  dense: number[];
  sparse: SparseVector;
}

interface EmbedResponse {
  model: string;
  embeddings: Array<{
    dense: number[];
    sparse: SparseVector;
  }>;
}

interface RerankResponse {
  model: string;
  results: Array<{ index: number; score: number }>;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (AI_SERVICE_TOKEN) headers['Authorization'] = `Bearer ${AI_SERVICE_TOKEN}`;
  return headers;
}

function requireUrl(): string {
  if (!AI_SERVICE_URL) {
    throw new Error(
      'AI_SERVICE_URL is required. The Python ai-service (BGE-M3 + rerank) ' +
        'is the only source of dense + sparse vectors aligned with the Qdrant index. ' +
        'See apps/ai-service/README.md.',
    );
  }
  return AI_SERVICE_URL.replace(/\/$/, '');
}

class AIServiceClient {
  /** Embed une query — dense + sparse BGE-M3 en un seul forward pass. */
  async embed(text: string): Promise<EmbedResult> {
    const url = requireUrl();
    return withGenAiSpan(
      {
        operation: 'embeddings',
        provider: 'mistral_ai', // semconv: closest stable value for self-hosted
        model: 'BAAI/bge-m3',
        serverAddress: new URL(url).host,
      },
      async (recordResponse) => {
        const response = await fetch(`${url}/embed`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ texts: [text] }),
          signal: AbortSignal.timeout(AI_SERVICE_TIMEOUT_MS) as RequestInit['signal'],
        });
        if (!response.ok) {
          const body = await response.text();
          throw new Error(`ai-service embed ${response.status}: ${body.slice(0, 200)}`);
        }
        const data = (await response.json()) as EmbedResponse;
        const item = data.embeddings[0];
        if (!item) {
          throw new Error('ai-service embed: empty embeddings array');
        }
        recordResponse({
          model: data.model,
          inputTokens: text.length, // proxy
          outputTokens: item.dense.length,
        });
        return item;
      },
    );
  }

  /**
   * Re-classe les candidats via bge-reranker-v2-m3.
   * Format de retour aligné sur HuggingFace TEI /rerank (compat ancien client).
   */
  async rerank(
    query: string,
    texts: string[],
    topN?: number,
  ): Promise<Array<{ index: number; score: number }>> {
    if (texts.length === 0) return [];
    const url = requireUrl();
    return withGenAiSpan(
      {
        operation: 'execute_tool',
        provider: 'mistral_ai',
        model: 'BAAI/bge-reranker-v2-m3',
        serverAddress: new URL(url).host,
      },
      async (recordResponse) => {
        const response = await fetch(`${url}/rerank`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ query, texts, top_n: topN ?? null }),
          signal: AbortSignal.timeout(AI_SERVICE_TIMEOUT_MS) as RequestInit['signal'],
        });
        if (!response.ok) {
          const body = await response.text();
          throw new Error(`ai-service rerank ${response.status}: ${body.slice(0, 200)}`);
        }
        const data = (await response.json()) as RerankResponse;
        recordResponse({
          model: data.model,
          inputTokens: texts.length,
          outputTokens: data.results.length,
        });
        return data.results;
      },
    );
  }

  /** Healthcheck (pour /health backend, ping rapide). */
  async isAvailable(): Promise<boolean> {
    if (!AI_SERVICE_URL) return false;
    try {
      const response = await fetch(`${requireUrl()}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000) as RequestInit['signal'],
      });
      return response.ok;
    } catch (err) {
      logger.warn('ai-service health check failed', {
        operation: 'ai-service:health',
        _error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }
}

export const aiServiceClient = new AIServiceClient();
