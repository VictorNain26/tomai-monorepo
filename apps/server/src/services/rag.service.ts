/**
 * RAG Service - Recherche sémantique hybride Qdrant native.
 *
 * Architecture mai 2026 (post-migration BGE-M3) :
 * - Embed query via `tomai-ai-service` (BGE-M3 dense + sparse natif single pass)
 * - Hybrid search Qdrant : prefetch dense + sparse → fusion RRF native
 * - Stage 2 : rerank bge-reranker-v2-m3 (via le même ai-service)
 *
 * Pré-requis collection Qdrant : ingérée avec BGE-M3 (dense 1024D cosine +
 * sparse natif lexical_weights). Voir `tomai-curriculum/scripts/ingest.py
 * --embed-model=BAAI/bge-m3 --sparse-method=BAAI/bge-m3` et la décision
 * benchmark documentée dans `tomai-curriculum/docs/ARCHITECTURE.md`.
 *
 * Sources :
 * - https://qdrant.tech/articles/sparse-vectors (hybrid search natif)
 * - https://huggingface.co/BAAI/bge-m3 (modèle + lexical_weights)
 */

import { qdrantService, type QdrantSearchResult } from './qdrant.service.js';
import { aiServiceClient } from './ai-service.client.js';
import { retrievalAuditRepository } from '../db/repositories/index.js';
import { logger } from '../lib/observability.js';
import type { EducationLevelType } from '../types/index.js';

// Thresholds pour cosine similarity (0-1)
const RAG_THRESHOLDS = {
  MIN_SCORE: 0.35,
  GOOD_SCORE: 0.5,
  EXCELLENT_SCORE: 0.7,
} as const;

// =============================================================================
// Types
// =============================================================================

export interface HybridSearchOptions {
  query: string;
  niveau: EducationLevelType;
  /** Filtrer sur une matière. Omettre pour chercher toutes matières confondues. */
  matiere?: string;
  competence?: string | null;
  limit?: number;
  minSimilarity?: number;
  /**
   * Audit trail (RGPD article 30) — when both are provided, we persist a row
   * to `retrieval_audit` so we can answer "what did this user search" without
   * replaying logs. The query text itself is hashed before insert; only
   * metadata (filters, counts, latency) hits the table.
   */
  auditUserId?: string | null;
  auditSessionId?: string | null;
}

export interface SemanticChunk {
  id: string;
  score: number;
  text: string;
  section: string;
  matiere: string;
  niveau: string;
}

export interface HybridSearchResult {
  context: string;
  strategy: string;
  semanticChunks: SemanticChunk[];
  microChunks: Array<{ id: string; score: number; text: string }>;
  averageSimilarity: number;
  searchTime: number;
  bestMatchSection?: string;
  bestMatchMatiere?: string;
}

// =============================================================================
// Service
// =============================================================================

// isAvailable() result cache: Qdrant getCollection + Mistral embed('test')
// are both real network calls. Caching avoids doubling them per flashcard generation
// (audit P0-7: tool-executor calls isAvailable then hybridSearch which re-checks).
const AVAILABILITY_CACHE_TTL_MS = 30_000;

class RAGService {
  private availabilityCache: { value: boolean; expiresAt: number } | null = null;

  /**
   * Recherche sémantique hybride via Qdrant Query API.
   *
   * Pipeline :
   * 1. Embedding dense de la query (Mistral 1024D)
   * 2. Tokenisation BM25 côté server (sparse vector)
   * 3. Qdrant Query API : prefetch dense + sparse → fusion RRF native
   * 4. Construction du contexte structuré pour le LLM
   */
  async hybridSearch(options: HybridSearchOptions): Promise<HybridSearchResult> {
    const startTime = Date.now();

    const available = await this.isAvailable();
    if (!available) {
      logger.warn('RAG service not available', { operation: 'rag-search' });
      return this.emptyResult();
    }

    try {
      // BGE-M3 produit dense + sparse natif en un seul forward pass côté
      // ai-service (économie de latence ~50% vs deux appels séparés).
      const queryEmbed = await aiServiceClient.embed(options.query);
      const queryDense = queryEmbed.dense;
      const querySparse = queryEmbed.sparse;

      const topK = options.limit ?? 5;
      // Stage 2 rerank toujours activé en post-migration (synergie infra :
      // même service Python que l'embed, latence supplémentaire marginale).
      // Prefetch 4× topK pour donner au cross-encoder de la matière à réordonner.
      const prefetchK = Math.max(topK * 4, 20);

      // NOTE : on ne passe PAS scoreThreshold à searchHybrid. La fusion RRF
      // côté Qdrant retourne des scores petits (1/(k+rank), k=60 → top-1 ≈ 0.016)
      // qui ne sont PAS comparables à la cosine similarity (~0.5-0.9). Le seuil
      // RAG_THRESHOLDS.MIN_SCORE 0.35 est calibré cosine ; le passer à
      // searchHybrid filtrerait tous les résultats. Le filtrage qualité se fait
      // a posteriori sur averageSimilarity (calculé depuis score Qdrant).
      //
      // Pré-requis collection (vérifié par boot check ou déploiement coordonné) :
      // - sparse_vectors_config.bm25 avec Modifier.IDF (cf. migrate_collection.py
      //   du curriculum). Si absent, Qdrant renvoie 400 "vector name not found"
      //   et l'erreur propage — on ne masque PAS le problème avec un fallback
      //   silencieux qui rendrait la régression invisible en observabilité.
      let results = await qdrantService.searchHybrid(
        queryDense,
        querySparse,
        { niveau: options.niveau, matiere: options.matiere },
        prefetchK,
        { hnswEf: 128 },
      );

      let strategy: 'qdrant-hybrid-rrf' | 'qdrant-hybrid-rrf+rerank-bge-m3' =
        'qdrant-hybrid-rrf';

      // Stage 2: cross-encoder rerank via ai-service. En cas d'échec, on
      // log et on garde l'ordre hybrid pour ne pas casser le chat (rerank =
      // optimisation, pas dépendance dure du retrieval).
      if (results.length > 1) {
        try {
          const reranked = await aiServiceClient.rerank(
            options.query,
            results.map((r) => r.text),
            topK,
          );
          // `reranked[i].index` réfère à la position dans `results` qu'on a envoyée
          results = reranked
            .map((r) => results[r.index])
            .filter((r): r is QdrantSearchResult => r !== undefined)
            .slice(0, topK);
          strategy = 'qdrant-hybrid-rrf+rerank-bge-m3';
        } catch (err) {
          logger.warn('Rerank failed, falling back to hybrid order', {
            operation: 'rag-search:rerank-fallback',
            _error: err instanceof Error ? err.message : String(err),
          });
          if (results.length > topK) results = results.slice(0, topK);
        }
      } else if (results.length > topK) {
        results = results.slice(0, topK);
      }

      const semanticChunks = results.length > 0 ? this.toSemanticChunks(results) : [];
      const bestMatch = results[0];
      const averageSimilarity =
        semanticChunks.length > 0
          ? semanticChunks.reduce((sum, c) => sum + c.score, 0) / semanticChunks.length
          : 0;
      const searchTime = Date.now() - startTime;

      // RGPD article 30 — fire-and-forget audit insert. Only metadata
      // (hashed query, filters, counts, latency) hits the table; the prompt
      // never persists. Failure is logged but never breaks the response.
      if (options.auditUserId) {
        void retrievalAuditRepository.log({
          userId: options.auditUserId,
          sessionId: options.auditSessionId ?? null,
          query: options.query,
          niveau: options.niveau,
          matiere: options.matiere ?? null,
          resultsCount: semanticChunks.length,
          avgScore: averageSimilarity || null,
          durationMs: searchTime,
          strategy,
        });
      }

      if (results.length === 0) {
        return this.emptyResult(searchTime);
      }

      const context = this.buildContext(results);

      logger.info('RAG search completed', {
        operation: 'rag-search',
        query: options.query.substring(0, 50),
        niveau: options.niveau,
        matiere: options.matiere,
        resultsCount: semanticChunks.length,
        avgScore: averageSimilarity.toFixed(3),
        topScore: bestMatch?.score.toFixed(3) ?? 'N/A',
        searchTime,
      });

      return {
        context,
        strategy,
        semanticChunks,
        microChunks: [],
        averageSimilarity,
        searchTime,
        bestMatchSection: bestMatch?.section,
        bestMatchMatiere: bestMatch?.matiere,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('RAG search failed', {
        operation: 'rag-search',
        _error: errorMessage,
        query: options.query.substring(0, 50),
        niveau: options.niveau,
        matiere: options.matiere,
        severity: 'high' as const,
      });

      throw error;
    }
  }

  /**
   * Alias pour compatibilité
   */
  async simpleSearch(options: HybridSearchOptions): Promise<HybridSearchResult> {
    return this.hybridSearch(options);
  }

  /**
   * Vérifie si le service RAG est disponible
   * Résultat mis en cache 30s pour éviter des appels répétés à Qdrant + Mistral
   * sur le chemin chaud (tool-executor → isAvailable → hybridSearch → isAvailable).
   */
  async isAvailable(): Promise<boolean> {
    const now = Date.now();
    if (this.availabilityCache && this.availabilityCache.expiresAt > now) {
      return this.availabilityCache.value;
    }
    try {
      const [qdrantOk, aiOk] = await Promise.all([
        qdrantService.isAvailable(),
        aiServiceClient.isAvailable(),
      ]);
      const available = qdrantOk && aiOk;
      this.availabilityCache = { value: available, expiresAt: now + AVAILABILITY_CACHE_TTL_MS };
      return available;
    } catch {
      this.availabilityCache = { value: false, expiresAt: now + AVAILABILITY_CACHE_TTL_MS };
      return false;
    }
  }

  /**
   * Invalide le cache d'availability. Utile pour les tests ou après reconfiguration.
   */
  invalidateAvailabilityCache(): void {
    this.availabilityCache = null;
  }

  /**
   * Retourne les thresholds
   */
  getThresholds() {
    return RAG_THRESHOLDS;
  }

  // ===========================================================================
  // Private helpers
  // ===========================================================================

  private emptyResult(searchTime: number = 0): HybridSearchResult {
    return {
      context: '',
      strategy: 'disabled',
      semanticChunks: [],
      microChunks: [],
      averageSimilarity: 0,
      searchTime,
    };
  }

  private toSemanticChunks(results: QdrantSearchResult[]): SemanticChunk[] {
    return results.map((r) => ({
      id: r.id,
      score: r.score,
      text: r.text,
      section: r.section,
      matiere: r.matiere,
      niveau: r.niveau,
    }));
  }

  private buildContext(results: QdrantSearchResult[]): string {
    if (results.length === 0) return '';

    const contextParts = results.map((result, index) => {
      const scorePercent = (result.score * 100).toFixed(0);
      return `[${index + 1}] ${result.section} (${result.niveau} - ${result.matiere}) [${scorePercent}%]
${result.text}`;
    });

    return `📚 PROGRAMMES OFFICIELS

${contextParts.join('\n\n---\n\n')}

⚠️ Utilise UNIQUEMENT ces informations officielles pour répondre.`;
  }
}

// Singleton
export const ragService = new RAGService();

// Alias pour compatibilité
export const ragSemanticService = ragService;
