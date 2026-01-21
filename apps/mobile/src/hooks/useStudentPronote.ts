/**
 * useStudentPronote Hook
 *
 * Read-only Pronote access for students.
 * Connection is managed by parents (parent-based architecture).
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@repo/api';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Types matching backend pronote.service.ts exactly
 * Date fields are serialized as ISO strings in JSON
 */

export interface StudentPronoteStatus {
  isConnected: boolean;
  establishmentName?: string;
  pronoteChildName?: string;
  className?: string;
}

export interface PronoteHomework {
  id: string;
  subject: string;
  description: string;
  dueDate: string; // Date serialized as ISO string
  done: boolean;
  difficulty: number;
  estimatedMinutes?: number;
}

export interface PronoteGrade {
  id: string;
  subject: string;
  value: number | null; // Can be null for ungraded
  outOf: number;
  coefficient: number;
  date: string; // Date serialized as ISO string
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
  startDate: string; // Date serialized as ISO string
  endDate: string; // Date serialized as ISO string
  canceled: boolean;
  status?: string;
}

// ============================================================================
// QUERY KEYS
// ============================================================================

const queryKeys = {
  status: ['studentPronote', 'status'] as const,
  homework: (week: number) => ['studentPronote', 'homework', week] as const,
  grades: ['studentPronote', 'grades'] as const,
  timetable: (week: number) => ['studentPronote', 'timetable', week] as const,
};

// ============================================================================
// HOOKS
// ============================================================================

/** Get Pronote connection status for current student */
export function useStudentPronoteStatus(enabled = true) {
  return useQuery({
    queryKey: queryKeys.status,
    queryFn: async (): Promise<StudentPronoteStatus> => {
      return apiClient.get('/api/pronote/student/status');
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/** Get homework for current student */
export function useStudentHomework(weekOffset = 0, enabled = true) {
  return useQuery({
    queryKey: queryKeys.homework(weekOffset),
    queryFn: async (): Promise<PronoteHomework[]> => {
      const response = await apiClient.get<{ homework: PronoteHomework[] }>(
        '/api/pronote/student/homework',
        { params: { weekOffset } }
      );
      return response.homework;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/** Get grades for current student */
export function useStudentGrades(enabled = true) {
  return useQuery({
    queryKey: queryKeys.grades,
    queryFn: async (): Promise<PronoteGrade[]> => {
      const response = await apiClient.get<{ grades: PronoteGrade[] }>(
        '/api/pronote/student/grades'
      );
      return response.grades;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/** Get timetable for current student */
export function useStudentTimetable(weekOffset = 0, enabled = true) {
  return useQuery({
    queryKey: queryKeys.timetable(weekOffset),
    queryFn: async (): Promise<PronoteTimetableEntry[]> => {
      const response = await apiClient.get<{ timetable: PronoteTimetableEntry[] }>(
        '/api/pronote/student/timetable',
        { params: { weekOffset } }
      );
      return response.timetable;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/** Combined hook for student Pronote section */
export function useStudentPronote() {
  const statusQuery = useStudentPronoteStatus();
  const isConnected = statusQuery.data?.isConnected ?? false;

  const homeworkQuery = useStudentHomework(0, isConnected);
  const gradesQuery = useStudentGrades(isConnected);

  // Calculate stats
  const upcomingHomework =
    homeworkQuery.data?.filter((h) => !h.done).length ?? 0;

  // Filter out null values for average calculation
  const validGrades = gradesQuery.data?.filter((g) => g.value !== null) ?? [];
  const averageGrade =
    validGrades.length > 0
      ? validGrades.reduce((sum, g) => sum + ((g.value as number) / g.outOf) * 20, 0) /
        validGrades.length
      : null;

  return {
    // Status
    isConnected,
    establishmentName: statusQuery.data?.establishmentName,
    studentName: statusQuery.data?.pronoteChildName,
    className: statusQuery.data?.className,

    // Data
    homework: homeworkQuery.data ?? [],
    grades: gradesQuery.data ?? [],

    // Stats
    upcomingHomework,
    averageGrade,

    // Loading
    isLoading: statusQuery.isLoading,
    isLoadingData: homeworkQuery.isLoading || gradesQuery.isLoading,
  };
}
