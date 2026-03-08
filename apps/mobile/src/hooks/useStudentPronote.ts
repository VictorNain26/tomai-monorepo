/**
 * useStudentPronote Hook
 *
 * Read-only Pronote access for students.
 * Connection is managed by parents (parent-based architecture).
 */

import { useQuery } from '@tanstack/react-query';
import { getTreaty, unwrap } from '@repo/api';

// ============================================================================
// TYPES
// ============================================================================

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
  status: ['studentPronote', 'status'] as const,
  homework: (week: number) => ['studentPronote', 'homework', week] as const,
  grades: ['studentPronote', 'grades'] as const,
  timetable: (week: number) => ['studentPronote', 'timetable', week] as const,
};

// ============================================================================
// HOOKS
// ============================================================================

export function useStudentPronoteStatus(enabled = true) {
  return useQuery({
    queryKey: queryKeys.status,
    queryFn: async (): Promise<StudentPronoteStatus> => {
      return unwrap(
        await getTreaty().api.pronote.student.status.get()
      ) as StudentPronoteStatus;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useStudentHomework(weekOffset = 0, enabled = true) {
  return useQuery({
    queryKey: queryKeys.homework(weekOffset),
    queryFn: async (): Promise<PronoteHomework[]> => {
      const response = unwrap(
        await getTreaty().api.pronote.student.homework.get({
          query: { weekOffset },
        })
      );
      return (response as { homework: PronoteHomework[] }).homework;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useStudentGrades(enabled = true) {
  return useQuery({
    queryKey: queryKeys.grades,
    queryFn: async (): Promise<PronoteGrade[]> => {
      const response = unwrap(
        await getTreaty().api.pronote.student.grades.get()
      );
      return (response as { grades: PronoteGrade[] }).grades;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useStudentTimetable(weekOffset = 0, enabled = true) {
  return useQuery({
    queryKey: queryKeys.timetable(weekOffset),
    queryFn: async (): Promise<PronoteTimetableEntry[]> => {
      const response = unwrap(
        await getTreaty().api.pronote.student.timetable.get({
          query: { weekOffset },
        })
      );
      return (response as { timetable: PronoteTimetableEntry[] }).timetable;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useStudentPronote() {
  const statusQuery = useStudentPronoteStatus();
  const isConnected = statusQuery.data?.isConnected ?? false;

  const homeworkQuery = useStudentHomework(0, isConnected);
  const gradesQuery = useStudentGrades(isConnected);

  const upcomingHomework =
    homeworkQuery.data?.filter((h) => !h.done).length ?? 0;

  const validGrades = gradesQuery.data?.filter((g) => g.value !== null) ?? [];
  const averageGrade =
    validGrades.length > 0
      ? validGrades.reduce((sum, g) => sum + ((g.value as number) / g.outOf) * 20, 0) /
        validGrades.length
      : null;

  return {
    isConnected,
    establishmentName: statusQuery.data?.establishmentName,
    studentName: statusQuery.data?.pronoteChildName,
    className: statusQuery.data?.className,

    homework: homeworkQuery.data ?? [],
    grades: gradesQuery.data ?? [],

    upcomingHomework,
    averageGrade,

    isLoading: statusQuery.isLoading,
    isLoadingData: homeworkQuery.isLoading || gradesQuery.isLoading,
  };
}
