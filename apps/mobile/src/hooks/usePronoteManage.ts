/**
 * usePronoteManage — manages list, resync, delete, and password reset
 * for Pronote credentials from the server.
 *
 * Data flow:
 *   GET /api/pronote/credentials/list → credentials list
 *   POST /api/pronote/credentials/:id/resync → update child count
 *   DELETE /api/pronote/credentials/:id → remove credential (children kept)
 *   PATCH /api/parent/children/:id → reset child password
 *
 * Children per credential are joined client-side from useParentDashboard
 * (hasPronote:true children, ordered by credentialId — server does not yet
 * expose credentialId on /parent/children; we show all hasPronote children
 * under each credential until that field ships, then filter strictly).
 */

import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { getTreaty, unwrap } from '@repo/api';
import { useParentDashboard, type IChild } from '@/hooks/useParentDashboard';

// ============================================================================
// TYPES
// ============================================================================

export interface PronoteCredentialSummary {
  credentialId: string;
  establishmentName: string | null;
  establishmentUrl: string;
  childCount: number;
}

export interface ResyncResult {
  added: { resourceId: number }[];
  stillMapped: number[];
}

// ============================================================================
// QUERY KEY
// ============================================================================

const QUERY_KEY = ['pronote', 'credentials', 'list'] as const;

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function fetchCredentials(): Promise<PronoteCredentialSummary[]> {
  // Cast: Eden dynamic route resolves loosely for /credentials/list
  const endpoint = getTreaty().api.pronote as unknown as {
    credentials: {
      list: {
        get: () => Promise<{ data: { success: boolean; data: PronoteCredentialSummary[] } | null; error: null }>;
      };
    };
  };
  const response = await endpoint.credentials.list.get();
  const raw = unwrap(response) as unknown as { success: boolean; data: PronoteCredentialSummary[] };
  return raw.data;
}

async function resyncCredential(credentialId: string): Promise<ResyncResult> {
  // Cast: dynamic :id segment resolves loosely in Eden Treaty types
  const endpoint = getTreaty().api.pronote.credentials({ id: credentialId }) as unknown as {
    resync: {
      post: () => Promise<{ data: { success: boolean; data: ResyncResult } | null; error: null }>;
    };
  };
  const response = await endpoint.resync.post();
  const raw = unwrap(response) as unknown as { success: boolean; data: ResyncResult };
  return raw.data;
}

async function deleteCredential(credentialId: string): Promise<{ success: boolean }> {
  // Cast: dynamic :id segment resolves loosely in Eden Treaty types
  const endpoint = getTreaty().api.pronote as unknown as {
    credentials: {
      (opts: { id: string }): {
        delete: () => Promise<{ data: { success: boolean } | null; error: null }>;
      };
    };
  };
  const response = await endpoint.credentials({ id: credentialId }).delete();
  return unwrap(response) as unknown as { success: boolean };
}

async function resetChildPasswordApi({
  childId,
  password,
}: {
  childId: string;
  password: string;
}): Promise<void> {
  await getTreaty().api.parent.children({ id: childId }).patch({ password });
}

// ============================================================================
// HOOK
// ============================================================================

export interface UsePronoteManageReturn {
  credentials: PronoteCredentialSummary[];
  pronoteChildren: IChild[];
  isLoading: boolean;
  isError: boolean;
  resync: (credentialId: string) => Promise<ResyncResult>;
  deleteCredential: (credentialId: string) => Promise<{ success: boolean }>;
  resetChildPassword: (childId: string, password: string) => Promise<void>;
  resyncingId: string | null;
  deletingId: string | null;
}

export function usePronoteManage(): UsePronoteManageReturn {
  const queryClient = useQueryClient();

  const { data: credentials = [], isLoading, isError } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchCredentials,
    staleTime: 2 * 60 * 1000,
  });

  const { children: allChildren } = useParentDashboard();
  const pronoteChildren = allChildren.filter((c) => c.hasPronote);

  const resyncMutation = useMutation({
    mutationFn: resyncCredential,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCredential,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      // hasPronote may have changed — invalidate parent children too
      void queryClient.invalidateQueries({ queryKey: ['parent', 'children'] });
      void queryClient.invalidateQueries({ queryKey: ['parent', 'dashboard'] });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: resetChildPasswordApi,
  });

  return {
    credentials,
    pronoteChildren,
    isLoading,
    isError,
    resync: resyncMutation.mutateAsync,
    deleteCredential: deleteMutation.mutateAsync,
    resetChildPassword: (childId, password) =>
      resetPasswordMutation.mutateAsync({ childId, password }),
    resyncingId: resyncMutation.isPending ? (resyncMutation.variables as string) : null,
    deletingId: deleteMutation.isPending ? (deleteMutation.variables as string) : null,
  };
}
