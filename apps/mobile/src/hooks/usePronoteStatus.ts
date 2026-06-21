import { useQuery } from '@tanstack/react-query';
import { getTreaty, unwrap } from '@repo/api';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Pronote connection status for a child.
 * Mirrors PronoteChildStatus from the server contract — declared here because
 * the Elysia route type for this endpoint resolves to {} in the Eden Treaty
 * types (dynamic :childId path, same as grades/homework).
 */
export interface PronoteStatus {
  hasPronote: boolean;
  establishmentName: string | null;
  className: string | null;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Fetches Pronote connection status for a given child from the server.
 * Returns hasPronote, establishmentName, className — sourced from the
 * server endpoint, never from the local store resourceMappings.
 */
export function usePronoteStatus(childId: string) {
  return useQuery<PronoteStatus>({
    queryKey: ['pronote', 'status', childId] as const,
    queryFn: async () => {
      const response = await getTreaty().api.pronote.children({ childId }).status.get();
      const raw = unwrap(response) as unknown as { success: boolean; data: PronoteStatus };
      return raw.data;
    },
    enabled: !!childId,
    staleTime: 5 * 60 * 1000, // 5 minutes — connection status rarely changes mid-session
  });
}
