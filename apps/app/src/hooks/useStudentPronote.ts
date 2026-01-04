/**
 * Student Pronote Hooks - TanStack Query hooks for student Pronote API
 *
 * Read-only access to Pronote data for students.
 * Connection is managed by parents (parent-based architecture).
 * Students access their data via parent's child mapping.
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

// =============================================
// Types
// =============================================

/** Student connection status (via parent mapping) */
export interface StudentPronoteStatus {
  connected: boolean;
  status?: 'active' | 'expired' | 'disconnected';
  establishmentName?: string;
  studentName?: string;
  className?: string;
  error?: string;
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
// Hooks - Read-only access for students
// =============================================

/**
 * Get Pronote connection status for the current student
 * Returns whether the student is mapped to Pronote via parent
 */
export function useStudentPronoteStatus(enabled = true) {
  return useQuery({
    queryKey: ['studentPronote', 'status'],
    queryFn: async (): Promise<StudentPronoteStatus> => {
      const response = await apiClient.get<StudentPronoteStatus>(
        '/api/pronote/student/status'
      );
      return response;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

/**
 * Get homework for the current student
 */
export function useStudentHomework(weekOffset = 0, enabled = true) {
  return useQuery({
    queryKey: ['studentPronote', 'homework', weekOffset],
    queryFn: async (): Promise<PronoteHomework[]> => {
      const response = await apiClient.get<{
        homework: PronoteHomework[];
        weekOffset: number;
        count: number;
      }>('/api/pronote/student/homework', {
        params: { weekOffset },
      });
      return response.homework;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

/**
 * Get grades for the current student
 */
export function useStudentGrades(enabled = true) {
  return useQuery({
    queryKey: ['studentPronote', 'grades'],
    queryFn: async (): Promise<PronoteGrade[]> => {
      const response = await apiClient.get<{
        grades: PronoteGrade[];
        count: number;
      }>('/api/pronote/student/grades');
      return response.grades;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

/**
 * Get timetable for the current student
 */
export function useStudentTimetable(weekOffset = 0, enabled = true) {
  return useQuery({
    queryKey: ['studentPronote', 'timetable', weekOffset],
    queryFn: async (): Promise<PronoteTimetableEntry[]> => {
      const response = await apiClient.get<{
        timetable: PronoteTimetableEntry[];
        weekOffset: number;
        count: number;
      }>('/api/pronote/student/timetable', {
        params: { weekOffset },
      });
      return response.timetable;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}
