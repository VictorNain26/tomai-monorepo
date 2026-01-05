/**
 * Establishment Hooks - TanStack Query hooks for Pronote school search
 *
 * Flow: User searches school by name → Select school → Get Pronote URL via coordinates
 * Uses: Annuaire de l'Éducation (data.education.gouv.fr) + Index Education API
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

// =============================================
// Types
// =============================================

/** School from French government API (Annuaire de l'Éducation) */
export interface School {
  id: string;
  name: string;
  type: string;
  city: string;
  postalCode: string;
  latitude: number;
  longitude: number;
}

/** Pronote school from Index Education API */
export interface PronoteSchool {
  name: string;
  url: string;
  postalCode: string;
}

interface GovApiResponse {
  results: Array<{
    identifiant_de_l_etablissement: string;
    nom_etablissement: string;
    type_etablissement: string;
    nom_commune: string;
    code_postal: string;
    position: { lon: number; lat: number };
  }>;
}

interface PronoteSearchResponse {
  success: boolean;
  schools: PronoteSchool[];
}

// =============================================
// Hooks
// =============================================

/**
 * Search schools by name (French gov API - Annuaire de l'Éducation)
 * Returns schools with city for disambiguation
 */
export function useSchoolSearch(query: string) {
  return useQuery({
    queryKey: ['schools', 'search', query],
    queryFn: async (): Promise<School[]> => {
      if (query.length < 3) return [];

      // Search in French gov education directory
      const params = new URLSearchParams({
        limit: '20',
        where: `nom_etablissement LIKE "${query}"`,
        select: 'identifiant_de_l_etablissement,nom_etablissement,type_etablissement,nom_commune,code_postal,position',
      });

      const response = await fetch(
        `https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-annuaire-education/records?${params}`
      );

      if (!response.ok) return [];

      const data: GovApiResponse = await response.json();

      return data.results
        .filter((r) => r.position?.lat && r.position?.lon)
        .map((r) => ({
          id: r.identifiant_de_l_etablissement,
          name: r.nom_etablissement,
          type: r.type_etablissement,
          city: r.nom_commune,
          postalCode: r.code_postal,
          latitude: r.position.lat,
          longitude: r.position.lon,
        }));
    },
    enabled: query.length >= 3,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

/**
 * Get Pronote URL for a school using its coordinates
 * Matches the closest school from Index Education API
 */
export function usePronoteUrl(school: School | null) {
  return useQuery({
    queryKey: ['pronote', 'url', school?.id],
    queryFn: async (): Promise<PronoteSchool | null> => {
      if (!school) return null;

      const response = await apiClient.post<PronoteSearchResponse>(
        '/api/pronote/schools/search',
        { latitude: school.latitude, longitude: school.longitude }
      );

      if (!response.success || response.schools.length === 0) return null;

      // Return the closest match (first result, sorted by distance)
      return response.schools[0];
    },
    enabled: !!school,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}
