/**
 * Hook pour récupérer les conversation boundaries d'une session
 * Permet d'afficher des séparateurs visuels entre conversations
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface ConversationBoundary {
  id: string;
  startMessageIndex: number;
  endMessageIndex: number | null;
  topic: string | null;
  detectionReason: 'initial' | 'temporal' | 'semantic' | 'intentional';
  confidenceScore: number;
  startedAt: string;
  endedAt: string | null;
  messageCount: number;
  isActive: boolean;
}

export interface BoundariesResponse {
  sessionId: string;
  boundaries: ConversationBoundary[];
  totalBoundaries: number;
}

/**
 * Récupère les boundaries d'une session
 * @param sessionId - ID de la session
 * @param enabled - Activer/désactiver la query (optionnel)
 */
export function useBoundaries(sessionId: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: ['boundaries', sessionId],
    queryFn: async (): Promise<BoundariesResponse> => {
      if (!sessionId) {
        throw new Error('Session ID is required');
      }

      const response = await apiClient.get<BoundariesResponse>(`/api/boundaries/${sessionId}`);
      return response;
    },
    enabled: enabled && Boolean(sessionId),
    staleTime: 5 * 60 * 1000, // 5 minutes - boundaries changent rarement
    gcTime: 10 * 60 * 1000, // 10 minutes cache
    retry: 2
  });
}

/**
 * Trouve la boundary correspondant à un index de message
 * @param boundaries - Liste des boundaries
 * @param messageIndex - Index du message dans la conversation
 */
export function findBoundaryForMessage(
  boundaries: ConversationBoundary[],
  messageIndex: number
): ConversationBoundary | undefined {
  return boundaries.find(boundary =>
    boundary.startMessageIndex === messageIndex
  );
}

/**
 * Vérifie si un message est le premier d'une nouvelle conversation
 * @param boundaries - Liste des boundaries
 * @param messageIndex - Index du message dans la conversation
 */
export function isConversationStart(
  boundaries: ConversationBoundary[],
  messageIndex: number
): boolean {
  return boundaries.some(boundary =>
    boundary.startMessageIndex === messageIndex
  );
}
