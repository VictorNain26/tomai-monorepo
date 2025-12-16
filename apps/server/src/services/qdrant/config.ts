/**
 * Configuration RAG Qdrant - Architecture simplifiée 2025
 *
 * Dense Search uniquement:
 * - Mistral embeddings 1024D (migration depuis Gemini 768D - Janvier 2025)
 * - Cosine similarity (0-1)
 * - Filtrage par niveau/matière
 *
 * @see https://qdrant.tech/documentation/concepts/search/
 */

import { appConfig } from '../../config/app.config.js';

/**
 * Configuration Qdrant centralisée
 */
export const QDRANT_CONFIG = {
  // =============================================
  // CONNECTION
  // =============================================
  connection: {
    url: appConfig.qdrant.url,
    apiKey: appConfig.qdrant.apiKey,
    timeout: 30000,
  },

  // =============================================
  // COLLECTION
  // =============================================
  collection: {
    name: appConfig.qdrant.collectionName,
    // Dense vectors: Mistral embeddings 1024D
    denseVector: {
      name: 'dense',
      size: 1024,
      distance: 'Cosine' as const,
    },
    // Sparse vectors: conservé pour rétro-compatibilité (non utilisé en recherche)
    sparseVector: {
      name: 'sparse',
      enableIDF: true,
    },
  },

  // =============================================
  // RETRIEVAL (Thresholds cosine 0-1)
  // =============================================
  retrieval: {
    defaultLimit: appConfig.rag.defaultLimit,
    maxLimit: appConfig.rag.maxLimit,
    // Score minimum cosine (0.35 = pertinence faible mais acceptable)
    minScore: 0.35,
    // Score "bon" (0.5 = pertinence correcte)
    goodScore: 0.5,
    // Score excellent (0.7 = très pertinent)
    highScore: 0.7,
  },

  // =============================================
  // CONTEXT
  // =============================================
  context: {
    maxLength: appConfig.rag.contextMaxLength,
  },

  // =============================================
  // CACHE
  // =============================================
  cache: {
    enabled: true,
    ttlSeconds: appConfig.rag.cacheTtlSeconds,
    keyPrefix: 'qdrant:rag:v2:',
  },
} as const;

export type QdrantConfig = typeof QDRANT_CONFIG;
