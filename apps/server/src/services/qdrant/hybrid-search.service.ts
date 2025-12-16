/**
 * Dense Search Service - Recherche sémantique Qdrant
 *
 * Architecture simplifiée 2025:
 * - Dense search uniquement: Mistral embeddings 1024D + Cosine similarity (0-1)
 * - Filtrage par niveau/matière côté Qdrant
 *
 * Migration Gemini → Mistral (Janvier 2025)
 *
 * @see https://qdrant.tech/documentation/concepts/search/
 */

import { getQdrantClient } from './qdrant-client.service.js';
import { QDRANT_CONFIG } from './config.js';
import { mistralEmbeddingsService } from '../mistral-embeddings.service.js';
import { logger } from '../../lib/observability.js';
import type { HybridSearchOptions, QdrantSearchResult, EducationalPayload } from './types.js';

/**
 * Génère l'embedding Mistral 1024D pour une query
 */
async function generateQueryEmbedding(query: string): Promise<number[]> {
  const result = await mistralEmbeddingsService.generateEmbedding(query);
  return result.embedding;
}

/**
 * Recherche dense (cosine similarity 0-1)
 *
 * @param options - Query, filtres niveau/matière, limite et score minimum
 * @returns Résultats avec scores cosine normalisés 0-1
 */
export async function denseSearch(options: HybridSearchOptions): Promise<QdrantSearchResult[]> {
  const {
    query,
    niveau,
    matiere,
    limit = QDRANT_CONFIG.retrieval.defaultLimit,
    minScore = QDRANT_CONFIG.retrieval.minScore,
  } = options;

  const client = getQdrantClient();
  const startTime = Date.now();

  // Générer embedding Mistral 1024D
  const denseVector = await generateQueryEmbedding(query);

  // Construire filtre Qdrant
  const filter = buildFilter(niveau, matiere);

  // Recherche cosine similarity
  const queryResult = await client.query(QDRANT_CONFIG.collection.name, {
    query: denseVector,
    using: QDRANT_CONFIG.collection.denseVector.name,
    limit,
    filter,
    with_payload: true,
  });

  const results = queryResult.points ?? [];
  const searchTimeMs = Date.now() - startTime;

  logger.debug(`[DenseSearch] Found ${results.length} results in ${searchTimeMs}ms`, { operation: 'qdrant:search:dense', resultsCount: results.length, searchTimeMs });

  // Filtrer par score minimum et formater
  return results
    .filter((r) => r.score >= minScore)
    .map((r) => ({
      id: String(r.id),
      score: r.score,
      payload: (r.payload ?? {}) as unknown as EducationalPayload,
    }));
}

/**
 * Construit le filtre Qdrant pour niveau et matière
 */
function buildFilter(
  niveau?: string,
  matiere?: string
): { must: Array<{ key: string; match: { value: string } }> } | undefined {
  const conditions: Array<{ key: string; match: { value: string } }> = [];

  if (niveau) {
    conditions.push({
      key: 'niveau',
      match: { value: niveau },
    });
  }

  if (matiere) {
    conditions.push({
      key: 'matiere',
      match: { value: matiere },
    });
  }

  if (conditions.length === 0) {
    return undefined;
  }

  return { must: conditions };
}
