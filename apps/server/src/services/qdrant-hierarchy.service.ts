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

    // Parallel fan-out: one count query per matiere. Sequential was 10-13×
    // serial RTTs for a niveau with many subjects.
    const countEntries = await Promise.all(
      Array.from(seenMatieres).map(async matiere => {
        const count = await client.count(this.collectionName, {
          filter: {
            must: [
              { key: 'niveau', match: { value: niveau } },
              { key: 'matiere', match: { value: matiere } },
            ],
          },
        });
        return [matiere, count.count] as const;
      }),
    );
    for (const [matiere, count] of countEntries) {
      if (count > 0) by_matiere[matiere] = count;
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

    // Schema curriculum ADR-0007 : pas de hiérarchie domaine/sousdomaine/title.
    // On a juste `section` par chunk. On retourne 1 entrée par section unique
    // de la matière (themes vide, le front peut s'adapter ou ignorer).
    const client = this.getClient();
    const points = await client.scroll(this.collectionName, {
      filter: {
        must: [
          { key: 'niveau', match: { value: niveau } },
          { key: 'matiere', match: { value: matiere } },
        ],
      },
      limit: 1000,
      with_payload: ['section'],
    });

    const sectionSet = new Set<string>();
    for (const point of points.points) {
      const p = point.payload as Record<string, unknown>;
      const section = p['section'] ? String(p['section']) : null;
      if (section) sectionSet.add(section);
    }

    const result = Array.from(sectionSet)
      .sort((a, b) => a.localeCompare(b, 'fr'))
      .map((section) => ({
        domaine: section,
        category: matiere,
        themes: [] as string[],
      }));

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

    // Schema curriculum ADR-0007 : hiérarchie 1-niveau (`section` seul). Chaque
    // section unique devient un Chapter sans SubChapter (la granularité fine
    // domaine/sousdomaine/title n'existe plus depuis l'élimination des champs
    // LLM-generated). Le frontend reçoit donc une liste plate de chapters.
    const client = this.getClient();
    const points = await client.scroll(this.collectionName, {
      filter: {
        must: [
          { key: 'niveau', match: { value: niveau } },
          { key: 'matiere', match: { value: matiere } },
        ],
      },
      limit: 1000,
      with_payload: ['section'],
    });

    const sectionCounts = new Map<string, number>();
    for (const point of points.points) {
      const p = point.payload as Record<string, unknown>;
      const section = p['section'] ? String(p['section']) : null;
      if (!section) continue;
      sectionCounts.set(section, (sectionCounts.get(section) ?? 0) + 1);
    }

    const chapters: Chapter[] = Array.from(sectionCounts.entries())
      .map(([sectionName, chunkCount]) => ({
        id: this.slugify(sectionName),
        name: sectionName,
        subChapters: [] as SubChapter[],
        subChaptersCount: 0,
        topicsCount: chunkCount,
      }))
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
