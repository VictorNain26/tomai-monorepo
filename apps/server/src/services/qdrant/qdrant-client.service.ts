/**
 * QdrantClientService - Client Qdrant Cloud pour TomAI
 *
 * Fonctionnalités:
 * - Connection pooling avec retry automatique
 * - Création de collection avec vectors dense + sparse
 * - Upsert de points avec embeddings
 * - Health check
 *
 * @see https://github.com/qdrant/qdrant-js
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { QDRANT_CONFIG } from './config.js';
import type { CollectionConfig, CollectionStats, DocumentToIndex, EducationalPayload } from './types.js';
import { logger } from '../../lib/observability.js';

/**
 * Singleton client Qdrant
 */
let qdrantClient: QdrantClient | null = null;

/**
 * Initialise le client Qdrant
 */
export function getQdrantClient(): QdrantClient {
  if (!qdrantClient) {
    const { url, apiKey, timeout } = QDRANT_CONFIG.connection;

    if (!url || !apiKey) {
      throw new Error('QDRANT_URL and QDRANT_API_KEY are required');
    }

    qdrantClient = new QdrantClient({
      url,
      apiKey,
      timeout,
    });

    logger.info(`[Qdrant] Client initialized for ${url}`, { operation: 'qdrant:client:init', url });
  }

  return qdrantClient;
}

/**
 * Vérifie la connexion Qdrant
 */
export async function checkQdrantHealth(): Promise<boolean> {
  try {
    const client = getQdrantClient();
    const result = await client.getCollections();
    logger.info(`[Qdrant] Health check OK - ${result.collections.length} collections`, { operation: 'qdrant:health:ok', collectionsCount: result.collections.length });
    return true;
  } catch (error) {
    logger.error('[Qdrant] Health check failed', { operation: 'qdrant:health:fail', _error: error instanceof Error ? error.message : String(error), severity: 'high' as const });
    return false;
  }
}

/**
 * Crée la collection avec configuration hybrid search
 */
export async function createCollection(config?: Partial<CollectionConfig>): Promise<void> {
  const client = getQdrantClient();
  const collectionName = config?.name ?? QDRANT_CONFIG.collection.name;

  // Vérifier si la collection existe déjà
  try {
    const collections = await client.getCollections();
    const exists = collections.collections.some((c) => c.name === collectionName);

    if (exists) {
      logger.info(`[Qdrant] Collection "${collectionName}" already exists`, { operation: 'qdrant:collection:exists', collectionName });
      return;
    }
  } catch (error) {
    logger.error('[Qdrant] Error checking collections', { operation: 'qdrant:collection:check', _error: error instanceof Error ? error.message : String(error), severity: 'medium' as const });
  }

  // Créer la collection avec vectors dense + sparse
  await client.createCollection(collectionName, {
    vectors: {
      [QDRANT_CONFIG.collection.denseVector.name]: {
        size: config?.denseVectorSize ?? QDRANT_CONFIG.collection.denseVector.size,
        distance: config?.denseDistance ?? QDRANT_CONFIG.collection.denseVector.distance,
      },
    },
    sparse_vectors: {
      [QDRANT_CONFIG.collection.sparseVector.name]: {
        modifier: QDRANT_CONFIG.collection.sparseVector.enableIDF ? 'idf' : undefined,
      },
    },
    // Optimizations
    optimizers_config: {
      indexing_threshold: 20000, // Index après 20k points
    },
    // HNSW configuration pour dense vectors
    hnsw_config: {
      m: 16, // Nombre de connexions par layer
      ef_construct: 100, // Construction quality
    },
  });

  // Créer les index pour les filtres (tous les champs utilisés pour filtrage)
  const indexFields = ['niveau', 'matiere', 'cycle', 'domaine', 'sousdomaine', 'contentType', 'documentId'];

  for (const field of indexFields) {
    await client.createPayloadIndex(collectionName, {
      field_name: field,
      field_schema: 'keyword',
    });
  }

  logger.info(`[Qdrant] Collection "${collectionName}" created with hybrid vectors and ${indexFields.length} payload indexes`, { operation: 'qdrant:collection:create', collectionName, indexFieldsCount: indexFields.length });
}

/**
 * Récupère les statistiques de la collection
 */
export async function getCollectionStats(): Promise<CollectionStats | null> {
  try {
    const client = getQdrantClient();
    const info = await client.getCollection(QDRANT_CONFIG.collection.name);

    return {
      pointsCount: info.points_count ?? 0,
      segmentsCount: info.segments_count ?? 0,
      status: info.status as 'green' | 'yellow' | 'red',
      vectorsCount: {
        dense: info.indexed_vectors_count ?? info.points_count ?? 0,
        sparse: info.indexed_vectors_count ?? info.points_count ?? 0,
      },
    };
  } catch (error) {
    logger.error('[Qdrant] Error getting collection stats', { operation: 'qdrant:stats:get', _error: error instanceof Error ? error.message : String(error), severity: 'medium' as const });
    return null;
  }
}

/**
 * Supprime la collection
 */
export async function deleteCollection(collectionName?: string): Promise<void> {
  const client = getQdrantClient();
  const name = collectionName ?? QDRANT_CONFIG.collection.name;

  await client.deleteCollection(name);
  logger.info(`[Qdrant] Collection "${name}" deleted`, { operation: 'qdrant:collection:delete', collectionName: name });
}

/**
 * Upsert un batch de points avec vectors dense uniquement
 */
export async function upsertPoints(
  documents: DocumentToIndex[],
  denseVectors: number[][]
): Promise<void> {
  const client = getQdrantClient();

  const points = documents.map((doc, index) => ({
    id: doc.id,
    vector: {
      [QDRANT_CONFIG.collection.denseVector.name]: denseVectors[index]!,
    },
    payload: {
      ...doc.payload,
      content: doc.content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } satisfies EducationalPayload,
  }));

  try {
    await client.upsert(QDRANT_CONFIG.collection.name, {
      points,
      wait: true,
    });
    logger.info(`[Qdrant] Upserted ${points.length} points`, { operation: 'qdrant:upsert:success', pointsCount: points.length });
  } catch (error) {
    logger.error('[Qdrant] Upsert error details', { operation: 'qdrant:upsert:fail', _error: error instanceof Error ? error.message : String(error), pointsCount: points.length, severity: 'high' as const });
    throw error;
  }
}

/**
 * Supprime des points par IDs
 */
export async function deletePoints(ids: string[]): Promise<void> {
  const client = getQdrantClient();

  await client.delete(QDRANT_CONFIG.collection.name, {
    points: ids,
    wait: true,
  });

  logger.info(`[Qdrant] Deleted ${ids.length} points`, { operation: 'qdrant:delete:success', pointsCount: ids.length });
}

/**
 * Récupère un point par ID
 */
export async function getPoint(id: string): Promise<EducationalPayload | null> {
  try {
    const client = getQdrantClient();

    const result = await client.retrieve(QDRANT_CONFIG.collection.name, {
      ids: [id],
      with_payload: true,
    });

    if (result.length === 0) {
      return null;
    }

    return (result[0]!.payload ?? {}) as unknown as EducationalPayload;
  } catch (error) {
    logger.error('[Qdrant] Error getting point', { operation: 'qdrant:point:get', _error: error instanceof Error ? error.message : String(error), pointId: id, severity: 'medium' as const });
    return null;
  }
}

/**
 * Compte les points dans la collection
 */
export async function countPoints(): Promise<number> {
  try {
    const client = getQdrantClient();
    const result = await client.count(QDRANT_CONFIG.collection.name);
    return result.count;
  } catch (error) {
    logger.error('[Qdrant] Error counting points', { operation: 'qdrant:count:fail', _error: error instanceof Error ? error.message : String(error), severity: 'medium' as const });
    return 0;
  }
}
