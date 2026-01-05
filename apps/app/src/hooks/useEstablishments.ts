/**
 * Establishment Hooks - TanStack Query hooks for Pronote school search
 *
 * Flow: User enters city/postal code → Get coordinates → Search nearby schools
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

// =============================================
// Types
// =============================================

export interface PronoteSchool {
  name: string;
  url: string;
  distance: number;
  postalCode: string;
}

export interface City {
  name: string;
  postalCode: string;
  latitude: number;
  longitude: number;
}

interface SearchResponse {
  success: boolean;
  schools: PronoteSchool[];
  count: number;
}

interface GeoGouvResult {
  centre: { coordinates: [number, number] };
  nom: string;
  codesPostaux: string[];
}

// =============================================
// Hooks
// =============================================

/**
 * Search cities by name or postal code (French gov API)
 */
export function useCitySearch(query: string) {
  return useQuery({
    queryKey: ['cities', query],
    queryFn: async (): Promise<City[]> => {
      if (query.length < 2) return [];

      const isPostalCode = /^\d{2,5}$/.test(query);
      const endpoint = isPostalCode
        ? `https://geo.api.gouv.fr/communes?codePostal=${query}&fields=centre,nom,codesPostaux&limit=10`
        : `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(query)}&fields=centre,nom,codesPostaux&boost=population&limit=10`;

      const response = await fetch(endpoint);
      if (!response.ok) return [];

      const results: GeoGouvResult[] = await response.json();
      return results
        .filter((r) => r.centre?.coordinates)
        .map((r) => ({
          name: r.nom,
          postalCode: r.codesPostaux[0] ?? '',
          longitude: r.centre.coordinates[0],
          latitude: r.centre.coordinates[1],
        }));
    },
    enabled: query.length >= 2,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

/**
 * Search schools near a city
 */
export function useSchoolSearch(city: City | null) {
  return useQuery({
    queryKey: ['schools', city?.latitude, city?.longitude],
    queryFn: async (): Promise<PronoteSchool[]> => {
      if (!city) return [];

      const response = await apiClient.post<SearchResponse>(
        '/api/pronote/schools/search',
        { latitude: city.latitude, longitude: city.longitude }
      );

      return response.success ? response.schools : [];
    },
    enabled: !!city,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
