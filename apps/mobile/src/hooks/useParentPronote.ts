/**
 * useParentPronote Hook
 *
 * Parent-based Pronote integration:
 * - One Pronote connection per parent (not per child)
 * - Parent maps Pronote children to TomAI children
 * - Homework, grades, and timetable access via mappings
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTreaty, unwrap } from '@repo/api';

// ============================================================================
// TYPES (aligned with backend apps/server/src/services/pronote.service.ts)
// ============================================================================

export interface PronoteResource {
  name: string;
  id: string;
  className?: string;
}

export interface ParentConnectionStatus {
  connected: boolean;
  status?: string;
  establishmentName?: string;
  resources?: PronoteResource[];
  lastSyncAt?: string;
  error?: string;
}

export interface ChildMapping {
  childId: string;
  childName: string;
  resourceIndex: number;
  pronoteChildName: string;
  pronoteClassName?: string;
}

export interface PronoteConnectRequest {
  qrCodeJson: string;
  pin: string;
  establishmentName: string;
}

export interface PronoteHomework {
  id: string;
  subject: string;
  description: string;
  dueDate: string;
  done: boolean;
  difficulty: number;
  estimatedMinutes?: number;
}

export interface PronoteGrade {
  id: string;
  subject: string;
  value: number | null;
  outOf: number;
  coefficient: number;
  date: string;
  description: string;
  average?: number;
  max?: number;
  min?: number;
}

export interface PronoteTimetableEntry {
  id: string;
  subject?: string;
  teacherNames: string[];
  classrooms: string[];
  startDate: string;
  endDate: string;
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
  return unwrap(await getTreaty().api.pronote.status.get()) as ParentConnectionStatus;
}

async function fetchMappings(): Promise<ChildMapping[]> {
  const response = unwrap(await getTreaty().api.pronote.mappings.get());
  return (response as { mappings: ChildMapping[] }).mappings;
}

async function connectPronote(
  data: PronoteConnectRequest
): Promise<{ success: boolean; message?: string; error?: string }> {
  return unwrap(
    await getTreaty().api.pronote.connect.post(data)
  ) as { success: boolean; message?: string; error?: string };
}

async function disconnectPronote(): Promise<{ success: boolean }> {
  return unwrap(
    await getTreaty().api.pronote.disconnect.delete()
  ) as { success: boolean };
}

export interface CreateMappingRequest {
  childId: string;
  resourceIndex: number;
  pronoteChildName: string;
  pronoteClassName?: string;
}

async function createMappings(
  mappings: CreateMappingRequest[]
): Promise<{ success: boolean; error?: string }> {
  return unwrap(
    await getTreaty().api.pronote.mappings.post({ mappings })
  ) as { success: boolean; error?: string };
}

async function fetchHomework(
  childId: string,
  weekOffset: number
): Promise<PronoteHomework[]> {
  const response = unwrap(
    await getTreaty().api.pronote.child({ childId }).homework.get({
      query: { weekOffset },
    })
  );
  return (response as { homework: PronoteHomework[] }).homework;
}

async function fetchGrades(childId: string): Promise<PronoteGrade[]> {
  const response = unwrap(
    await getTreaty().api.pronote.child({ childId }).grades.get()
  );
  return (response as { grades: PronoteGrade[] }).grades;
}

async function fetchTimetable(
  childId: string,
  weekOffset: number
): Promise<PronoteTimetableEntry[]> {
  const response = unwrap(
    await getTreaty().api.pronote.child({ childId }).timetable.get({
      query: { weekOffset },
    })
  );
  return (response as { timetable: PronoteTimetableEntry[] }).timetable;
}

// ============================================================================
// HOOKS
// ============================================================================

export function useParentPronoteStatus() {
  return useQuery({
    queryKey: queryKeys.status,
    queryFn: fetchStatus,
    staleTime: 5 * 60 * 1000,
  });
}

export function useChildMappings() {
  return useQuery({
    queryKey: queryKeys.mappings,
    queryFn: fetchMappings,
    staleTime: 5 * 60 * 1000,
  });
}

export function useConnectPronote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: connectPronote,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.all });
    },
  });
}

export function useDisconnectPronote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: disconnectPronote,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.all });
    },
  });
}

export function useCreateMappings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createMappings,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.all });
    },
  });
}

export function useChildHomework(childId?: string, weekOffset = 0) {
  return useQuery({
    queryKey: queryKeys.homework(childId ?? '', weekOffset),
    queryFn: () => fetchHomework(childId!, weekOffset),
    enabled: !!childId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useChildGrades(childId?: string) {
  return useQuery({
    queryKey: queryKeys.grades(childId ?? ''),
    queryFn: () => fetchGrades(childId!),
    enabled: !!childId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useChildTimetable(childId?: string, weekOffset = 0) {
  return useQuery({
    queryKey: queryKeys.timetable(childId ?? '', weekOffset),
    queryFn: () => fetchTimetable(childId!, weekOffset),
    enabled: !!childId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useChildPronote(childId?: string) {
  const statusQuery = useParentPronoteStatus();
  const mappingsQuery = useChildMappings();

  const childMapping =
    childId && mappingsQuery.data
      ? mappingsQuery.data.find((m) => m.childId === childId) ?? null
      : null;

  const isConnected = statusQuery.data?.connected ?? false;
  const isMapped = isConnected && childMapping !== null;

  return {
    isConnected,
    isMapped,
    establishmentName: statusQuery.data?.establishmentName,
    lastSyncAt: statusQuery.data?.lastSyncAt,
    resources: statusQuery.data?.resources ?? [],

    childMapping,

    isLoading: statusQuery.isLoading || mappingsQuery.isLoading,

    refresh: () => {
      void statusQuery.refetch();
      void mappingsQuery.refetch();
    },
  };
}
