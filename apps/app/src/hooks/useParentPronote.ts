/**
 * Parent Pronote Hooks - TanStack Query hooks for parent Pronote API
 *
 * Parent-based architecture:
 * - One Pronote connection per parent (not per child)
 * - Parent maps Pronote children to TomAI children
 * - Children access data via parent's mapping
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, PRONOTE_TIMEOUT } from '@/lib/api-client';

// =============================================
// Types
// =============================================

/** Pronote resource (child in parent account) */
export interface PronoteResource {
  index: number;
  name: string;
  className?: string;
  schoolName?: string;
}

/** Parent connection status response */
export interface ParentConnectionStatus {
  connected: boolean;
  status?: 'active' | 'expired' | 'disconnected';
  establishmentName?: string;
  resources?: PronoteResource[];
  lastSync?: string;
  error?: string;
}

/** Connect request */
export interface PronoteConnectRequest {
  qrCodeJson: string;
  pin: string;
  establishmentName: string;
}

/** Connect response */
export interface PronoteConnectResponse {
  success: boolean;
  establishmentName?: string;
  resources?: PronoteResource[];
  message?: string;
  error?: string;
}

/** Child mapping input */
export interface ChildMappingInput {
  childId: string;
  resourceIndex: number;
  pronoteChildName: string;
  pronoteClassName?: string;
}

/** Child mapping from API */
export interface ChildMapping {
  childId: string;
  childName: string;
  resourceIndex: number;
  pronoteChildName: string;
  pronoteClassName?: string;
  createdAt: string;
}

/** Homework item */
export interface PronoteHomework {
  id: string;
  subject: string;
  description: string;
  dueDate: string;
  done: boolean;
}

/** Grade item */
export interface PronoteGrade {
  id: string;
  subject: string;
  value: number;
  outOf: number;
  coefficient: number;
  date: string;
  description?: string;
}

/** Timetable entry */
export interface PronoteTimetableEntry {
  id: string;
  subject: string;
  teacher?: string;
  room?: string;
  startTime: string;
  endTime: string;
  status?: 'normal' | 'cancelled' | 'modified';
}

// =============================================
// Parent Connection Management
// =============================================

/**
 * Get parent's Pronote connection status
 */
export function useParentPronoteStatus() {
  return useQuery({
    queryKey: ['parentPronote', 'status'],
    queryFn: async (): Promise<ParentConnectionStatus> => {
      const response = await apiClient.get<ParentConnectionStatus>(
        '/api/pronote/status'
      );
      return response;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

/**
 * Connect parent Pronote account via QR code
 */
export function useConnectPronote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PronoteConnectRequest): Promise<PronoteConnectResponse> => {
      const response = await apiClient.post<PronoteConnectResponse>(
        '/api/pronote/connect',
        {
          qrCodeJson: data.qrCodeJson,
          pin: data.pin,
          establishmentName: data.establishmentName,
        },
        { timeout: PRONOTE_TIMEOUT } // Extended timeout for external Pronote server
      );
      return response;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['parentPronote'],
      });
    },
  });
}

/**
 * Create child mappings (Pronote → TomAI)
 */
export function useCreateChildMappings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      mappings: ChildMappingInput[]
    ): Promise<{ success: boolean; message?: string; error?: string }> => {
      const response = await apiClient.post<{ success: boolean; message?: string; error?: string }>(
        '/api/pronote/mappings',
        { mappings }
      );
      return response;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['parentPronote'],
      });
    },
  });
}

/**
 * Get current child mappings
 */
export function useChildMappings() {
  return useQuery({
    queryKey: ['parentPronote', 'mappings'],
    queryFn: async (): Promise<ChildMapping[]> => {
      const response = await apiClient.get<{ mappings: ChildMapping[] }>(
        '/api/pronote/mappings'
      );
      return response.mappings;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

/**
 * Disconnect parent from Pronote
 */
export function useDisconnectPronote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<{ success: boolean; message?: string }> => {
      const response = await apiClient.delete<{ success: boolean; message?: string }>(
        '/api/pronote/disconnect'
      );
      return response;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['parentPronote'],
      });
    },
  });
}

// =============================================
// Child Data Queries (via mapping)
// =============================================

/**
 * Get homework for a child
 */
export function useChildHomework(childId?: string, weekOffset: number = 0) {
  return useQuery({
    queryKey: ['parentPronote', 'homework', childId, weekOffset],
    queryFn: async (): Promise<PronoteHomework[]> => {
      if (!childId) return [];

      const response = await apiClient.get<{
        homework: PronoteHomework[];
        weekOffset: number;
        count: number;
      }>(`/api/pronote/child/${childId}/homework`, {
        params: { weekOffset },
      });

      return response.homework;
    },
    enabled: !!childId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

/**
 * Get grades for a child
 */
export function useChildGrades(childId?: string) {
  return useQuery({
    queryKey: ['parentPronote', 'grades', childId],
    queryFn: async (): Promise<PronoteGrade[]> => {
      if (!childId) return [];

      const response = await apiClient.get<{
        grades: PronoteGrade[];
        count: number;
      }>(`/api/pronote/child/${childId}/grades`);

      return response.grades;
    },
    enabled: !!childId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

/**
 * Get timetable for a child
 */
export function useChildTimetable(childId?: string, weekOffset: number = 0) {
  return useQuery({
    queryKey: ['parentPronote', 'timetable', childId, weekOffset],
    queryFn: async (): Promise<PronoteTimetableEntry[]> => {
      if (!childId) return [];

      const response = await apiClient.get<{
        timetable: PronoteTimetableEntry[];
        weekOffset: number;
        count: number;
      }>(`/api/pronote/child/${childId}/timetable`, {
        params: { weekOffset },
      });

      return response.timetable;
    },
    enabled: !!childId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}
