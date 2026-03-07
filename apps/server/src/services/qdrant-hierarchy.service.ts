import type { QdrantClient } from '@qdrant/js-client-rest';
import { logger } from '../lib/observability.js';
import { cacheService } from './memory-cache.service.js';
import type { Chapter, SubChapter, ChaptersHierarchy, EducationLevelType } from '../types/index.js';

const CACHE_TTL_DEFAULT = 3600;
const CACHE_PREFIX = 'qdrant:' as const;

export class QdrantHierarchyService {
  constructor(
    private readonly getClient: () => QdrantClient,
    private readonly collectionName: string
  ) {}

  async getMatieresForNiveau(niveau: string): Promise<Record<string, number>> {
    const cacheKey = `matieres:${niveau}`;

    const cached = cacheService.get<Record<string, number>>(CACHE_PREFIX, cacheKey);
    if (cached) {
      logger.info('Matieres cache hit', { operation: 'qdrant:matieres:cache-hit', niveau });
      return cached;
    }

    const client = this.getClient();
    const by_matiere: Record<string, number> = {};
    const seenMatieres = new Set<string>();

    let offset: Awaited<ReturnType<typeof client.scroll>>['next_page_offset'] = undefined;
    for (let i = 0; i < 10; i++) {
      const response = await client.scroll(this.collectionName, {
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
      const count = await client.count(this.collectionName, {
        filter: {
          must: [
            { key: 'niveau', match: { value: niveau } },
            { key: 'matiere', match: { value: matiere } },
          ],
        },
      });
      if (count.count > 0) by_matiere[matiere] = count.count;
    }

    cacheService.set(CACHE_PREFIX, cacheKey, by_matiere, CACHE_TTL_DEFAULT);
    logger.info('Matieres retrieved', { operation: 'qdrant:matieres', niveau, count: Object.keys(by_matiere).length });

    return by_matiere;
  }

  async getTopics(
    matiere: string,
    niveau: string
  ): Promise<{ domaine: string; category: string; themes: string[] }[]> {
    const cacheKey = `topics:${niveau}:${matiere}`;

    const cached = cacheService.get<{ domaine: string; category: string; themes: string[] }[]>(
      CACHE_PREFIX, cacheKey
    );
    if (cached) {
      logger.info('Topics cache hit', { operation: 'qdrant:topics:cache-hit', niveau, matiere });
      return cached;
    }

    const client = this.getClient();
    const points = await client.scroll(this.collectionName, {
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

    cacheService.set(CACHE_PREFIX, cacheKey, result, CACHE_TTL_DEFAULT);
    logger.info('Topics retrieved', { operation: 'qdrant:topics', niveau, matiere, count: result.length });

    return result;
  }

  async getChaptersHierarchy(
    matiere: string,
    niveau: EducationLevelType,
    matiereLabel: string
  ): Promise<ChaptersHierarchy> {
    const cacheKey = `chapters:${niveau}:${matiere}`;

    const cached = cacheService.get<ChaptersHierarchy>(CACHE_PREFIX, cacheKey);
    if (cached) {
      logger.info('Chapters hierarchy cache hit', {
        operation: 'qdrant:chapters:cache-hit', niveau, matiere
      });
      return cached;
    }

    const client = this.getClient();
    const points = await client.scroll(this.collectionName, {
      filter: {
        must: [
          { key: 'niveau', match: { value: niveau } },
          { key: 'matiere', match: { value: matiere } },
        ],
      },
      limit: 1000,
      with_payload: ['domaine', 'sousdomaine', 'title'],
    });

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
      niveau, matiere, matiereLabel, chapters,
      totalChapters: chapters.length,
      totalSubChapters: chapters.reduce((sum, c) => sum + c.subChaptersCount, 0),
      totalTopics: chapters.reduce((sum, c) => sum + c.topicsCount, 0),
    };

    cacheService.set(CACHE_PREFIX, cacheKey, result, CACHE_TTL_DEFAULT);

    logger.info('Chapters hierarchy built', {
      operation: 'qdrant:chapters:build', niveau, matiere,
      totalChapters: result.totalChapters,
      totalSubChapters: result.totalSubChapters,
      totalTopics: result.totalTopics,
    });

    return result;
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
