/**
 * RAG Service - Interface unifiée pour la recherche sémantique
 *
 * Utilise Qdrant Cloud avec:
 * - Hybrid Search (Dense + Sparse + RRF)
 * - Reranking (Gemini Flash)
 * - HyDE (Query Expansion)
 *
 * Compatible avec l'ancienne interface ragSemanticService
 */

import { denseSearch, isQdrantRAGEnabled } from './qdrant/index.js';
import { logger } from '../lib/observability.js';
import type { EducationLevelType } from '../types/index.js';

// Thresholds cohérents pour cosine similarity (0-1)
const RAG_THRESHOLDS = {
  /** Score minimum pour inclure un résultat */
  MIN_SCORE: 0.35,
  /** Score pour considérer la recherche comme "bonne" */
  GOOD_SCORE: 0.5,
  /** Score pour considérer un résultat comme "excellent" */
  EXCELLENT_SCORE: 0.7,
} as const;

/**
 * Options de recherche hybride
 */
export interface HybridSearchOptions {
  query: string;
  niveau: EducationLevelType;
  matiere: string;
  competence?: string | null;
  limit?: number;
  minSimilarity?: number;
}

/**
 * Chunk sémantique enrichi avec métadonnées RAG
 */
export interface SemanticChunk {
  id: string;
  score: number;
  content: string;
  /** Titre officiel du programme (ex: "Les fractions") */
  title: string;
  /** Domaine du programme (ex: "Nombres et Calculs") */
  domaine?: string;
  /** Sous-domaine optionnel */
  sousdomaine?: string;
}

/**
 * Résultat de recherche hybride (compatible avec ancienne interface)
 */
export interface HybridSearchResult {
  context: string;
  strategy: string;
  semanticChunks: SemanticChunk[];
  microChunks: Array<{ id: string; score: number; content: string }>;
  averageSimilarity: number;
  searchTime: number;
  /** Titre du meilleur résultat RAG (pour nommer les decks) */
  bestMatchTitle?: string;
  /** Domaine du meilleur résultat RAG */
  bestMatchDomaine?: string;
}

/**
 * Service RAG unifié - Architecture simplifiée 2025
 *
 * Utilise UNIQUEMENT la recherche dense (cosine similarity 0-1)
 * - Pas de sparse vectors (bug vocabulaire dynamique)
 * - Pas de RRF fusion (échelle de scores incompatible)
 * - Pas de reranking (latence inutile, embeddings Gemini suffisants)
 *
 * Scalable: fonctionne pour tous niveaux dès que les données sont ingérées
 */
class RAGService {
  /**
   * Recherche sémantique dense (cosine similarity 0-1)
   *
   * @returns Résultats avec scores normalisés et contexte formaté
   */
  async hybridSearch(options: HybridSearchOptions): Promise<HybridSearchResult> {
    const startTime = Date.now();

    // Vérifier si Qdrant est configuré
    if (!isQdrantRAGEnabled()) {
      logger.warn('Qdrant RAG not configured, returning empty context', {
        operation: 'rag-dense-search'
      });

      return {
        context: '',
        strategy: 'disabled',
        semanticChunks: [],
        microChunks: [],
        averageSimilarity: 0,
        searchTime: 0
      };
    }

    try {
      // Dense search directe - Cosine similarity 0-1
      const results = await denseSearch({
        query: options.query,
        niveau: options.niveau,
        matiere: options.matiere,
        limit: options.limit ?? 5,
        minScore: RAG_THRESHOLDS.MIN_SCORE,
      });

      // Convertir au format compatible avec métadonnées RAG
      const semanticChunks = results.map((r) => ({
        id: r.id,
        score: r.score,
        content: r.payload.content,
        title: r.payload.title,
        domaine: r.payload.domaine,
        sousdomaine: r.payload.sousdomaine,
      }));

      // Extraire le meilleur match (premier résultat = score le plus élevé)
      const bestMatch = results[0];
      const bestMatchTitle = bestMatch?.payload.title;
      const bestMatchDomaine = bestMatch?.payload.domaine;

      // Calculer la similarité moyenne
      const averageSimilarity =
        semanticChunks.length > 0
          ? semanticChunks.reduce((sum, c) => sum + c.score, 0) / semanticChunks.length
          : 0;

      // Construire le contexte formaté
      const context = this.buildContext(results);

      const searchTime = Date.now() - startTime;

      logger.info('RAG dense search completed', {
        query: options.query.substring(0, 50),
        niveau: options.niveau,
        matiere: options.matiere,
        resultsCount: results.length,
        avgScore: averageSimilarity.toFixed(3),
        topScore: results[0]?.score.toFixed(3) ?? 'N/A',
        searchTime,
        operation: 'rag-dense-search'
      });

      return {
        context,
        strategy: 'dense',
        semanticChunks,
        microChunks: [],
        averageSimilarity,
        searchTime,
        bestMatchTitle,
        bestMatchDomaine,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('RAG search failed', {
        _error: errorMessage,
        query: options.query.substring(0, 50),
        niveau: options.niveau,
        matiere: options.matiere,
        operation: 'rag-dense-search',
        severity: 'high' as const
      });

      throw error;
    }
  }

  /**
   * Construit le contexte formaté pour Gemini
   */
  private buildContext(results: Array<{ id: string; score: number; payload: { title: string; content: string; niveau: string; matiere: string } }>): string {
    if (results.length === 0) {
      return '';
    }

    const contextParts = results.map((result, index) => {
      const { payload, score } = result;
      const scorePercent = (score * 100).toFixed(0);

      return `[${index + 1}] ${payload.title} (${payload.niveau} - ${payload.matiere}) [${scorePercent}%]
${payload.content}`;
    });

    return `📚 PROGRAMMES OFFICIELS\n\n${contextParts.join('\n\n---\n\n')}

⚠️ Utilise UNIQUEMENT ces informations officielles pour répondre.`;
  }

  /**
   * Recherche simple - alias vers hybridSearch (même implémentation dense)
   */
  async simpleSearch(options: HybridSearchOptions): Promise<HybridSearchResult> {
    return this.hybridSearch(options);
  }

  /**
   * Vérifie si le service RAG est disponible
   */
  isAvailable(): boolean {
    return isQdrantRAGEnabled();
  }

  /**
   * Retourne les thresholds pour usage externe (validation)
   */
  getThresholds() {
    return RAG_THRESHOLDS;
  }
}

// Instance singleton
export const ragService = new RAGService();

// Alias pour compatibilité avec l'ancien code
export const ragSemanticService = ragService;
