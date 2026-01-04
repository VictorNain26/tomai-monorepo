/**
 * Establishment Hooks - TanStack Query hooks for establishment search API
 *
 * Used by ConnectPronote modal to search for schools and get RNE codes.
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

// =============================================
// Types
// =============================================

export interface Establishment {
  id: string;
  name: string;
  city: string;
  rne: string;
  postalCode?: string;
  department?: string;
  type?: 'college' | 'lycee' | 'primaire';
}

interface SearchResponse {
  success: boolean;
  data?: {
    establishments: Array<{
      id: string;
      name: string;
      city: string;
      rne: string;
      postalCode?: string;
      department?: string;
      type?: string;
    }>;
    total: number;
    query: string;
  };
  _error?: string;
}

// =============================================
// Hooks
// =============================================

/**
 * Search establishments by name
 * Debounced query - only searches when query >= 3 characters
 */
export function useEstablishmentSearch(query: string) {
  return useQuery({
    queryKey: ['establishments', 'search', query],
    queryFn: async (): Promise<Establishment[]> => {
      if (!query || query.trim().length < 3) {
        return [];
      }

      const response = await apiClient.post<SearchResponse>(
        '/api/establishments/search',
        { query: query.trim(), limit: 10 }
      );

      if (!response.success || !response.data) {
        return [];
      }

      return response.data.establishments.map((est) => ({
        id: est.id,
        name: est.name,
        city: est.city,
        rne: est.rne,
        postalCode: est.postalCode,
        department: est.department,
        type: est.type as Establishment['type'],
      }));
    },
    enabled: query.trim().length >= 3,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000,
  });
}

/**
 * Validate RNE code and get Pronote URL
 */
export function useValidateRne(rne: string | null) {
  return useQuery({
    queryKey: ['establishments', 'validate', rne],
    queryFn: async () => {
      if (!rne) return null;

      const response = await apiClient.post<{
        success: boolean;
        rne: string;
        isValid: boolean;
        pronoteUrl?: string;
        establishment?: Establishment;
      }>('/api/establishments/validate', { rne });

      return response;
    },
    enabled: !!rne && rne.length === 8,
    staleTime: 30 * 60 * 1000, // 30 minutes (RNE validation is stable)
    gcTime: 60 * 60 * 1000,
  });
}
