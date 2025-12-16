/**
 * Education Qdrant Service - Récupération des niveaux et matières depuis Qdrant
 *
 * Source de vérité: Qdrant Cloud (tomai_educational collection)
 * Enrichissement: school-subjects.config.ts pour emoji/color/description
 *
 * Architecture:
 * 1. Query Qdrant pour matières disponibles (DISTINCT sur payload.matiere)
 * 2. Enrichir avec métadonnées UI depuis config
 * 3. Cache Redis 1h (les matières changent rarement)
 */

import { getQdrantClient } from './qdrant/qdrant-client.service.js';
import { isQdrantRAGEnabled } from './qdrant/index.js';
import { QDRANT_CONFIG } from './qdrant/config.js';
import { redisCacheService } from './redis-cache.service.js';
import { logger } from '../lib/observability.js';
import type { EducationLevelType } from '../types/index.js';

/**
 * Interface matière disponible (retournée par l'API)
 * Compatible avec frontend EducationSubject
 */
export interface AvailableSubject {
  key: string;
  name: string; // Nom d'affichage (français) - compatible frontend
  description: string;
  emoji: string;
  color: string;
  ragKeywords: string[]; // Keywords RAG pour recherche
  ragAvailable: boolean; // true si contenu RAG disponible
}

/**
 * Interface niveau disponible (retournée par l'API)
 */
export interface AvailableLevel {
  key: EducationLevelType;
  name: string;
  nameFr: string;
  cycle: string;
  ageRange: string;
  ragAvailable: boolean;
  subjectsCount: number;
}

/**
 * Mapping matière Qdrant → métadonnées UI
 * Compatible avec frontend EducationSubject
 *
 * Source de vérité: Qdrant Cloud (tomai_educational collection)
 * Les matières ci-dessous sont enrichies pour l'affichage frontend.
 */
const SUBJECT_METADATA: Record<string, Omit<AvailableSubject, 'key' | 'ragAvailable'>> = {
  // === MATIÈRES FONDAMENTALES ===
  mathematiques: {
    name: 'Mathématiques',
    description: 'Calculs, géométrie, algèbre et problèmes',
    emoji: '📐',
    color: 'blue',
    ragKeywords: ['maths', 'calcul', 'géométrie', 'algèbre', 'équation', 'nombre'],
  },
  francais: {
    name: 'Français',
    description: 'Lecture, écriture, grammaire et littérature',
    emoji: '📚',
    color: 'red',
    ragKeywords: ['français', 'grammaire', 'conjugaison', 'orthographe', 'lecture', 'rédaction'],
  },

  // === SCIENCES ===
  physique_chimie: {
    name: 'Physique-Chimie',
    description: 'Sciences physiques et chimiques',
    emoji: '⚗️',
    color: 'purple',
    ragKeywords: ['physique', 'chimie', 'énergie', 'électricité', 'molécule', 'atome'],
  },
  svt: {
    name: 'SVT',
    description: 'Sciences de la Vie et de la Terre',
    emoji: '🌿',
    color: 'green',
    ragKeywords: ['svt', 'biologie', 'géologie', 'vivant', 'cellule', 'environnement'],
  },

  // === SCIENCES HUMAINES ===
  histoire_geo: {
    name: 'Histoire-Géographie',
    description: 'Histoire et géographie de France et du monde',
    emoji: '🌍',
    color: 'orange',
    ragKeywords: ['histoire', 'géographie', 'guerre', 'révolution', 'territoire', 'mondialisation'],
  },

  // === LANGUES VIVANTES ===
  anglais: {
    name: 'Anglais',
    description: 'Compréhension, expression et culture anglophone',
    emoji: '🗣️',
    color: 'red',
    ragKeywords: ['anglais', 'english', 'vocabulary', 'grammar', 'conversation'],
  },
  espagnol: {
    name: 'Espagnol',
    description: 'Vocabulaire, grammaire et culture hispanophone',
    emoji: '💬',
    color: 'yellow',
    ragKeywords: ['espagnol', 'español', 'vocabulario', 'gramática', 'conversación'],
  },
  allemand: {
    name: 'Allemand',
    description: 'Expression orale, écrite et culture germanique',
    emoji: '📖',
    color: 'slate',
    ragKeywords: ['allemand', 'deutsch', 'vokabular', 'grammatik', 'konversation'],
  },
  italien: {
    name: 'Italien',
    description: 'Langue et civilisation italiennes',
    emoji: '🎭',
    color: 'green',
    ragKeywords: ['italien', 'italiano', 'vocabolario', 'grammatica', 'conversazione'],
  },

  // === TECHNOLOGIE ===
  technologie: {
    name: 'Technologie',
    description: 'Découverte technique et numérique',
    emoji: '⚙️',
    color: 'gray',
    ragKeywords: ['technologie', 'informatique', 'numérique', 'programmation', 'robot'],
  },
};

/**
 * Mapping niveau → métadonnées UI
 */
const LEVEL_METADATA: Record<
  string,
  { nameFr: string; cycle: string; ageRange: string }
> = {
  cp: { nameFr: 'CP', cycle: 'Cycle 2', ageRange: '6-7 ans' },
  ce1: { nameFr: 'CE1', cycle: 'Cycle 2', ageRange: '7-8 ans' },
  ce2: { nameFr: 'CE2', cycle: 'Cycle 2', ageRange: '8-9 ans' },
  cm1: { nameFr: 'CM1', cycle: 'Cycle 3', ageRange: '9-10 ans' },
  cm2: { nameFr: 'CM2', cycle: 'Cycle 3', ageRange: '10-11 ans' },
  sixieme: { nameFr: 'Sixième', cycle: 'Cycle 3', ageRange: '11-12 ans' },
  cinquieme: { nameFr: 'Cinquième', cycle: 'Cycle 4', ageRange: '12-13 ans' },
  quatrieme: { nameFr: 'Quatrième', cycle: 'Cycle 4', ageRange: '13-14 ans' },
  troisieme: { nameFr: 'Troisième', cycle: 'Cycle 4', ageRange: '14-15 ans' },
  seconde: { nameFr: 'Seconde', cycle: 'Lycée', ageRange: '15-16 ans' },
  premiere: { nameFr: 'Première', cycle: 'Lycée', ageRange: '16-17 ans' },
  terminale: { nameFr: 'Terminale', cycle: 'Lycée', ageRange: '17-18 ans' },
};

/**
 * Liste ordonnée de tous les niveaux (pour affichage frontend)
 */
const ALL_LEVELS: EducationLevelType[] = [
  'cp', 'ce1', 'ce2', 'cm1', 'cm2',
  'sixieme', 'cinquieme', 'quatrieme', 'troisieme',
  'seconde', 'premiere', 'terminale',
];

/**
 * === LOGIQUE LV2 (Langue Vivante 2) ===
 *
 * - LV1 = Anglais (obligatoire, toujours inclus dès CM1)
 * - LV2 = Espagnol OU Allemand OU Italien (au choix, à partir de 5ème)
 * - Un élève ne peut avoir qu'UNE SEULE LV2
 */

/** Niveaux où la LV2 est disponible (à partir de 5ème) */
const LV2_ELIGIBLE_LEVELS: EducationLevelType[] = [
  'cinquieme', 'quatrieme', 'troisieme',
  'seconde', 'premiere', 'terminale',
];

/** Options LV2 disponibles */
export type Lv2Option = 'espagnol' | 'allemand' | 'italien';
export const LV2_OPTIONS: Lv2Option[] = ['espagnol', 'allemand', 'italien'];

/** Interface option LV2 avec métadonnées */
export interface Lv2OptionInfo {
  key: Lv2Option;
  name: string;
  description: string;
  emoji: string;
  color: string;
}

/** Métadonnées LV2 pour affichage */
const LV2_METADATA: Record<Lv2Option, Omit<Lv2OptionInfo, 'key'>> = {
  espagnol: {
    name: 'Espagnol',
    description: 'Vocabulaire, grammaire et culture hispanophone',
    emoji: '💬',
    color: 'yellow',
  },
  allemand: {
    name: 'Allemand',
    description: 'Expression orale, écrite et culture germanique',
    emoji: '📖',
    color: 'slate',
  },
  italien: {
    name: 'Italien',
    description: 'Langue et civilisation italiennes',
    emoji: '🎭',
    color: 'green',
  },
};

class EducationQdrantService {
  private readonly CACHE_TTL = 3600; // 1 heure

  // ==========================================
  // === MÉTHODES LV2 ===
  // ==========================================

  /**
   * Vérifie si un niveau scolaire permet la LV2
   */
  isLv2EligibleLevel(level: EducationLevelType): boolean {
    return LV2_ELIGIBLE_LEVELS.includes(level);
  }

  /**
   * Retourne les options LV2 disponibles avec métadonnées
   * Utilisé par le frontend pour afficher le sélecteur LV2
   */
  getLv2Options(): Lv2OptionInfo[] {
    return LV2_OPTIONS.map((key) => ({
      key,
      ...LV2_METADATA[key],
    }));
  }

  /**
   * Retourne les matières pour un niveau avec filtrage LV2
   *
   * Logique:
   * - Niveaux sans LV2 (CP→6ème): retourne toutes les matières sauf LV2
   * - Niveaux avec LV2 (5ème+): retourne matières + LV2 sélectionnée uniquement
   *
   * @param level - Niveau scolaire
   * @param selectedLv2 - LV2 choisie (requis si niveau >= 5ème)
   */
  async getSubjectsForLevelWithLv2(
    level: EducationLevelType,
    selectedLv2?: Lv2Option | null
  ): Promise<AvailableSubject[]> {
    // Récupérer toutes les matières du niveau
    const allSubjects = await this.getSubjectsForLevel(level);

    // Filtrer les LV2 selon la logique
    const isLv2Level = this.isLv2EligibleLevel(level);

    const filteredSubjects = allSubjects.filter((subject) => {
      const isLv2Subject = LV2_OPTIONS.includes(subject.key as Lv2Option);

      if (!isLv2Subject) {
        // Matière non-LV2: toujours incluse
        return true;
      }

      if (!isLv2Level) {
        // Niveau sans LV2: exclure toutes les LV2
        return false;
      }

      // Niveau avec LV2: inclure uniquement la LV2 sélectionnée
      return selectedLv2 && subject.key === selectedLv2;
    });

    logger.info('Subjects filtered with LV2 logic', {
      operation: 'education:subjects:lv2-filter',
      level,
      isLv2Level,
      selectedLv2: selectedLv2 ?? 'none',
      totalSubjects: allSubjects.length,
      filteredCount: filteredSubjects.length,
      severity: 'low' as const,
    });

    return filteredSubjects;
  }

  // ==========================================
  // === MÉTHODES EXISTANTES ===
  // ==========================================

  /**
   * Récupère tous les niveaux avec leur statut RAG
   */
  async getAvailableLevels(): Promise<AvailableLevel[]> {
    const cacheKey = 'education:levels:all';

    // Check cache
    const cached = await redisCacheService.get<AvailableLevel[]>('education:', cacheKey);
    if (cached) {
      logger.info('Cache hit for education levels', {
        operation: 'education:levels:cache-hit',
        severity: 'low' as const,
      });
      return cached;
    }

    // Query Qdrant pour niveaux disponibles
    const qdrantLevels = await this.getDistinctValuesFromQdrant('niveau');

    const levels: AvailableLevel[] = ALL_LEVELS.map((levelKey) => {
      const metadata = LEVEL_METADATA[levelKey];
      const ragAvailable = qdrantLevels.includes(levelKey);

      return {
        key: levelKey,
        name: levelKey,
        nameFr: metadata?.nameFr ?? levelKey,
        cycle: metadata?.cycle ?? 'unknown',
        ageRange: metadata?.ageRange ?? '',
        ragAvailable,
        subjectsCount: 0, // Sera rempli par getSubjectsForLevel si besoin
      };
    });

    // Enrichir avec nombre de matières pour niveaux RAG disponibles
    for (const level of levels) {
      if (level.ragAvailable) {
        const subjects = await this.getSubjectsForLevel(level.key, true); // skipCache
        level.subjectsCount = subjects.length;
      }
    }

    // Cache result
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
   * Récupère les matières disponibles pour un niveau depuis Qdrant
   */
  async getSubjectsForLevel(
    level: EducationLevelType,
    skipCache = false
  ): Promise<AvailableSubject[]> {
    const cacheKey = `education:subjects:${level}`;

    // Check cache
    if (!skipCache) {
      const cached = await redisCacheService.get<AvailableSubject[]>('education:', cacheKey);
      if (cached) {
        logger.info('Cache hit for education subjects', {
          operation: 'education:subjects:cache-hit',
          level,
          severity: 'low' as const,
        });
        return cached;
      }
    }

    // Query Qdrant pour matières disponibles à ce niveau
    const qdrantSubjects = await this.getDistinctSubjectsForLevel(level);

    // Enrichir avec métadonnées UI (compatible frontend EducationSubject)
    const subjects: AvailableSubject[] = qdrantSubjects.map((subjectKey) => {
      const metadata = SUBJECT_METADATA[subjectKey];

      return {
        key: subjectKey,
        name: metadata?.name ?? subjectKey, // Nom français d'affichage
        description: metadata?.description ?? `Cours de ${subjectKey}`,
        emoji: metadata?.emoji ?? '📖',
        color: metadata?.color ?? 'gray',
        ragKeywords: metadata?.ragKeywords ?? [subjectKey],
        ragAvailable: true,
      };
    });

    // Cache result
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
   * Query Qdrant pour valeurs distinctes d'un champ payload
   */
  private async getDistinctValuesFromQdrant(field: string): Promise<string[]> {
    if (!isQdrantRAGEnabled()) {
      logger.warn('Qdrant disabled, returning empty', {
        operation: 'education:qdrant:disabled',
        severity: 'medium' as const,
      });
      return [];
    }

    try {
      const client = getQdrantClient();

      // Scroll tous les points et extraire valeurs uniques
      const result = await client.scroll(QDRANT_CONFIG.collection.name, {
        limit: 1000, // Suffisant pour notre dataset
        with_payload: [field],
      });

      const values = new Set<string>();
      for (const point of result.points) {
        const value = (point.payload as Record<string, unknown>)?.[field];
        if (typeof value === 'string') {
          values.add(value);
        }
      }

      return Array.from(values);
    } catch (error) {
      logger.error('Failed to query Qdrant for distinct values', {
        operation: 'education:qdrant:error',
        field,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'high' as const,
      });
      return [];
    }
  }

  /**
   * Query Qdrant pour matières distinctes d'un niveau
   */
  private async getDistinctSubjectsForLevel(level: string): Promise<string[]> {
    if (!isQdrantRAGEnabled()) {
      return [];
    }

    try {
      const client = getQdrantClient();

      // Scroll avec filtre niveau
      const result = await client.scroll(QDRANT_CONFIG.collection.name, {
        limit: 1000,
        with_payload: ['matiere'],
        filter: {
          must: [{ key: 'niveau', match: { value: level } }],
        },
      });

      const subjects = new Set<string>();
      for (const point of result.points) {
        const matiere = (point.payload as Record<string, unknown>)?.matiere;
        if (typeof matiere === 'string') {
          subjects.add(matiere);
        }
      }

      return Array.from(subjects);
    } catch (error) {
      logger.error('Failed to query subjects for level', {
        operation: 'education:subjects:error',
        level,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'high' as const,
      });
      return [];
    }
  }

  /**
   * Invalide le cache pour un niveau
   */
  async invalidateCacheForLevel(level: EducationLevelType): Promise<void> {
    await redisCacheService.delete('education:', `education:subjects:${level}`);
    await redisCacheService.delete('education:', 'education:levels:all');

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

    logger.info('All education cache invalidated', {
      operation: 'education:cache:invalidate-all',
      severity: 'low' as const,
    });
  }
}

export const educationQdrantService = new EducationQdrantService();
