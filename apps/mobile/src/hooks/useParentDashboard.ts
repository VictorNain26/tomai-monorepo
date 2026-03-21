/**
 * useParentDashboard Hook
 *
 * Fetches children list, dashboard stats, and handles CRUD operations.
 * Uses Eden Treaty for type-safe e2e API calls.
 */

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTreaty, unwrap } from '@repo/api';
import { useUser } from '@/lib/auth';
import type { EducationLevelType } from '@/constants/levels';

// Re-export types for consumers
export type { EducationLevelType } from '@/constants/levels';

// ============================================================================
// TYPES (aligned with backend apps/server/src/types/index.ts)
// ============================================================================

export interface IChild {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  schoolLevel: string;
  dateOfBirth?: string;
  isActive: boolean;
  parentId: string;
  role: 'student';
  createdAt: string;
}

export interface ICreateChildData {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  schoolLevel: string;
  dateOfBirth?: string;
}

export interface ChildMetrics {
  studentId: string;
  studentName: string;
  schoolLevel: string;
  age: number;
  totalSessions: number;
  studyDays: number;
  avgSessionDuration: number;
  avgFrustration: number;
  subjectsStudied: number;
  totalStudyTime: number;
  lastSessionDate: string | null;
}

interface DashboardResponse {
  success: boolean;
  parent: { id: string; name: string };
  children: IChild[];
  metrics: ChildMetrics[];
}

export interface SchoolLevel {
  key: EducationLevelType;
  ragAvailable: boolean;
  subjectsCount: number;
}

interface LevelsResponse {
  success: boolean;
  levels: SchoolLevel[];
  total: number;
  ragAvailableCount: number;
}

// ============================================================================
// QUERY KEYS
// ============================================================================

const queryKeys = {
  parent: {
    dashboard: ['parent', 'dashboard'] as const,
    children: ['parent', 'children'] as const,
  },
  levels: ['education', 'levels'] as const,
};

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function fetchDashboard(): Promise<DashboardResponse> {
  return unwrap(
    await getTreaty().api.parent.dashboard.get()
  ) as DashboardResponse;
}

async function fetchChildren(): Promise<IChild[]> {
  return unwrap(
    await getTreaty().api.parent.children.get()
  ) as IChild[];
}

async function fetchLevels(): Promise<SchoolLevel[]> {
  const response = unwrap(
    await getTreaty().api.education.levels.get()
  ) as LevelsResponse;
  return response.levels.filter((l) => l.ragAvailable);
}

async function createChildApi(data: ICreateChildData): Promise<IChild> {
  return unwrap(
    await getTreaty().api.parent.children.post(data)
  ) as IChild;
}

async function updateChildApi({
  childId,
  data,
}: {
  childId: string;
  data: Partial<Omit<IChild, 'role'>>;
}): Promise<IChild> {
  return unwrap(
    await getTreaty().api.parent.children({ id: childId }).patch(data)
  ) as IChild;
}

async function deleteChildApi(childId: string): Promise<{ success: boolean }> {
  return unwrap(
    await getTreaty().api.parent.children({ id: childId }).delete()
  ) as { success: boolean };
}

// ============================================================================
// HOOK
// ============================================================================

export function useParentDashboard() {
  const queryClient = useQueryClient();
  const user = useUser();

  const dashboardQuery = useQuery({
    queryKey: queryKeys.parent.dashboard,
    queryFn: fetchDashboard,
    enabled: !!user,
    staleTime: 60 * 1000,
  });

  const childrenQuery = useQuery({
    queryKey: queryKeys.parent.children,
    queryFn: fetchChildren,
    select: (data): IChild[] => (Array.isArray(data) ? data : []),
    enabled: !!user,
    staleTime: 60 * 1000,
  });

  const levelsQuery = useQuery({
    queryKey: queryKeys.levels,
    queryFn: fetchLevels,
    staleTime: 10 * 60 * 1000,
  });

  const invalidateParentData = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.parent.dashboard });
    void queryClient.invalidateQueries({ queryKey: queryKeys.parent.children });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: createChildApi,
    onSuccess: invalidateParentData,
  });

  const updateMutation = useMutation({
    mutationFn: updateChildApi,
    onSuccess: invalidateParentData,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteChildApi,
    onSuccess: invalidateParentData,
  });

  const dashboardData = dashboardQuery.data;
  const children: IChild[] = dashboardData?.children ?? childrenQuery.data ?? [];
  const metrics: ChildMetrics[] = dashboardData?.metrics ?? [];

  const totalSessions = metrics.reduce((sum, m) => sum + m.totalSessions, 0);
  const totalStudyTime = metrics.reduce((sum, m) => sum + m.totalStudyTime, 0);
  const activeChildren = children.filter((c) => c.isActive).length;

  return {
    children,
    childrenCount: children.length,
    isLoadingChildren: childrenQuery.isLoading || dashboardQuery.isLoading,
    childrenError: childrenQuery.error?.message ?? dashboardQuery.error?.message ?? null,

    metrics,
    isLoadingMetrics: dashboardQuery.isLoading,

    totalSessions,
    totalStudyTime,
    activeChildren,

    levels: levelsQuery.data ?? [],
    isLoadingLevels: levelsQuery.isLoading,

    isLoading: childrenQuery.isLoading || dashboardQuery.isLoading,
    isError: childrenQuery.isError || dashboardQuery.isError,

    createChild: createMutation.mutateAsync,
    updateChild: updateMutation.mutateAsync,
    deleteChild: deleteMutation.mutateAsync,

    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,

    refresh: invalidateParentData,

    userName: dashboardData?.parent?.name ?? user?.name?.split(' ')[0] ?? 'Parent',
  };
}
