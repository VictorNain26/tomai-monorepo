/**
 * Establishment Hooks - TanStack Query hooks for Pronote school search
 *
 * Uses the Index Education API (via backend) to search schools by geolocation.
 * No local database - real-time search like Papillon app.
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

interface SearchResponse {
  success: boolean;
  schools: PronoteSchool[];
  count: number;
  error?: string;
}

// =============================================
// Hooks
// =============================================

/**
 * Search schools by geolocation
 * Requires GPS coordinates (latitude, longitude)
 */
export function useSchoolSearch(latitude: number | null, longitude: number | null) {
  return useQuery({
    queryKey: ['schools', 'search', latitude, longitude],
    queryFn: async (): Promise<PronoteSchool[]> => {
      if (latitude === null || longitude === null) {
        return [];
      }

      const response = await apiClient.post<SearchResponse>(
        '/api/pronote/schools/search',
        { latitude, longitude }
      );

      if (!response.success) {
        return [];
      }

      return response.schools;
    },
    enabled: latitude !== null && longitude !== null,
    staleTime: 10 * 60 * 1000, // 10 minutes (location-based, relatively stable)
    gcTime: 30 * 60 * 1000,
  });
}

/**
 * Get user's current GPS position
 * Returns coordinates or null if not available/denied
 */
export function useGeolocation() {
  return useQuery({
    queryKey: ['geolocation'],
    queryFn: async (): Promise<{ latitude: number; longitude: number } | null> => {
      if (!navigator.geolocation) {
        return null;
      }

      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          },
          () => {
            // User denied or error - return null
            resolve(null);
          },
          {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 5 * 60 * 1000, // Cache for 5 minutes
          }
        );
      });
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: false,
  });
}
