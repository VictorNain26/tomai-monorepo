/**
 * useParentDashboard Hook
 *
 * Fetches children list, dashboard stats, and handles CRUD operations.
 * Uses apiClient directly since @repo/api/queries isn't configured for mobile.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@repo/api';
import { useUser } from '@/lib/auth';
import type { EducationLevelType, Lv2Option } from '@/constants/levels';

// Re-export types for consumers
export type { EducationLevelType, Lv2Option } from '@/constants/levels';

// ============================================================================
// TYPES (aligned with backend apps/server/src/types/index.ts)
// ============================================================================

/** Backend ChildInfo - includes role: 'student' */
export interface IChild {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  schoolLevel: string; // Backend returns string, not enum
  selectedLv2?: Lv2Option | null;
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
  selectedLv2?: Lv2Option | null;
}

/** Backend ParentDashboardMetrics - per-child metrics */
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
  lastSessionDate: string | null; // Date serialized as ISO string
}

/** Backend /api/parent/dashboard response */
interface DashboardResponse {
  success: boolean;
  parent: { id: string; name: string };
  children: IChild[];
  metrics: ChildMetrics[];
}

/** Backend RagLevel - NO name/description */
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
  return apiClient.get('/api/parent/dashboard');
}

async function fetchChildren(): Promise<IChild[]> {
  return apiClient.get('/api/parent/children');
}

async function fetchLevels(): Promise<SchoolLevel[]> {
  // Correct endpoint: /api/education/levels (NOT /api/subjects/levels)
  const response = await apiClient.get<LevelsResponse>('/api/education/levels');
  return response.levels.filter((l) => l.ragAvailable);
}

async function createChildApi(data: ICreateChildData): Promise<IChild> {
  return apiClient.post('/api/parent/children', data);
}

async function updateChildApi({
  childId,
  data,
}: {
  childId: string;
  data: Partial<Omit<IChild, 'role'>>;
}): Promise<IChild> {
  return apiClient.patch(`/api/parent/children/${childId}`, data);
}

async function deleteChildApi(childId: string): Promise<{ success: boolean }> {
  return apiClient.delete(`/api/parent/children/${childId}`);
}

// ============================================================================
// HOOK
// ============================================================================

export function useParentDashboard() {
  const queryClient = useQueryClient();
  const user = useUser();

  // Fetch dashboard (includes children + metrics in one call)
  const dashboardQuery = useQuery({
    queryKey: queryKeys.parent.dashboard,
    queryFn: fetchDashboard,
    enabled: !!user,
    staleTime: 60 * 1000, // 1 minute
  });

  // Fetch children list separately (for CRUD operations)
  const childrenQuery = useQuery({
    queryKey: queryKeys.parent.children,
    queryFn: fetchChildren,
    select: (data): IChild[] => (Array.isArray(data) ? data : []),
    enabled: !!user,
    staleTime: 60 * 1000,
  });

  // Fetch available school levels
  const levelsQuery = useQuery({
    queryKey: queryKeys.levels,
    queryFn: fetchLevels,
    staleTime: 10 * 60 * 1000, // 10 minutes (rarely changes)
  });

  // Invalidation helper
  const invalidateParentData = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.parent.dashboard });
    void queryClient.invalidateQueries({ queryKey: queryKeys.parent.children });
  };

  // Create child mutation
  const createMutation = useMutation({
    mutationFn: createChildApi,
    onSuccess: invalidateParentData,
  });

  // Update child mutation
  const updateMutation = useMutation({
    mutationFn: updateChildApi,
    onSuccess: invalidateParentData,
  });

  // Delete child mutation
  const deleteMutation = useMutation({
    mutationFn: deleteChildApi,
    onSuccess: invalidateParentData,
  });

  // Extract data from dashboard response
  const dashboardData = dashboardQuery.data;
  const children: IChild[] = dashboardData?.children ?? childrenQuery.data ?? [];
  const metrics: ChildMetrics[] = dashboardData?.metrics ?? [];

  // Compute aggregated stats from per-child metrics
  const totalSessions = metrics.reduce((sum, m) => sum + m.totalSessions, 0);
  const totalStudyTime = metrics.reduce((sum, m) => sum + m.totalStudyTime, 0);
  const activeChildren = children.filter((c) => c.isActive).length;

  return {
    // Children data
    children,
    childrenCount: children.length,
    isLoadingChildren: childrenQuery.isLoading || dashboardQuery.isLoading,
    childrenError: childrenQuery.error?.message ?? dashboardQuery.error?.message ?? null,

    // Per-child metrics (for detailed views)
    metrics,
    isLoadingMetrics: dashboardQuery.isLoading,

    // Aggregated stats (computed from metrics)
    totalSessions,
    totalStudyTime,
    activeChildren,

    // School levels (for create/edit forms) - NO name/description, only key
    levels: levelsQuery.data ?? [],
    isLoadingLevels: levelsQuery.isLoading,

    // Combined loading state
    isLoading: childrenQuery.isLoading || dashboardQuery.isLoading,
    isError: childrenQuery.isError || dashboardQuery.isError,

    // Mutations
    createChild: createMutation.mutateAsync,
    updateChild: updateMutation.mutateAsync,
    deleteChild: deleteMutation.mutateAsync,

    // Mutation states
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,

    // Actions
    refresh: invalidateParentData,

    // User info (from dashboard response or fallback)
    userName: dashboardData?.parent?.name ?? user?.name?.split(' ')[0] ?? 'Parent',
  };
}
