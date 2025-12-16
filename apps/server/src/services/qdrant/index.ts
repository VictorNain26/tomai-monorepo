/**
 * Qdrant RAG Services - Export centralisé
 *
 * Architecture simplifiée 2025:
 * - Dense Search (Mistral embeddings 1024D + Cosine similarity)
 * - Filtrage par niveau/matière
 * - Ingestion avec chunking optimisé
 */

// Configuration
export { QDRANT_CONFIG } from './config.js';

// Types
export type {
  EducationalPayload,
  QdrantSearchResult,
  HybridSearchOptions,
  SearchResponse,
  CollectionConfig,
  CollectionStats,
  DocumentToIndex,
} from './types.js';

// Client Qdrant
export {
  getQdrantClient,
  checkQdrantHealth,
  createCollection,
  getCollectionStats,
  deleteCollection,
  upsertPoints,
  deletePoints,
  getPoint,
  countPoints,
} from './qdrant-client.service.js';

// Search (dense uniquement)
export { denseSearch } from './hybrid-search.service.js';

// Vérification disponibilité RAG
export { isQdrantRAGEnabled } from './rag-utils.js';

// Topics (liste des thèmes/domaines pour sélection guidée)
export {
  getTopicsFromRAG,
  getAvailableSubjectsForLevel,
} from './topics.service.js';
export type {
  DomainWithTopics,
  TopicsResult,
  GetTopicsOptions,
} from './topics.service.js';

// Curriculum (configuration programmes scolaires)
export * from './curriculum/index.js';

// Ingestion (pipeline d'indexation)
export {
  chunkDocument,
  chunkDocuments,
  chunksToIndexableDocuments,
  generateDocumentId,
} from './ingestion/chunking.service.js';
export {
  runIngestionPipeline,
  reindexDocument,
  getIngestionStats,
} from './ingestion/ingestion-pipeline.service.js';
export type {
  IngestionPipelineOptions,
  IngestionPipelineResult,
} from './ingestion/ingestion-pipeline.service.js';
