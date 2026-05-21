import { QdrantClient } from '@qdrant/js-client-rest';
import { logger } from '../lib/observability.js';
import { withDbSpan } from '../lib/otel/index.js';
import { cacheService } from './memory-cache.service.js';
import { QdrantHierarchyService } from './qdrant-hierarchy.service.js';
import type { ChaptersHierarchy, EducationLevelType } from '../types/index.js';

const QDRANT_URL = Bun.env['QDRANT_URL'] ?? '';
const QDRANT_API_KEY = Bun.env['QDRANT_API_KEY'] ?? '';
const COLLECTION_NAME =
  Bun.env['QDRANT_COLLECTION'] ?? Bun.env['QDRANT_COLLECTION_NAME'] ?? 'tomai_educational';

const CACHE_TTL = { DEFAULT: 3600, MEMORY_CHECK: 60_000 } as const;
const CACHE_PREFIX = 'qdrant:' as const;

export interface QdrantSearchResult {
  id: string;
  score: number;
  // Payload canonique tomai-curriculum (ADR-0007). Aliases title/content
  // retirés en Phase 2A — on lit le schema source de vérité directement.
  text: string;
  section: string;
  matiere: string;
  niveau: string;
  cycle: string;
  source_file: string;
  chunk_index: number;
}

export interface QdrantFilter {
  niveau?: string;
  matiere?: string;
  cycle?: string;
}

export interface QdrantSearchOptions {
  scoreThreshold?: number;
  hnswEf?: number;
}

/** Sparse vector representation for Qdrant hybrid search (BM25 IDF native). */
export interface SparseVector {
  indices: number[];
  values: number[];
}

export interface CollectionStats {
  total_points: number;
  by_niveau: Record<string, number>;
  by_matiere: Record<string, number>;
}

class QdrantService {
  private client: QdrantClient | null = null;
  private statsCache: { data: CollectionStats; timestamp: number } | null = null;
  private readonly hierarchy: QdrantHierarchyService;

  constructor() {
    this.hierarchy = new QdrantHierarchyService(
      () => this.getClient(),
      COLLECTION_NAME
    );
  }

  private getClient(): QdrantClient {
    if (!this.client) {
      if (!QDRANT_URL || !QDRANT_API_KEY) {
        throw new Error('QDRANT_URL and QDRANT_API_KEY are required');
      }
      this.client = new QdrantClient({ url: QDRANT_URL, apiKey: QDRANT_API_KEY });
      logger.info('Qdrant client initialized', {
        operation: 'qdrant:init',
        url: QDRANT_URL.substring(0, 30) + '...',
        collection: COLLECTION_NAME,
      });
    }
    return this.client;
  }

  async search(
    queryVector: number[],
    filter?: QdrantFilter,
    limit: number = 20,
    options?: QdrantSearchOptions
  ): Promise<QdrantSearchResult[]> {
    const client = this.getClient();
    const startTime = Date.now();

    return withDbSpan(
      { system: 'qdrant', operation: 'search', collection: COLLECTION_NAME },
      async (recordRows) => {
        const must = this.buildMustFilter(filter);

        const response = await client.query(COLLECTION_NAME, {
          query: queryVector,
          limit,
          filter: must.length > 0 ? { must } : undefined,
          with_payload: true,
          score_threshold: options?.scoreThreshold,
          params: options?.hnswEf ? { hnsw_ef: options.hnswEf } : undefined,
        });

        const results = this.mapPointsToResults(response.points);
        recordRows(results.length);

        logger.info('Qdrant search completed', {
          operation: 'qdrant:search',
          resultsCount: results.length,
          durationMs: Date.now() - startTime,
        });

        return results;
      },
    );
  }

  /**
   * Hybrid search via Qdrant Query API : prefetch dense + sparse, fusion RRF native.
   *
   * Pré-requis collection : doit avoir vectors_config={dense, ...} et
   * sparse_vectors_config={bm25: SparseVectorParams(modifier=IDF)}. Voir
   * tomai-curriculum/scripts/migrate_collection.py.
   *
   * Source : https://qdrant.tech/articles/sparse-vectors
   */
  async searchHybrid(
    queryDense: number[],
    querySparse: SparseVector,
    filter?: QdrantFilter,
    limit: number = 10,
    options?: QdrantSearchOptions
  ): Promise<QdrantSearchResult[]> {
    const client = this.getClient();
    const startTime = Date.now();

    return withDbSpan(
      { system: 'qdrant', operation: 'search_hybrid', collection: COLLECTION_NAME },
      async (recordRows) => {
        const must = this.buildMustFilter(filter);
        const prefetchLimit = Math.max(limit * 4, 20);

        const response = await client.query(COLLECTION_NAME, {
          prefetch: [
            { query: queryDense, using: 'dense', limit: prefetchLimit },
            { query: querySparse, using: 'bm25', limit: prefetchLimit },
          ],
          query: { fusion: 'rrf' },
          limit,
          filter: must.length > 0 ? { must } : undefined,
          with_payload: true,
          score_threshold: options?.scoreThreshold,
          params: options?.hnswEf ? { hnsw_ef: options.hnswEf } : undefined,
        });

        const results = this.mapPointsToResults(response.points);
        recordRows(results.length);

        logger.info('Qdrant hybrid search completed', {
          operation: 'qdrant:search:hybrid',
          resultsCount: results.length,
          prefetchLimit,
          durationMs: Date.now() - startTime,
        });

        return results;
      },
    );
  }

  private buildMustFilter(filter?: QdrantFilter): Array<{ key: string; match: { value: string } }> {
    const must: Array<{ key: string; match: { value: string } }> = [];
    if (filter?.niveau) must.push({ key: 'niveau', match: { value: filter.niveau } });
    if (filter?.matiere) must.push({ key: 'matiere', match: { value: filter.matiere } });
    if (filter?.cycle) must.push({ key: 'cycle', match: { value: filter.cycle } });
    return must;
  }

  private mapPointsToResults(
    points: ReadonlyArray<{ id: string | number; score?: number; payload?: unknown }>,
  ): QdrantSearchResult[] {
    return points.map((point) => {
      const p = (point.payload ?? {}) as Record<string, unknown>;
      return {
        id: String(point.id),
        score: point.score ?? 0,
        // Payload canonique curriculum (schema/document.py:Chunk.to_qdrant_payload)
        text: String(p['text'] ?? ''),
        section: String(p['section'] ?? ''),
        matiere: String(p['matiere'] ?? ''),
        niveau: String(p['niveau'] ?? ''),
        cycle: String(p['cycle'] ?? ''),
        source_file: String(p['source_file'] ?? ''),
        chunk_index: typeof p['chunk_index'] === 'number' ? p['chunk_index'] : 0,
      };
    });
  }

  async getStats(): Promise<CollectionStats> {
    const cacheKey = 'stats:collection';

    if (this.statsCache && Date.now() - this.statsCache.timestamp < CACHE_TTL.MEMORY_CHECK) {
      return this.statsCache.data;
    }

    const cached = cacheService.get<CollectionStats>(CACHE_PREFIX, cacheKey);
    if (cached) {
      this.statsCache = { data: cached, timestamp: Date.now() };
      return cached;
    }

    const client = this.getClient();
    const collectionInfo = await client.getCollection(COLLECTION_NAME);
    const total_points = collectionInfo.points_count ?? 0;

    const niveaux = [
      'cp', 'ce1', 'ce2', 'cm1', 'cm2',
      'sixieme', 'cinquieme', 'quatrieme', 'troisieme',
      'seconde', 'premiere', 'terminale',
    ];
    // Parallel fan-out (previously 12 sequential HTTP calls to Qdrant Cloud on cache-miss).
    const [niveauResults, by_matiere] = await Promise.all([
      Promise.all(
        niveaux.map(niveau =>
          client.count(COLLECTION_NAME, {
            filter: { must: [{ key: 'niveau', match: { value: niveau } }] },
          }).then(count => [niveau, count.count] as const)
        ),
      ),
      this.getUniqueMatieres(),
    ]);
    const by_niveau: Record<string, number> = {};
    for (const [niveau, count] of niveauResults) {
      if (count > 0) by_niveau[niveau] = count;
    }
    const stats: CollectionStats = { total_points, by_niveau, by_matiere };

    this.statsCache = { data: stats, timestamp: Date.now() };
    cacheService.set(CACHE_PREFIX, cacheKey, stats, CACHE_TTL.DEFAULT);

    logger.info('Qdrant stats retrieved', {
      operation: 'qdrant:stats',
      total_points,
      niveaux: Object.keys(by_niveau).length,
      matieres: Object.keys(by_matiere).length,
    });

    return stats;
  }

  private async getUniqueMatieres(): Promise<Record<string, number>> {
    const client = this.getClient();
    const by_matiere: Record<string, number> = {};
    const seenMatieres = new Set<string>();

    let offset: Awaited<ReturnType<typeof client.scroll>>['next_page_offset'] = undefined;
    for (let i = 0; i < 10; i++) {
      const response = await client.scroll(COLLECTION_NAME, {
        limit: 100, offset, with_payload: ['matiere'],
      });
      for (const point of response.points) {
        const matiere = (point.payload as Record<string, unknown>)['matiere'];
        if (matiere && typeof matiere === 'string') seenMatieres.add(matiere);
      }
      offset = response.next_page_offset;
      if (!offset) break;
    }

    // Parallel count per matière instead of sequential HTTP roundtrips.
    const matiereResults = await Promise.all(
      Array.from(seenMatieres).map(matiere =>
        client.count(COLLECTION_NAME, {
          filter: { must: [{ key: 'matiere', match: { value: matiere } }] },
        }).then(count => [matiere, count.count] as const)
      ),
    );
    for (const [matiere, count] of matiereResults) {
      if (count > 0) by_matiere[matiere] = count;
    }

    return by_matiere;
  }

  // Delegated hierarchy methods
  async getMatieresForNiveau(niveau: string) {
    return this.hierarchy.getMatieresForNiveau(niveau);
  }

  async getTopics(matiere: string, niveau: string) {
    return this.hierarchy.getTopics(matiere, niveau);
  }

  async getChaptersHierarchy(matiere: string, niveau: EducationLevelType, matiereLabel: string): Promise<ChaptersHierarchy> {
    return this.hierarchy.getChaptersHierarchy(matiere, niveau, matiereLabel);
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.getClient().getCollection(COLLECTION_NAME);
      return true;
    } catch {
      return false;
    }
  }

  invalidateCache(): void {
    this.statsCache = null;
    cacheService.delete(CACHE_PREFIX, 'stats:collection');
    logger.info('Qdrant cache invalidated', { operation: 'qdrant:cache:invalidate' });
  }

  invalidateChaptersCache(): number {
    const pattern = `${CACHE_PREFIX}chapters:*`;
    const deleted = cacheService.invalidateByPattern(pattern);
    logger.info('Chapters cache invalidated', {
      operation: 'qdrant:chapters:cache:invalidate', pattern, deletedKeys: deleted
    });
    return deleted;
  }

  invalidateAllCache(): { stats: boolean; patterns: number } {
    this.statsCache = null;
    const statsDeleted = cacheService.delete(CACHE_PREFIX, 'stats:collection');
    const patternsDeleted = cacheService.invalidateByPattern(`${CACHE_PREFIX}*`);

    logger.info('All Qdrant cache invalidated', {
      operation: 'qdrant:cache:invalidate:all', statsDeleted, patternsDeleted
    });

    return { stats: statsDeleted, patterns: patternsDeleted };
  }
}

export const qdrantService = new QdrantService();
