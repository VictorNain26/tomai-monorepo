/**
 * Types pour le système RAG Qdrant
 * Architecture moderne 2025 avec Hybrid Search + Reranking
 */

import type { EducationLevelType } from '../../types/index.js';

/**
 * Point Qdrant avec payload éducatif
 */
export interface EducationalPayload {
  // Identifiants
  documentId?: string;
  chunkId?: string;

  // Contenu
  content: string;
  title: string;

  // Métadonnées éducatives
  niveau: EducationLevelType;
  matiere: string;
  cycle: string;

  // Métadonnées document - domaine/section
  domaine?: string;
  sousdomaine?: string;
  section?: string;
  sourceType?: 'programme_officiel' | 'manuel' | 'exercice' | 'cours';
  source?: string;
  sourceUrl?: string;
  competences?: string[];
  notions?: string[];

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

/**
 * Résultat de recherche Qdrant
 */
export interface QdrantSearchResult {
  id: string;
  score: number;
  payload: EducationalPayload;
  // Score après reranking (si applicable)
  rerankScore?: number;
}

/**
 * Options de recherche hybride
 */
export interface HybridSearchOptions {
  query: string;
  niveau?: EducationLevelType;
  matiere?: string;
  limit?: number;
  minScore?: number;

  // Options hybrid search
  useHybrid?: boolean;
  densePrefetchLimit?: number;
  sparsePrefetchLimit?: number;

  // Options reranking
  useReranking?: boolean;
  rerankTopK?: number;
}

/**
 * Résultat de recherche avec métadonnées
 */
export interface SearchResponse {
  results: QdrantSearchResult[];
  metadata: {
    query: string;
    totalResults: number;
    searchTimeMs: number;
    hybridUsed: boolean;
    rerankingUsed: boolean;
    hydeUsed: boolean;
  };
}

/**
 * Configuration collection Qdrant
 */
export interface CollectionConfig {
  name: string;
  denseVectorSize: number;
  denseDistance: 'Cosine' | 'Dot' | 'Euclid';
  sparseVectorName: string;
  enableBM25IDF: boolean;
}

/**
 * Document à indexer
 */
export interface DocumentToIndex {
  id: string;
  content: string;
  payload: Omit<EducationalPayload, 'createdAt' | 'updatedAt'>;
}

/**
 * Statistiques collection
 */
export interface CollectionStats {
  pointsCount: number;
  segmentsCount: number;
  status: 'green' | 'yellow' | 'red';
  vectorsCount: {
    dense: number;
    sparse: number;
  };
}
