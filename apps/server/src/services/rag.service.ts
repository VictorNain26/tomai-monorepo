/**
 * RAG Service - Interface unifiée pour la recherche sémantique
 *
 * Architecture simplifiée 2025:
 * - Appelle Qdrant Cloud directement (pas de service intermédiaire)
 * - Génère les embeddings avec Mistral directement
 * - Reranking BM25+RRF côté serveur
 */

import { qdrantService } from './qdrant.service.js';
import { mistralEmbeddingsService } from './mistral-embeddings.service.js';
import { rerankWithBm25Rrf, type RerankedResult } from './rerank.service.js';
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
  matiere: string;
  competence?: string | null;
  limit?: number;
  minSimilarity?: number;
}

export interface SemanticChunk {
  id: string;
  score: number;
  content: string;
  title: string;
  domaine?: string;
  sousdomaine?: string;
}

export interface HybridSearchResult {
  context: string;
  strategy: string;
  semanticChunks: SemanticChunk[];
  microChunks: Array<{ id: string; score: number; content: string }>;
  averageSimilarity: number;
  searchTime: number;
  bestMatchTitle?: string;
  bestMatchDomaine?: string;
}

// =============================================================================
// Service
// =============================================================================

class RAGService {
  /**
   * Recherche sémantique avec reranking BM25+RRF
   */
  async hybridSearch(options: HybridSearchOptions): Promise<HybridSearchResult> {
    const startTime = Date.now();

    // Vérifier disponibilité
    const available = await this.isAvailable();
    if (!available) {
      logger.warn('RAG service not available', { operation: 'rag-search' });
      return this.emptyResult();
    }

    try {
      // 1. Générer l'embedding de la query
      const queryVector = await mistralEmbeddingsService.embed(options.query);

      // 2. Recherche vectorielle (top-20 pour reranking)
      const initialLimit = 20;
      const minScore = options.minSimilarity ?? RAG_THRESHOLDS.MIN_SCORE;
      const rawResults = await qdrantService.search(
        queryVector,
        { niveau: options.niveau, matiere: options.matiere },
        initialLimit,
        { scoreThreshold: minScore, hnswEf: 128 }
      );

      if (rawResults.length === 0) {
        return this.emptyResult(Date.now() - startTime);
      }

      // 3. Reranking BM25 + RRF
      const topK = options.limit ?? 5;
      const rerankedResults = rerankWithBm25Rrf(options.query, rawResults, topK);

      // 4. Résultats (déjà filtrés côté serveur par score_threshold)
      const filteredResults = rerankedResults;

      // 5. Convertir au format interne
      const semanticChunks = this.toSemanticChunks(filteredResults);

      // 6. Extraire le meilleur match
      const bestMatch = filteredResults[0];

      // 7. Calculer la similarité moyenne
      const averageSimilarity =
        semanticChunks.length > 0
          ? semanticChunks.reduce((sum, c) => sum + c.score, 0) / semanticChunks.length
          : 0;

      // 8. Construire le contexte formaté
      const context = this.buildContext(filteredResults);

      const searchTime = Date.now() - startTime;

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
        strategy: 'direct-rrf',
        semanticChunks,
        microChunks: [],
        averageSimilarity,
        searchTime,
        bestMatchTitle: bestMatch?.title,
        bestMatchDomaine: bestMatch?.domaine,
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
   */
  async isAvailable(): Promise<boolean> {
    try {
      const [qdrantOk, mistralOk] = await Promise.all([
        qdrantService.isAvailable(),
        mistralEmbeddingsService.isAvailable(),
      ]);
      return qdrantOk && mistralOk;
    } catch {
      return false;
    }
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

  private toSemanticChunks(results: RerankedResult[]): SemanticChunk[] {
    return results.map((r) => ({
      id: r.id,
      score: r.score,
      content: r.content,
      title: r.title,
      domaine: r.domaine,
      sousdomaine: r.sousdomaine,
    }));
  }

  private buildContext(results: RerankedResult[]): string {
    if (results.length === 0) return '';

    const contextParts = results.map((result, index) => {
      const scorePercent = (result.score * 100).toFixed(0);
      return `[${index + 1}] ${result.title} (${result.niveau} - ${result.matiere}) [${scorePercent}%]
${result.content}`;
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
