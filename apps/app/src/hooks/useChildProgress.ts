import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface SubjectProgress {
  subject: string;
  sessions: number;
  timeSpent: number;
  lastActivity: string;
  progress?: number;
}

export interface RecentSession {
  id: string;
  subject: string;
  startedAt: string;
  duration: number;
  messagesCount: number;
  completion?: number;
}

export interface ChildMetrics {
  totalSessions: number;
  totalTime: number;
  averageScore: number;
  subjectProgress: SubjectProgress[];
  recentSessions: RecentSession[];
  weeklyGoal?: {
    target: number;
    current: number;
    percentage: number;
  };
  streak?: {
    current: number;
    best: number;
  };
}

export function useChildProgress(childId?: string) {
  return useQuery({
    queryKey: ['childProgress', childId],
    queryFn: async (): Promise<ChildMetrics> => {
      if (!childId) {
        throw new Error('childId is required');
      }
      return await apiClient.get(`/api/parent/child/${childId}/progress`);
    },
    enabled: !!childId,
  });
}

export function useInvalidateChildProgress() {
  const queryClient = useQueryClient();

  return (childId?: string) => {
    void queryClient.invalidateQueries({ queryKey: ['childProgress', childId] });
  };
}
