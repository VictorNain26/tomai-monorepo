/**
 * EDUCATION SERVICE FRONTEND - Tom
 *
 * Service frontend qui:
 * 1. Récupère les clés de matières disponibles depuis le backend RAG
 * 2. Enrichit localement avec les métadonnées UI (emoji, color, description)
 *
 * Architecture:
 * - Backend retourne: { subjects: [{ key: "mathematiques", ragAvailable: true }] }
 * - Frontend enrichit avec: SUBJECT_METADATA (emoji, color, description, etc.)
 */

import { apiClient } from './api-client';
import {
  enrichSubjectKey,
  isLv2Subject,
  isLv2EligibleLevel,
  type Lv2Option,
} from '@/constants/subjects';
import type {
  EducationLevelType,
  EducationSubject,
  ISubjectsForStudent,
} from '@/types';

/**
 * Réponse brute du backend (clés RAG uniquement)
 */
interface RagSubjectsResponse {
  success: boolean;
  level: EducationLevelType;
  subjects: Array<{
    key: string;
    ragAvailable: boolean;
  }>;
}

interface SearchSubjectsResponse {
  subjects: Array<{ key: string; ragAvailable: boolean }>;
}

export interface LevelConfiguration {
  level: EducationLevelType;
  subjects: EducationSubject[];
  selectedLv2?: Lv2Option | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

class EducationServiceFrontend {
  private static instance: EducationServiceFrontend;
  private cache = new Map<string, unknown>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  static getInstance(): EducationServiceFrontend {
    if (!EducationServiceFrontend.instance) {
      EducationServiceFrontend.instance = new EducationServiceFrontend();
    }
    return EducationServiceFrontend.instance;
  }

  /**
   * Obtient la configuration complète pour un niveau avec support LV2
   *
   * 1. Récupère les clés RAG depuis le backend
   * 2. Enrichit localement avec les métadonnées UI
   * 3. Filtre les LV2 selon la sélection utilisateur
   *
   * @param level - Niveau scolaire
   * @param selectedLv2 - LV2 sélectionnée (optionnel, pour niveaux >= 5ème)
   */
  async getLevelConfiguration(level: EducationLevelType, selectedLv2?: Lv2Option | null): Promise<LevelConfiguration> {
    const cacheKey = `level:${level}:lv2:${selectedLv2 ?? 'none'}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) as LevelConfiguration;
    }

    // Récupère les clés RAG depuis le backend
    const response: RagSubjectsResponse = await apiClient.get(`/api/subjects/${level}`);

    // Enrichit avec métadonnées UI locales et filtre LV2
    const subjects = this.enrichAndFilterSubjects(response.subjects, level, selectedLv2);

    const config: LevelConfiguration = {
      level,
      subjects,
      selectedLv2: selectedLv2 ?? null
    };

    this.cache.set(cacheKey, config);
    setTimeout(() => this.cache.delete(cacheKey), this.cacheTimeout);

    return config;
  }

  /**
   * Enrichit les clés RAG avec métadonnées UI et filtre les LV2
   */
  private enrichAndFilterSubjects(
    ragSubjects: Array<{ key: string; ragAvailable: boolean }>,
    level: EducationLevelType,
    selectedLv2?: Lv2Option | null
  ): EducationSubject[] {
    const isLv2Level = isLv2EligibleLevel(level);

    return ragSubjects
      .filter((rag) => {
        // Toujours inclure les matières non-LV2
        if (!isLv2Subject(rag.key)) return true;
        // Exclure LV2 si niveau non éligible
        if (!isLv2Level) return false;
        // Inclure seulement la LV2 sélectionnée
        return selectedLv2 && rag.key === selectedLv2;
      })
      .map((rag) => {
        const metadata = enrichSubjectKey(rag.key);
        return {
          key: rag.key,
          name: metadata.name,
          description: metadata.description,
          emoji: metadata.emoji,
          color: metadata.color,
          ragKeywords: metadata.ragKeywords,
          ttsLanguage: metadata.ttsLanguage,
        };
      });
  }

  /**
   * Obtient toutes les matières disponibles pour un niveau avec support LV2
   * Avec déduplication pour éviter les doublons entre API et fallback
   * @param level - Niveau scolaire
   * @param selectedLv2 - LV2 sélectionnée (optionnel, pour niveaux >= 5ème)
   */
  async getAllSubjects(level: EducationLevelType, selectedLv2?: Lv2Option | null): Promise<EducationSubject[]> {
    const config = await this.getLevelConfiguration(level, selectedLv2);

    // Déduplication finale - Garantit l'absence de doublons
    const deduplicatedSubjects = config.subjects.reduce<EducationSubject[]>((acc, subject) => {
      const exists = acc.find(s => s.key === subject.key);
      if (!exists) {
        acc.push(subject);
      }
      return acc;
    }, []);

    return deduplicatedSubjects;
  }

  /**
   * Obtient les matières d'un enfant spécifique
   * Enrichit les clés RAG avec métadonnées UI locales
   */
  async getChildSubjects(childId: string): Promise<ISubjectsForStudent> {
    const cacheKey = `child:${childId}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) as ISubjectsForStudent;
    }

    const response: RagSubjectsResponse = await apiClient.get(`/api/parent/children/${childId}/subjects`);

    // Enrichit avec métadonnées UI locales
    const enrichedSubjects = response.subjects.map((rag) => {
      const metadata = enrichSubjectKey(rag.key);
      return {
        key: rag.key,
        name: metadata.name,
        description: metadata.description,
        emoji: metadata.emoji,
        color: metadata.color,
        ragKeywords: metadata.ragKeywords,
        ttsLanguage: metadata.ttsLanguage,
      };
    });

    const subjects: ISubjectsForStudent = {
      subjects: enrichedSubjects
    };

    this.cache.set(cacheKey, subjects);
    setTimeout(() => this.cache.delete(cacheKey), this.cacheTimeout);

    return subjects;
  }

  /**
   * Recherche de matières par mots-clés RAG
   * Enrichit les résultats avec métadonnées UI locales
   */
  async searchSubjectsByKeywords(keywords: string[], level?: EducationLevelType): Promise<EducationSubject[]> {
    const response: SearchSubjectsResponse = await apiClient.post('/api/education/search', {
      keywords,
      level
    });

    // Enrichit avec métadonnées UI locales
    return (response.subjects || []).map((rag) => {
      const metadata = enrichSubjectKey(rag.key);
      return {
        key: rag.key,
        name: metadata.name,
        description: metadata.description,
        emoji: metadata.emoji,
        color: metadata.color,
        ragKeywords: metadata.ragKeywords,
        ttsLanguage: metadata.ttsLanguage,
      };
    });
  }

  /**
   * Enrichit les clés de matières avec métadonnées UI
   * Utilisé quand on a des clés brutes à enrichir
   */
  enrichSubjects(subjectKeys: string[]): EducationSubject[] {
    return subjectKeys.map((key) => {
      const metadata = enrichSubjectKey(key);
      return {
        key,
        name: metadata.name,
        description: metadata.description,
        emoji: metadata.emoji,
        color: metadata.color,
        ragKeywords: metadata.ragKeywords,
        ttsLanguage: metadata.ttsLanguage,
      };
    });
  }

  /**
   * Invalide le cache
   */
  invalidateCache(pattern?: string): void {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }
}

// Export singleton
export const educationService = EducationServiceFrontend.getInstance();
export default educationService;
