/**
 * Qdrant Service - Client direct pour recherche vectorielle
 *
 * Architecture cache 2025:
 * - Redis cache (1h TTL) pour persistance cross-instances
 * - In-memory cache (1min) pour fast-path local
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { logger } from '../lib/observability.js';
import { redisCacheService } from './redis-cache.service.js';
import type { Chapter, SubChapter, ChaptersHierarchy, EducationLevelType } from '../types/index.js';

// =============================================================================
// Configuration
// =============================================================================

const QDRANT_URL = Bun.env['QDRANT_URL'] ?? '';
const QDRANT_API_KEY = Bun.env['QDRANT_API_KEY'] ?? '';
const COLLECTION_NAME =
  Bun.env['QDRANT_COLLECTION'] ?? Bun.env['QDRANT_COLLECTION_NAME'] ?? 'tomai_educational';

const CACHE_TTL = { REDIS: 3600, MEMORY: 60_000 } as const;
const CACHE_PREFIX = 'qdrant:' as const;

// =============================================================================
// Types
// =============================================================================

export interface QdrantSearchResult {
  id: string;
  score: number;
  title: string;
  content: string;
  matiere: string;
  niveau: string;
  domaine?: string;
  sousdomaine?: string;
  content_type?: string;
  difficulty?: string;
}

export interface QdrantFilter {
  niveau?: string;
  matiere?: string;
  difficulty?: string;
}

export interface QdrantSearchOptions {
  scoreThreshold?: number;
  hnswEf?: number;
}

export interface CollectionStats {
  total_points: number;
  by_niveau: Record<string, number>;
  by_matiere: Record<string, number>;
}

// =============================================================================
// Service
// =============================================================================

class QdrantService {
  private client: QdrantClient | null = null;
  private statsCache: { data: CollectionStats; timestamp: number } | null = null;

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

  /** Recherche vectorielle avec filtres optionnels */
  async search(
    queryVector: number[],
    filter?: QdrantFilter,
    limit: number = 20,
    options?: QdrantSearchOptions
  ): Promise<QdrantSearchResult[]> {
    const client = this.getClient();
    const startTime = Date.now();

    const must: Array<{ key: string; match: { value: string } }> = [];
    if (filter?.niveau) must.push({ key: 'niveau', match: { value: filter.niveau } });
    if (filter?.matiere) must.push({ key: 'matiere', match: { value: filter.matiere } });
    if (filter?.difficulty) must.push({ key: 'difficulty', match: { value: filter.difficulty } });

    const response = await client.query(COLLECTION_NAME, {
      query: queryVector,
      limit,
      filter: must.length > 0 ? { must } : undefined,
      with_payload: true,
      score_threshold: options?.scoreThreshold,
      params: options?.hnswEf ? { hnsw_ef: options.hnswEf } : undefined,
    });

    const results: QdrantSearchResult[] = response.points.map((point) => {
      const p = point.payload as Record<string, unknown>;
      return {
        id: String(point.id),
        score: point.score ?? 0,
        title: String(p['title'] ?? ''),
        content: String(p['content'] ?? ''),
        matiere: String(p['matiere'] ?? ''),
        niveau: String(p['niveau'] ?? ''),
        domaine: p['domaine'] ? String(p['domaine']) : undefined,
        sousdomaine: p['sousdomaine'] ? String(p['sousdomaine']) : undefined,
        content_type: p['content_type'] ? String(p['content_type']) : undefined,
        difficulty: p['difficulty'] ? String(p['difficulty']) : undefined,
      };
    });

    logger.info('Qdrant search completed', {
      operation: 'qdrant:search',
      resultsCount: results.length,
      durationMs: Date.now() - startTime,
    });

    return results;
  }

  /** Statistiques collection - Cache: Redis (1h) + in-memory (1min) */
  async getStats(): Promise<CollectionStats> {
    const cacheKey = 'stats:collection';

    // In-memory fast path
    if (this.statsCache && Date.now() - this.statsCache.timestamp < CACHE_TTL.MEMORY) {
      return this.statsCache.data;
    }

    // Redis cache
    const cached = await redisCacheService.get<CollectionStats>(CACHE_PREFIX, cacheKey);
    if (cached) {
      this.statsCache = { data: cached, timestamp: Date.now() };
      return cached;
    }

    const client = this.getClient();
    const collectionInfo = await client.getCollection(COLLECTION_NAME);
    const total_points = collectionInfo.points_count ?? 0;

    // Compter par niveau
    const niveaux = [
      'cp', 'ce1', 'ce2', 'cm1', 'cm2',
      'sixieme', 'cinquieme', 'quatrieme', 'troisieme',
      'seconde', 'premiere', 'terminale',
    ];
    const by_niveau: Record<string, number> = {};
    for (const niveau of niveaux) {
      const count = await client.count(COLLECTION_NAME, {
        filter: { must: [{ key: 'niveau', match: { value: niveau } }] },
      });
      if (count.count > 0) by_niveau[niveau] = count.count;
    }

    const by_matiere = await this.getUniqueMatieres();
    const stats: CollectionStats = { total_points, by_niveau, by_matiere };

    this.statsCache = { data: stats, timestamp: Date.now() };
    await redisCacheService.set(CACHE_PREFIX, cacheKey, stats, CACHE_TTL.REDIS);

    logger.info('Qdrant stats retrieved', {
      operation: 'qdrant:stats',
      total_points,
      niveaux: Object.keys(by_niveau).length,
      matieres: Object.keys(by_matiere).length,
    });

    return stats;
  }

  /** Récupère les matières uniques depuis Qdrant */
  private async getUniqueMatieres(): Promise<Record<string, number>> {
    const client = this.getClient();
    const by_matiere: Record<string, number> = {};
    const seenMatieres = new Set<string>();

    let offset: Awaited<ReturnType<typeof client.scroll>>['next_page_offset'] = undefined;
    for (let i = 0; i < 10; i++) {
      const response = await client.scroll(COLLECTION_NAME, {
        limit: 100,
        offset,
        with_payload: ['matiere'],
      });
      for (const point of response.points) {
        const matiere = (point.payload as Record<string, unknown>)['matiere'];
        if (matiere && typeof matiere === 'string') seenMatieres.add(matiere);
      }
      offset = response.next_page_offset;
      if (!offset) break;
    }

    for (const matiere of seenMatieres) {
      const count = await client.count(COLLECTION_NAME, {
        filter: { must: [{ key: 'matiere', match: { value: matiere } }] },
      });
      if (count.count > 0) by_matiere[matiere] = count.count;
    }

    return by_matiere;
  }

  /** Matières disponibles pour un niveau - Cache Redis 1h */
  async getMatieresForNiveau(niveau: string): Promise<Record<string, number>> {
    const cacheKey = `matieres:${niveau}`;

    const cached = await redisCacheService.get<Record<string, number>>(CACHE_PREFIX, cacheKey);
    if (cached) {
      logger.info('Matieres cache hit', { operation: 'qdrant:matieres:cache-hit', niveau });
      return cached;
    }

    const client = this.getClient();
    const by_matiere: Record<string, number> = {};
    const seenMatieres = new Set<string>();

    let offset: Awaited<ReturnType<typeof client.scroll>>['next_page_offset'] = undefined;
    for (let i = 0; i < 10; i++) {
      const response = await client.scroll(COLLECTION_NAME, {
        limit: 100,
        offset,
        filter: { must: [{ key: 'niveau', match: { value: niveau } }] },
        with_payload: ['matiere'],
      });
      for (const point of response.points) {
        const matiere = (point.payload as Record<string, unknown>)['matiere'];
        if (matiere && typeof matiere === 'string') seenMatieres.add(matiere);
      }
      offset = response.next_page_offset;
      if (!offset) break;
    }

    for (const matiere of seenMatieres) {
      const count = await client.count(COLLECTION_NAME, {
        filter: {
          must: [
            { key: 'niveau', match: { value: niveau } },
            { key: 'matiere', match: { value: matiere } },
          ],
        },
      });
      if (count.count > 0) by_matiere[matiere] = count.count;
    }

    await redisCacheService.set(CACHE_PREFIX, cacheKey, by_matiere, CACHE_TTL.REDIS);
    logger.info('Matieres retrieved', { operation: 'qdrant:matieres', niveau, count: Object.keys(by_matiere).length });

    return by_matiere;
  }

  /** Chapitres et thèmes pour matière/niveau - Cache Redis 1h */
  async getTopics(
    matiere: string,
    niveau: string
  ): Promise<{ domaine: string; category: string; themes: string[] }[]> {
    const cacheKey = `topics:${niveau}:${matiere}`;

    const cached = await redisCacheService.get<{ domaine: string; category: string; themes: string[] }[]>(
      CACHE_PREFIX,
      cacheKey
    );
    if (cached) {
      logger.info('Topics cache hit', { operation: 'qdrant:topics:cache-hit', niveau, matiere });
      return cached;
    }

    const client = this.getClient();
    const points = await client.scroll(COLLECTION_NAME, {
      filter: {
        must: [
          { key: 'niveau', match: { value: niveau } },
          { key: 'matiere', match: { value: matiere } },
        ],
      },
      limit: 1000,
      with_payload: ['domaine', 'sousdomaine', 'title'],
    });

    const chapitreMap = new Map<string, { category: string; themes: Set<string> }>();
    for (const point of points.points) {
      const p = point.payload as Record<string, unknown>;
      const category = p['domaine'] ? String(p['domaine']) : 'Autre';
      const chapitre = p['sousdomaine'] ? String(p['sousdomaine']) : null;
      const theme = p['title'] ? String(p['title']) : null;

      if (!chapitre) continue;
      if (!chapitreMap.has(chapitre)) chapitreMap.set(chapitre, { category, themes: new Set() });
      if (theme) chapitreMap.get(chapitre)!.themes.add(theme);
    }

    const result = Array.from(chapitreMap.entries())
      .map(([chapitre, data]) => ({
        domaine: chapitre,
        category: data.category,
        themes: Array.from(data.themes).sort(),
      }))
      .sort((a, b) => {
        const cmp = a.category.localeCompare(b.category);
        return cmp !== 0 ? cmp : a.domaine.localeCompare(b.domaine);
      });

    await redisCacheService.set(CACHE_PREFIX, cacheKey, result, CACHE_TTL.REDIS);
    logger.info('Topics retrieved', { operation: 'qdrant:topics', niveau, matiere, count: result.length });

    return result;
  }

  /**
   * Hiérarchie des chapitres pour un niveau/matière - Best practice 2026
   *
   * Structure retournée:
   * - Chapter (domaine): "Nombres et Calculs", "Géométrie"...
   *   - SubChapter (sousdomaine): "Fractions", "Échelles"...
   *     - Topics (titles): "Addition de fractions", "Lecture d'échelle"...
   *
   * Cache Redis 1h pour performance frontend
   */
  async getChaptersHierarchy(
    matiere: string,
    niveau: EducationLevelType,
    matiereLabel: string
  ): Promise<ChaptersHierarchy> {
    const cacheKey = `chapters:${niveau}:${matiere}`;

    const cached = await redisCacheService.get<ChaptersHierarchy>(CACHE_PREFIX, cacheKey);
    if (cached) {
      logger.info('Chapters hierarchy cache hit', {
        operation: 'qdrant:chapters:cache-hit',
        niveau,
        matiere
      });
      return cached;
    }

    const client = this.getClient();
    const points = await client.scroll(COLLECTION_NAME, {
      filter: {
        must: [
          { key: 'niveau', match: { value: niveau } },
          { key: 'matiere', match: { value: matiere } },
        ],
      },
      limit: 1000,
      with_payload: ['domaine', 'sousdomaine', 'title'],
    });

    // Build hierarchy: domaine → sousdomaine → titles
    const hierarchyMap = new Map<string, Map<string, Set<string>>>();

    for (const point of points.points) {
      const p = point.payload as Record<string, unknown>;
      const domaine = p['domaine'] ? String(p['domaine']) : 'Autre';
      const sousdomaine = p['sousdomaine'] ? String(p['sousdomaine']) : null;
      const title = p['title'] ? String(p['title']) : null;

      if (!sousdomaine) continue;

      if (!hierarchyMap.has(domaine)) {
        hierarchyMap.set(domaine, new Map());
      }
      const subChaptersMap = hierarchyMap.get(domaine)!;

      if (!subChaptersMap.has(sousdomaine)) {
        subChaptersMap.set(sousdomaine, new Set());
      }
      if (title) {
        subChaptersMap.get(sousdomaine)!.add(title);
      }
    }

    // Convert to typed structure
    const chapters: Chapter[] = Array.from(hierarchyMap.entries())
      .map(([domaineName, subChaptersMap]) => {
        const subChapters: SubChapter[] = Array.from(subChaptersMap.entries())
          .map(([subChapterName, topicsSet]) => ({
            id: this.slugify(subChapterName),
            name: subChapterName,
            topics: Array.from(topicsSet).sort(),
            topicsCount: topicsSet.size,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

        return {
          id: this.slugify(domaineName),
          name: domaineName,
          subChapters,
          subChaptersCount: subChapters.length,
          topicsCount: subChapters.reduce((sum, sc) => sum + sc.topicsCount, 0),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

    const result: ChaptersHierarchy = {
      niveau,
      matiere,
      matiereLabel,
      chapters,
      totalChapters: chapters.length,
      totalSubChapters: chapters.reduce((sum, c) => sum + c.subChaptersCount, 0),
      totalTopics: chapters.reduce((sum, c) => sum + c.topicsCount, 0),
    };

    await redisCacheService.set(CACHE_PREFIX, cacheKey, result, CACHE_TTL.REDIS);

    logger.info('Chapters hierarchy built', {
      operation: 'qdrant:chapters:build',
      niveau,
      matiere,
      totalChapters: result.totalChapters,
      totalSubChapters: result.totalSubChapters,
      totalTopics: result.totalTopics,
    });

    return result;
  }

  /** Génère un slug URL-safe à partir d'un nom */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /** Health check */
  async isAvailable(): Promise<boolean> {
    try {
      await this.getClient().getCollection(COLLECTION_NAME);
      return true;
    } catch {
      return false;
    }
  }

  /** Invalide le cache (in-memory + Redis) */
  async invalidateCache(): Promise<void> {
    this.statsCache = null;
    await redisCacheService.delete(CACHE_PREFIX, 'stats:collection');
    logger.info('Qdrant cache invalidated', { operation: 'qdrant:cache:invalidate' });
  }
}

export const qdrantService = new QdrantService();
