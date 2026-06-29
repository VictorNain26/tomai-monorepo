/**
 * useParentDashboard Hook (web)
 *
 * Ported from apps/mobile/src/hooks/useParentDashboard.ts.
 * Fetches children list, dashboard stats, and handles CRUD operations.
 * Uses Eden Treaty for type-safe e2e API calls.
 */

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTreaty, unwrap, type ResponseData } from "@repo/api";
import { useUser } from "@/lib/auth-client";

// ============================================================================
// TYPES — derived from the server contract (single source of truth)
// ============================================================================

type ParentApi = ReturnType<typeof getTreaty>["api"]["parent"];

/** Child shape as returned by the server contract. */
export type IChild = ResponseData<ParentApi["children"]["get"]>[number];

/** Payload to create a child — derived from the post body parameter. */
export type ICreateChildData = NonNullable<
  Parameters<ParentApi["children"]["post"]>[0]
>;

/** Payload to update a child — derived from the PATCH body parameter. */
type IUpdateChildData = NonNullable<
  Parameters<ReturnType<ParentApi["children"]>["patch"]>[0]
>;

type DashboardResponse = ResponseData<ParentApi["dashboard"]["get"]>;
export type ChildMetrics = DashboardResponse["metrics"][number];

type EducationApi = ReturnType<typeof getTreaty>["api"]["education"];
type LevelsResponse = ResponseData<EducationApi["levels"]["get"]>;
type SchoolLevel = LevelsResponse["levels"][number];

// ============================================================================
// QUERY KEYS
// ============================================================================

const queryKeys = {
  parent: {
    dashboard: ["parent", "dashboard"] as const,
    children: ["parent", "children"] as const,
  },
  levels: ["education", "levels"] as const,
};

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function fetchDashboard(): Promise<DashboardResponse> {
  return unwrap(await getTreaty().api.parent.dashboard.get());
}

async function fetchChildren(): Promise<IChild[]> {
  return unwrap(await getTreaty().api.parent.children.get());
}

async function fetchLevels(): Promise<SchoolLevel[]> {
  const { levels } = unwrap(await getTreaty().api.education.levels.get());
  return levels.filter((l) => l.ragAvailable);
}

async function createChildApi(data: ICreateChildData): Promise<IChild> {
  const { child } = unwrap(await getTreaty().api.parent.children.post(data));
  return child;
}

async function updateChildApi({
  childId,
  data,
}: {
  childId: string;
  data: IUpdateChildData;
}): Promise<IChild> {
  const { child } = unwrap(
    await getTreaty().api.parent.children({ id: childId }).patch(data)
  );
  return child;
}

async function deleteChildApi(childId: string): Promise<{ success: boolean }> {
  return unwrap(
    await getTreaty().api.parent.children({ id: childId }).delete()
  );
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
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });

  const childrenQuery = useQuery({
    queryKey: queryKeys.parent.children,
    queryFn: fetchChildren,
    select: (data): IChild[] => (Array.isArray(data) ? data : []),
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });

  const levelsQuery = useQuery({
    queryKey: queryKeys.levels,
    queryFn: fetchLevels,
    staleTime: 10 * 60 * 1000,
  });

  const invalidateParentData = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.parent.dashboard,
    });
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

  const errorMessage =
    childrenQuery.error?.message ??
    dashboardQuery.error?.message ??
    null;

  return {
    children,
    childrenCount: children.length,
    isLoading: childrenQuery.isLoading || dashboardQuery.isLoading,
    isError: childrenQuery.isError || dashboardQuery.isError,
    errorMessage,

    metrics,
    isLoadingMetrics: dashboardQuery.isLoading,

    totalSessions,
    totalStudyTime,
    activeChildren,

    levels: levelsQuery.data ?? [],
    isLoadingLevels: levelsQuery.isLoading,

    createChild: createMutation.mutateAsync,
    updateChild: updateMutation.mutateAsync,
    deleteChild: deleteMutation.mutateAsync,

    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,

    refresh: invalidateParentData,

    userName:
      dashboardData?.parent?.name ?? user?.name?.split(" ")[0] ?? "Parent",
  };
}
