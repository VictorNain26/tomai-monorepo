import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface PronoteConnection {
  id: string;
  establishmentName: string;
  username: string;
  isActive: boolean;
  lastSync?: string;
}

export function usePronoteConnections(childId?: string) {
  return useQuery({
    queryKey: ['pronoteConnections', childId],
    queryFn: async (): Promise<PronoteConnection[]> => {
      if (!childId) {
        return [];
      }

      const response = await apiClient.get(`/api/pronote/connections?childId=${childId}`) as { success: boolean; connections?: PronoteConnection[] };

      if (response.success) {
        return response.connections ?? [];
      }

      return [];
    },
    enabled: !!childId,
    staleTime: 5 * 60 * 1000, // 5 minutes - données pronote stables
    gcTime: 15 * 60 * 1000, // 15 minutes cache
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData: unknown) => previousData as PronoteConnection[] | undefined,
  });
}

export function useInvalidatePronoteConnections() {
  const queryClient = useQueryClient();

  return (childId?: string) => {
    void queryClient.invalidateQueries({ queryKey: ['pronoteConnections', childId] });
  };
}
