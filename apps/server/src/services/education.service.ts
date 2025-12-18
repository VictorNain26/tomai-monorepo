/**
 * Education Service - Récupération des matières disponibles dans le RAG
 *
 * Source de vérité: Qdrant Cloud (appels directs)
 * Retourne uniquement les clés RAG, pas de métadonnées UI.
 *
 * L'enrichissement UI (emoji, color, description) est fait côté frontend.
 */

import { qdrantService } from './qdrant.service.js';
import { redisCacheService } from './redis-cache.service.js';
import { logger } from '../lib/observability.js';
import type { EducationLevelType } from '../types/index.js';

// =============================================================================
// Types - Réponses RAG uniquement (pas de UI metadata)
// =============================================================================

export interface RagSubject {
  key: string;
  ragAvailable: boolean;
}

export interface RagLevel {
  key: EducationLevelType;
  ragAvailable: boolean;
  subjectsCount: number;
}

// =============================================================================
// Constantes
// =============================================================================

const ALL_LEVELS: EducationLevelType[] = [
  'cp', 'ce1', 'ce2', 'cm1', 'cm2',
  'sixieme', 'cinquieme', 'quatrieme', 'troisieme',
  'seconde', 'premiere', 'terminale',
];

// =============================================================================
// Service
// =============================================================================

class EducationService {
  private readonly CACHE_TTL = 3600; // 1 heure

  /**
   * Retourne les niveaux disponibles dans le RAG
   */
  async getAvailableLevels(): Promise<RagLevel[]> {
    const cacheKey = 'education:levels:all';

    const cached = await redisCacheService.get<RagLevel[]>('education:', cacheKey);
    if (cached) {
      logger.info('Cache hit for education levels', {
        operation: 'education:levels:cache-hit',
        severity: 'low' as const,
      });
      return cached;
    }

    const stats = await qdrantService.getStats();
    const qdrantLevels = Object.keys(stats.by_niveau);

    const levels: RagLevel[] = ALL_LEVELS.map((levelKey) => ({
      key: levelKey,
      ragAvailable: qdrantLevels.includes(levelKey),
      subjectsCount: 0,
    }));

    // Enrichir avec nombre de matières
    for (const level of levels) {
      if (level.ragAvailable) {
        const subjects = await this.getSubjectsForLevel(level.key, true);
        level.subjectsCount = subjects.length;
      }
    }

    await redisCacheService.set('education:', cacheKey, levels, this.CACHE_TTL);

    logger.info('Education levels retrieved from Qdrant', {
      operation: 'education:levels:success',
      totalLevels: levels.length,
      ragAvailable: levels.filter((l) => l.ragAvailable).length,
      severity: 'low' as const,
    });

    return levels;
  }

  /**
   * Retourne les matières disponibles dans le RAG pour un niveau
   */
  async getSubjectsForLevel(
    level: EducationLevelType,
    skipCache = false
  ): Promise<RagSubject[]> {
    const cacheKey = `education:subjects:${level}`;

    if (!skipCache) {
      const cached = await redisCacheService.get<RagSubject[]>('education:', cacheKey);
      if (cached) {
        logger.info('Cache hit for education subjects', {
          operation: 'education:subjects:cache-hit',
          level,
          severity: 'low' as const,
        });
        return cached;
      }
    }

    const stats = await qdrantService.getStats();
    const allMatieres = Object.keys(stats.by_matiere);

    const subjects: RagSubject[] = allMatieres.map((subjectKey) => ({
      key: subjectKey,
      ragAvailable: true,
    }));

    if (!skipCache) {
      await redisCacheService.set('education:', cacheKey, subjects, this.CACHE_TTL);
    }

    logger.info('Subjects retrieved from Qdrant', {
      operation: 'education:subjects:success',
      level,
      count: subjects.length,
      subjects: subjects.map((s) => s.key),
      severity: 'low' as const,
    });

    return subjects;
  }

  /**
   * Invalide le cache pour un niveau
   */
  async invalidateCacheForLevel(level: EducationLevelType): Promise<void> {
    await redisCacheService.delete('education:', `education:subjects:${level}`);
    await redisCacheService.delete('education:', 'education:levels:all');
    qdrantService.invalidateCache();

    logger.info('Cache invalidated for level', {
      operation: 'education:cache:invalidate',
      level,
      severity: 'low' as const,
    });
  }

  /**
   * Invalide tout le cache éducation
   */
  async invalidateAllCache(): Promise<void> {
    for (const level of ALL_LEVELS) {
      await redisCacheService.delete('education:', `education:subjects:${level}`);
    }
    await redisCacheService.delete('education:', 'education:levels:all');
    qdrantService.invalidateCache();

    logger.info('All education cache invalidated', {
      operation: 'education:cache:invalidate-all',
      severity: 'low' as const,
    });
  }
}

export const educationService = new EducationService();
