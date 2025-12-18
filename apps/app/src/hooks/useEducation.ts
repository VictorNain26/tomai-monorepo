/**
 * HOOK EDUCATION UNIFIÉ - Tom
 * Hook unique qui remplace useChildSubjects, useSubjectsPreview, useSubjectsPreviewLegacy
 * Utilise le service educationService frontend unifié
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { educationService } from '@/lib/educationService';
import type {
  EducationLevelType,
  EducationSubject,
  ISubjectsForStudent,
  Lv2Option
} from '@/types';

/**
 * Hook pour obtenir la configuration d'un niveau scolaire avec support LV2
 * Remplace: useSubjectsPreview, useSubjectsPreviewLegacy
 * @param level - Niveau scolaire
 * @param selectedLv2 - LV2 sélectionnée (optionnel, pour niveaux >= 5ème)
 */
export function useEducationLevel(level?: EducationLevelType, selectedLv2?: Lv2Option | null) {
  return useQuery({
    queryKey: ['education', 'level', level, selectedLv2 ?? 'none'],
    queryFn: async () => {
      if (!level) throw new Error('Level is required');
      return await educationService.getLevelConfiguration(level, selectedLv2);
    },
    enabled: !!level,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook pour obtenir toutes les matières d'un niveau avec support LV2
 * Avec déduplication côté client pour éviter les doublons d'affichage
 * @param level - Niveau scolaire
 * @param selectedLv2 - LV2 sélectionnée (optionnel, pour niveaux >= 5ème)
 */
export function useAllSubjects(level?: EducationLevelType, selectedLv2?: Lv2Option | null) {
  return useQuery({
    queryKey: ['education', 'subjects', 'all', level, selectedLv2 ?? 'none'],
    queryFn: async (): Promise<EducationSubject[]> => {
      if (!level) throw new Error('Level is required');
      const subjects = await educationService.getAllSubjects(level, selectedLv2);

      // Déduplication côté client - Sécurité anti-doublons
      const deduplicatedSubjects = subjects.reduce<EducationSubject[]>((acc, subject) => {
        const exists = acc.find(s => s.key === subject.key);
        if (!exists) {
          acc.push(subject);
        }
        return acc;
      }, []);

      return deduplicatedSubjects;
    },
    enabled: !!level,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Hook pour gérer les matières d'un enfant
 * Remplace: useChildSubjects complet
 */
export function useChildEducation(childId?: string) {
  // Query pour récupérer les matières de l'enfant
  const subjectsQuery = useQuery({
    queryKey: ['education', 'child', childId],
    queryFn: async (): Promise<ISubjectsForStudent> => {
      if (!childId) throw new Error('Child ID is required');
      return await educationService.getChildSubjects(childId);
    },
    enabled: !!childId,
    staleTime: 5 * 60 * 1000,
  });

  return {
    // Data
    subjects: subjectsQuery.data,

    // Loading states
    isLoading: subjectsQuery.isPending,

    // Error states
    error: subjectsQuery.error,

    // Utils
    refetch: subjectsQuery.refetch,
  };
}

/**
 * Hook pour la recherche de matières par mots-clés RAG
 */
export function useSearchSubjects() {
  return useMutation({
    mutationFn: async ({ keywords, level }: { keywords: string[]; level?: EducationLevelType }): Promise<EducationSubject[]> => {
      return await educationService.searchSubjectsByKeywords(keywords, level);
    },
    onError: (error: Error) => {
      toast.error(`Erreur de recherche: ${error.message}`);
    },
  });
}

/**
 * Hook pour obtenir l'enrichissement UI des matières
 * L'enrichissement est maintenant fait automatiquement dans educationService
 * Ce hook retourne simplement les matières déjà enrichies
 */
export function useSubjectEnrichment(subjects: EducationSubject[]) {
  return useQuery({
    queryKey: ['education', 'enrichment', subjects.map(s => s.key).sort()],
    queryFn: async (): Promise<EducationSubject[]> => {
      // Les sujets sont déjà enrichis par educationService.getLevelConfiguration()
      return subjects;
    },
    enabled: subjects.length > 0,
    staleTime: 15 * 60 * 1000, // 15 minutes
  });
}
