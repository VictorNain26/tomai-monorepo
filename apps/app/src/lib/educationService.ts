/**
 * EDUCATION SERVICE FRONTEND - Tom
 * Service frontend unifié qui communique avec le backend educationService
 * Remplace TOUTES les APIs obsolètes et mappings hardcodés
 */

import { apiClient } from './api-client';
import { logger } from './logger';
import type {
  EducationLevelType,
  EducationSubject,
  SubjectsAPIResponse,
  ISubjectsForStudent
} from '@/types';

interface SearchSubjectsResponse {
  subjects: EducationSubject[];
}

export interface LevelConfiguration {
  level: EducationLevelType;
  subjects: EducationSubject[];
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
   * Obtient la configuration complète pour un niveau
   * Récupère depuis PostgreSQL document_chunks + enrichissement backend
   */
  async getLevelConfiguration(level: EducationLevelType): Promise<LevelConfiguration> {
    const cacheKey = `level:${level}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) as LevelConfiguration;
    }

    try {
      // ✅ ENDPOINT CORRIGÉ : /api/subjects/:level (backend educationService)
      const response: SubjectsAPIResponse = await apiClient.get(`/api/subjects/${level}`);

      const config: LevelConfiguration = {
        level,
        subjects: response.subjects
      };

      this.cache.set(cacheKey, config);
      setTimeout(() => this.cache.delete(cacheKey), this.cacheTimeout);

      return config;
    } catch (error) {
      logger.error(`Failed to fetch subjects for ${level}`, {
        operation: 'education-service',
        level,
        error: error instanceof Error ? error.message : String(error)
      });

      // ⚠️ FALLBACK : Retourner liste vide si aucune donnée disponible
      // Le StudentDashboard gérera l'affichage d'un message approprié
      const fallbackConfig: LevelConfiguration = {
        level,
        subjects: []
      };

      // Ne pas mettre en cache le fallback (retry à la prochaine requête)
      return fallbackConfig;
    }
  }

  /**
   * Obtient toutes les matières disponibles pour un niveau
   * Avec déduplication pour éviter les doublons entre API et fallback
   */
  async getAllSubjects(level: EducationLevelType): Promise<EducationSubject[]> {
    const config = await this.getLevelConfiguration(level);

    // ✅ DÉDUPLICATION FINALE - Garantit l'absence de doublons
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
   * Remplace: useChildSubjects hook
   */
  async getChildSubjects(childId: string): Promise<ISubjectsForStudent> {
    const cacheKey = `child:${childId}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) as ISubjectsForStudent;
    }

    try {
      const response: SubjectsAPIResponse = await apiClient.get(`/api/parent/children/${childId}/subjects`);

      const subjects: ISubjectsForStudent = {
        subjects: response.subjects
      };

      this.cache.set(cacheKey, subjects);
      setTimeout(() => this.cache.delete(cacheKey), this.cacheTimeout);

      return subjects;
    } catch (error) {
      logger.error(`Failed to fetch child subjects for ${childId}`, {
        operation: 'education-service',
        childId,
        error: error instanceof Error ? error.message : String(error)
      });

      // ⚠️ FALLBACK VIDE : L'API doit être disponible
      // Retourner liste vide pour forcer l'affichage d'un message approprié
      const fallbackSubjects: ISubjectsForStudent = {
        subjects: []
      };

      // Ne pas mettre en cache le fallback (retry à la prochaine requête)
      return fallbackSubjects;
    }
  }

  /**
   * Recherche de matières par mots-clés RAG
   * Remplace: subjectEnrichment hardcodé
   */
  async searchSubjectsByKeywords(keywords: string[], level?: EducationLevelType): Promise<EducationSubject[]> {
    try {
      const response: SearchSubjectsResponse = await apiClient.post('/api/education/search', {
        keywords,
        level
      });
      return response.subjects || [];
    } catch {
      // Error logged by apiClient
      return [];
    }
  }

  /**
   * Obtient l'enrichissement UI des matières
   * Les données sont déjà enrichies par le RAG depuis le backend
   */
  async getSubjectEnrichment(subjects: EducationSubject[]): Promise<EducationSubject[]> {
    // Les données sont déjà enrichies depuis le RAG backend
    return subjects;
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
