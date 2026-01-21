/**
 * useParentPronote Hook
 *
 * Parent-based Pronote integration:
 * - One Pronote connection per parent (not per child)
 * - Parent maps Pronote children to TomAI children
 * - Homework, grades, and timetable access via mappings
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@repo/api';

// ============================================================================
// TYPES (aligned with backend apps/server/src/services/pronote.service.ts)
// ============================================================================

/** Pronote resource (child in parent account) - from DB schema PronoteResource */
export interface PronoteResource {
  name: string;
  id: string;
  className?: string;
}

/** Parent connection status - from pronoteService.getParentConnectionStatus() */
export interface ParentConnectionStatus {
  connected: boolean;
  status?: string; // 'active' | 'expired' | 'error' | 'disconnected'
  establishmentName?: string;
  resources?: PronoteResource[];
  lastSyncAt?: string; // ISO string (Date from backend)
  error?: string;
}

/** Child mapping (Pronote student → TomAI child) - from pronoteService.getChildMappings() */
export interface ChildMapping {
  childId: string;
  childName: string;
  resourceIndex: number;
  pronoteChildName: string;
  pronoteClassName?: string;
  // Note: backend doesn't return createdAt
}

/** Connect request - body for POST /api/pronote/connect */
export interface PronoteConnectRequest {
  qrCodeJson: string;
  pin: string;
  establishmentName: string;
}

/** Homework item - from pronoteService.PronoteHomework */
export interface PronoteHomework {
  id: string;
  subject: string;
  description: string;
  dueDate: string; // ISO string (Date from backend)
  done: boolean;
  difficulty: number;
  estimatedMinutes?: number;
}

/** Grade item - from pronoteService.PronoteGrade */
export interface PronoteGrade {
  id: string;
  subject: string;
  value: number | null; // null when grade is absent/not applicable
  outOf: number;
  coefficient: number;
  date: string; // ISO string (Date from backend)
  description: string;
  average?: number;
  max?: number;
  min?: number;
}

/** Timetable entry - from pronoteService.PronoteTimetableEntry */
export interface PronoteTimetableEntry {
  id: string;
  subject?: string;
  teacherNames: string[];
  classrooms: string[];
  startDate: string; // ISO string (Date from backend)
  endDate: string; // ISO string (Date from backend)
  canceled: boolean;
  status?: string;
}

// ============================================================================
// QUERY KEYS
// ============================================================================

const queryKeys = {
  all: ['parentPronote'] as const,
  status: ['parentPronote', 'status'] as const,
  mappings: ['parentPronote', 'mappings'] as const,
  homework: (childId: string, week: number) =>
    ['parentPronote', 'homework', childId, week] as const,
  grades: (childId: string) => ['parentPronote', 'grades', childId] as const,
  timetable: (childId: string, week: number) =>
    ['parentPronote', 'timetable', childId, week] as const,
};

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function fetchStatus(): Promise<ParentConnectionStatus> {
  return apiClient.get('/api/pronote/status');
}

async function fetchMappings(): Promise<ChildMapping[]> {
  const response = await apiClient.get<{ mappings: ChildMapping[] }>(
    '/api/pronote/mappings'
  );
  return response.mappings;
}

async function connectPronote(
  data: PronoteConnectRequest
): Promise<{ success: boolean; message?: string; error?: string }> {
  return apiClient.post('/api/pronote/connect', data, { timeout: 60000 });
}

async function disconnectPronote(): Promise<{ success: boolean }> {
  return apiClient.delete('/api/pronote/disconnect');
}

async function fetchHomework(
  childId: string,
  weekOffset: number
): Promise<PronoteHomework[]> {
  const response = await apiClient.get<{ homework: PronoteHomework[] }>(
    `/api/pronote/child/${childId}/homework`,
    { params: { weekOffset } }
  );
  return response.homework;
}

async function fetchGrades(childId: string): Promise<PronoteGrade[]> {
  const response = await apiClient.get<{ grades: PronoteGrade[] }>(
    `/api/pronote/child/${childId}/grades`
  );
  return response.grades;
}

async function fetchTimetable(
  childId: string,
  weekOffset: number
): Promise<PronoteTimetableEntry[]> {
  const response = await apiClient.get<{ timetable: PronoteTimetableEntry[] }>(
    `/api/pronote/child/${childId}/timetable`,
    { params: { weekOffset } }
  );
  return response.timetable;
}

// ============================================================================
// HOOKS
// ============================================================================

/** Get parent's Pronote connection status */
export function useParentPronoteStatus() {
  return useQuery({
    queryKey: queryKeys.status,
    queryFn: fetchStatus,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/** Get current child mappings */
export function useChildMappings() {
  return useQuery({
    queryKey: queryKeys.mappings,
    queryFn: fetchMappings,
    staleTime: 5 * 60 * 1000,
  });
}

/** Connect parent Pronote account via QR code */
export function useConnectPronote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: connectPronote,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.all });
    },
  });
}

/** Disconnect parent from Pronote */
export function useDisconnectPronote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: disconnectPronote,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.all });
    },
  });
}

/** Get homework for a child */
export function useChildHomework(childId?: string, weekOffset = 0) {
  return useQuery({
    queryKey: queryKeys.homework(childId ?? '', weekOffset),
    queryFn: () => fetchHomework(childId!, weekOffset),
    enabled: !!childId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Get grades for a child */
export function useChildGrades(childId?: string) {
  return useQuery({
    queryKey: queryKeys.grades(childId ?? ''),
    queryFn: () => fetchGrades(childId!),
    enabled: !!childId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Get timetable for a child */
export function useChildTimetable(childId?: string, weekOffset = 0) {
  return useQuery({
    queryKey: queryKeys.timetable(childId ?? '', weekOffset),
    queryFn: () => fetchTimetable(childId!, weekOffset),
    enabled: !!childId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Combined hook for child detail page */
export function useChildPronote(childId?: string) {
  const statusQuery = useParentPronoteStatus();
  const mappingsQuery = useChildMappings();

  // Find mapping for this specific child
  const childMapping =
    childId && mappingsQuery.data
      ? mappingsQuery.data.find((m) => m.childId === childId) ?? null
      : null;

  const isConnected = statusQuery.data?.connected ?? false;
  const isMapped = isConnected && childMapping !== null;

  return {
    // Status
    isConnected,
    isMapped,
    establishmentName: statusQuery.data?.establishmentName,
    lastSyncAt: statusQuery.data?.lastSyncAt,
    resources: statusQuery.data?.resources ?? [],

    // Child mapping
    childMapping,

    // Loading
    isLoading: statusQuery.isLoading || mappingsQuery.isLoading,

    // Refresh
    refresh: () => {
      void statusQuery.refetch();
      void mappingsQuery.refetch();
    },
  };
}
