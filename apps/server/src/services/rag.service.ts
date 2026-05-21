/**
 * RAG Service - Recherche sémantique hybride Qdrant native.
 *
 * Architecture mai 2026 (sous-projet E du chantier RAG overhaul) :
 * - Appel direct Qdrant Cloud via Query API hybrid (dense + sparse BM25 IDF)
 * - Fusion RRF côté Qdrant (pas de BM25 manuel server, pas de Cohere)
 * - Embeddings query via Mistral (souveraineté EU)
 *
 * Pré-requis collection Qdrant : doit avoir `sparse_vectors_config.bm25`
 * configuré avec Modifier.IDF (voir tomai-curriculum/scripts/migrate_collection.py).
 *
 * Sources :
 * - https://qdrant.tech/articles/sparse-vectors (hybrid search natif)
 * - https://qdrant.tech/articles/bm42 (Modifier.IDF côté Qdrant)
 */

import { qdrantService, type QdrantSearchResult, type SparseVector } from './qdrant.service.js';
import { mistralEmbeddingsService } from './mistral-embeddings.service.js';
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
      const queryDense = await mistralEmbeddingsService.embed(options.query);
      const querySparse = this.toSparseVector(options.query);

      const topK = options.limit ?? 5;
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
      const results = await qdrantService.searchHybrid(
        queryDense,
        querySparse,
        { niveau: options.niveau, matiere: options.matiere },
        topK,
        { hnswEf: 128 },
      );

      const semanticChunks = results.length > 0 ? this.toSemanticChunks(results) : [];
      const bestMatch = results[0];
      const averageSimilarity =
        semanticChunks.length > 0
          ? semanticChunks.reduce((sum, c) => sum + c.score, 0) / semanticChunks.length
          : 0;
      const searchTime = Date.now() - startTime;
      const strategy = 'qdrant-hybrid-rrf';

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
   * Tokenise une query française pour Qdrant Modifier.IDF.
   * Qdrant calcule l'IDF côté server à partir des indices + values fournis.
   */
  private toSparseVector(query: string): SparseVector {
    const tokens = query.toLowerCase().match(/[a-zàâäéèêëïîôùûüÿœæç0-9]+/g) ?? [];
    const counts = new Map<number, number>();
    for (const token of tokens) {
      const idx = this.hashToken(token);
      counts.set(idx, (counts.get(idx) ?? 0) + 1);
    }
    return {
      indices: Array.from(counts.keys()),
      values: Array.from(counts.values()),
    };
  }

  /** Hash 32-bit positif stable d'un token (FNV-1a). */
  private hashToken(token: string): number {
    let h = 2166136261;
    for (let i = 0; i < token.length; i++) {
      h = (h ^ token.charCodeAt(i)) >>> 0;
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h & 0x7fffffff;
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
      const [qdrantOk, mistralOk] = await Promise.all([
        qdrantService.isAvailable(),
        mistralEmbeddingsService.isAvailable(),
      ]);
      const available = qdrantOk && mistralOk;
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
