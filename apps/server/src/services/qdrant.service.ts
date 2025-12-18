/**
 * Qdrant Service - Client direct pour recherche vectorielle
 *
 * Remplace curriculum-client pour appels directs à Qdrant Cloud.
 * Utilisé par rag.service.ts et education.service.ts
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { logger } from '../lib/observability.js';

// Configuration
const QDRANT_URL = Bun.env['QDRANT_URL'] ?? '';
const QDRANT_API_KEY = Bun.env['QDRANT_API_KEY'] ?? '';
// Support both QDRANT_COLLECTION and QDRANT_COLLECTION_NAME (legacy Koyeb)
const COLLECTION_NAME = Bun.env['QDRANT_COLLECTION'] ?? Bun.env['QDRANT_COLLECTION_NAME'] ?? 'tomai_educational';

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
  private readonly statsCacheTtl = 60_000; // 1 minute

  /**
   * Initialise le client Qdrant (lazy)
   */
  private getClient(): QdrantClient {
    if (!this.client) {
      if (!QDRANT_URL || !QDRANT_API_KEY) {
        throw new Error('QDRANT_URL and QDRANT_API_KEY are required');
      }

      this.client = new QdrantClient({
        url: QDRANT_URL,
        apiKey: QDRANT_API_KEY,
      });

      logger.info('Qdrant client initialized', {
        operation: 'qdrant:init',
        url: QDRANT_URL.substring(0, 30) + '...',
        collection: COLLECTION_NAME,
      });
    }

    return this.client;
  }

  /**
   * Recherche vectorielle dans Qdrant
   */
  async search(
    queryVector: number[],
    filter?: QdrantFilter,
    limit: number = 20
  ): Promise<QdrantSearchResult[]> {
    const client = this.getClient();
    const startTime = Date.now();

    // Construire le filtre Qdrant
    const must: Array<{ key: string; match: { value: string } }> = [];
    if (filter?.niveau) {
      must.push({ key: 'niveau', match: { value: filter.niveau } });
    }
    if (filter?.matiere) {
      must.push({ key: 'matiere', match: { value: filter.matiere } });
    }
    if (filter?.difficulty) {
      must.push({ key: 'difficulty', match: { value: filter.difficulty } });
    }

    const qdrantFilter = must.length > 0 ? { must } : undefined;

    const response = await client.query(COLLECTION_NAME, {
      query: queryVector,
      limit,
      filter: qdrantFilter,
      with_payload: true,
    });

    const results: QdrantSearchResult[] = response.points.map((point) => {
      const payload = point.payload as Record<string, unknown>;
      return {
        id: String(point.id),
        score: point.score ?? 0,
        title: String(payload['title'] ?? ''),
        content: String(payload['content'] ?? ''),
        matiere: String(payload['matiere'] ?? ''),
        niveau: String(payload['niveau'] ?? ''),
        domaine: payload['domaine'] ? String(payload['domaine']) : undefined,
        sousdomaine: payload['sousdomaine'] ? String(payload['sousdomaine']) : undefined,
        content_type: payload['content_type'] ? String(payload['content_type']) : undefined,
        difficulty: payload['difficulty'] ? String(payload['difficulty']) : undefined,
      };
    });

    logger.info('Qdrant search completed', {
      operation: 'qdrant:search',
      resultsCount: results.length,
      filter: filter ?? {},
      durationMs: Date.now() - startTime,
    });

    return results;
  }

  /**
   * Récupère les statistiques de la collection
   */
  async getStats(): Promise<CollectionStats> {
    // Cache hit
    if (this.statsCache && Date.now() - this.statsCache.timestamp < this.statsCacheTtl) {
      return this.statsCache.data;
    }

    const client = this.getClient();

    // Total points
    const collectionInfo = await client.getCollection(COLLECTION_NAME);
    const total_points = collectionInfo.points_count ?? 0;

    // Par niveau
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
      if (count.count > 0) {
        by_niveau[niveau] = count.count;
      }
    }

    // Récupérer les matières dynamiquement depuis les points existants
    const by_matiere = await this.getUniqueMatieres();

    const stats: CollectionStats = {
      total_points,
      by_niveau,
      by_matiere,
    };

    this.statsCache = { data: stats, timestamp: Date.now() };

    logger.info('Qdrant stats retrieved', {
      operation: 'qdrant:stats',
      total_points,
      niveaux: Object.keys(by_niveau).length,
      matieres: Object.keys(by_matiere).length,
    });

    return stats;
  }

  /**
   * Récupère dynamiquement toutes les matières uniques depuis Qdrant
   */
  private async getUniqueMatieres(): Promise<Record<string, number>> {
    const client = this.getClient();
    const by_matiere: Record<string, number> = {};

    // Scroll pour récupérer un échantillon de points et extraire les matières uniques
    // Type compatible avec Qdrant SDK qui peut retourner différents types pour next_page_offset
    let offset: Awaited<ReturnType<typeof client.scroll>>['next_page_offset'] = undefined;
    const seenMatieres = new Set<string>();

    // Limiter à quelques scrolls pour performance
    for (let i = 0; i < 10; i++) {
      const response = await client.scroll(COLLECTION_NAME, {
        limit: 100,
        offset,
        with_payload: ['matiere'],
      });

      for (const point of response.points) {
        const payload = point.payload as Record<string, unknown>;
        const matiere = payload['matiere'];
        if (matiere && typeof matiere === 'string') {
          seenMatieres.add(matiere);
        }
      }

      offset = response.next_page_offset;
      if (!offset) break;
    }

    // Compter les points par matière
    for (const matiere of seenMatieres) {
      const count = await client.count(COLLECTION_NAME, {
        filter: { must: [{ key: 'matiere', match: { value: matiere } }] },
      });
      if (count.count > 0) {
        by_matiere[matiere] = count.count;
      }
    }

    return by_matiere;
  }

  /**
   * Récupère les matières disponibles pour un niveau spécifique
   * @param niveau - Le niveau scolaire (cp, ce1, sixieme, etc.)
   * @returns Record des matières avec leur nombre de chunks pour ce niveau
   */
  async getMatieresForNiveau(niveau: string): Promise<Record<string, number>> {
    const client = this.getClient();
    const by_matiere: Record<string, number> = {};

    // Scroll pour récupérer les points de ce niveau et extraire les matières
    // Type compatible avec Qdrant SDK qui peut retourner différents types pour next_page_offset
    let offset: Awaited<ReturnType<typeof client.scroll>>['next_page_offset'] = undefined;
    const seenMatieres = new Set<string>();

    for (let i = 0; i < 10; i++) {
      const response = await client.scroll(COLLECTION_NAME, {
        limit: 100,
        offset,
        filter: { must: [{ key: 'niveau', match: { value: niveau } }] },
        with_payload: ['matiere'],
      });

      for (const point of response.points) {
        const payload = point.payload as Record<string, unknown>;
        const matiere = payload['matiere'];
        if (matiere && typeof matiere === 'string') {
          seenMatieres.add(matiere);
        }
      }

      offset = response.next_page_offset;
      if (!offset) break;
    }

    // Compter les points par matière pour ce niveau
    for (const matiere of seenMatieres) {
      const count = await client.count(COLLECTION_NAME, {
        filter: {
          must: [
            { key: 'niveau', match: { value: niveau } },
            { key: 'matiere', match: { value: matiere } },
          ],
        },
      });
      if (count.count > 0) {
        by_matiere[matiere] = count.count;
      }
    }

    logger.info('Matieres for niveau retrieved', {
      operation: 'qdrant:matieres-for-niveau',
      niveau,
      count: Object.keys(by_matiere).length,
      matieres: Object.keys(by_matiere),
    });

    return by_matiere;
  }

  /**
   * Récupère les topics (domaines/thèmes) pour une matière/niveau
   */
  async getTopics(
    matiere: string,
    niveau: string
  ): Promise<{ domaine: string; themes: string[] }[]> {
    const client = this.getClient();

    // Scroll pour récupérer tous les points de ce niveau/matière
    const points = await client.scroll(COLLECTION_NAME, {
      filter: {
        must: [
          { key: 'niveau', match: { value: niveau } },
          { key: 'matiere', match: { value: matiere } },
        ],
      },
      limit: 500,
      with_payload: ['domaine', 'sousdomaine'],
    });

    // Grouper par domaine
    const domaineMap = new Map<string, Set<string>>();

    for (const point of points.points) {
      const payload = point.payload as Record<string, unknown>;
      const domaine = String(payload['domaine'] ?? 'Autre');
      const sousdomaine = payload['sousdomaine'] ? String(payload['sousdomaine']) : null;

      if (!domaineMap.has(domaine)) {
        domaineMap.set(domaine, new Set());
      }

      if (sousdomaine) {
        domaineMap.get(domaine)!.add(sousdomaine);
      }
    }

    // Convertir en format attendu
    const result = Array.from(domaineMap.entries()).map(([domaine, themes]) => ({
      domaine,
      themes: Array.from(themes).sort(),
    }));

    return result.sort((a, b) => a.domaine.localeCompare(b.domaine));
  }

  /**
   * Vérifie si Qdrant est disponible
   */
  async isAvailable(): Promise<boolean> {
    try {
      const client = this.getClient();
      await client.getCollection(COLLECTION_NAME);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Invalide le cache des stats
   */
  invalidateCache(): void {
    this.statsCache = null;
  }
}

// Singleton
export const qdrantService = new QdrantService();
