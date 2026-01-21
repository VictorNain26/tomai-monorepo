/**
 * useStudentDashboard Hook
 *
 * Fetches subjects, token usage, and recent sessions for student dashboard.
 * Subject metadata (name, description, emoji, color) is enriched client-side
 * since backend RAG only returns { key, ragAvailable }.
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@repo/api';
import { useUser } from '@/lib/auth';
import { enrichSubjectKey } from '@/constants/subjects';

// ============================================================================
// TYPES
// ============================================================================

/** Subject with UI metadata (enriched client-side) */
export interface Subject {
  key: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
  ragAvailable: boolean;
}

/** Raw response from backend (only key + ragAvailable) */
interface RagSubject {
  key: string;
  ragAvailable: boolean;
}

interface SubjectsResponse {
  success: boolean;
  level: string;
  subjects: RagSubject[];
}

export interface TokenUsage {
  plan: 'free' | 'premium';
  window: {
    tokensUsed: number;
    tokensRemaining: number;
    limit: number;
    usagePercent: number;
    refreshIn: string;
  };
  daily: {
    tokensUsed: number;
    tokensRemaining: number;
    limit: number;
    usagePercent: number;
    resetsIn: string;
  };
}

interface UsageResponse extends TokenUsage {
  userId: string;
}

export interface LatestSession {
  id: string;
  subject: string;
  startedAt: string;
  messagesCount: number;
}

interface LatestSessionResponse {
  success: boolean;
  session: LatestSession | null;
}

// ============================================================================
// QUERY KEYS
// ============================================================================

const queryKeys = {
  subjects: (level: string) => ['education', 'subjects', level] as const,
  usage: (userId: string) => ['subscription', 'usage', userId] as const,
  latestSession: ['chat', 'latest'] as const,
};

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function fetchSubjects(level: string): Promise<Subject[]> {
  const response = await apiClient.get<SubjectsResponse>(
    `/api/subjects/${level}`
  );
  // Enrich RAG subjects with UI metadata (name, description, emoji, color)
  return response.subjects.map((ragSubject) => {
    const metadata = enrichSubjectKey(ragSubject.key);
    return {
      key: ragSubject.key,
      ragAvailable: ragSubject.ragAvailable,
      ...metadata,
    };
  });
}

async function fetchTokenUsage(userId: string): Promise<TokenUsage> {
  const response = await apiClient.get<UsageResponse>(
    '/api/subscriptions/usage',
    { params: { userId } }
  );
  return {
    plan: response.plan,
    window: response.window,
    daily: response.daily,
  };
}

async function fetchLatestSession(): Promise<LatestSession | null> {
  const response = await apiClient.get<LatestSessionResponse>(
    '/api/chat/sessions/latest'
  );
  return response.session;
}

// ============================================================================
// HOOK
// ============================================================================

export function useStudentDashboard() {
  const user = useUser();
  const userId = user?.id ?? '';
  const schoolLevel = user?.schoolLevel ?? 'sixieme';

  // Fetch subjects for user's level
  const subjectsQuery = useQuery({
    queryKey: queryKeys.subjects(schoolLevel),
    queryFn: () => fetchSubjects(schoolLevel),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch token usage
  const usageQuery = useQuery({
    queryKey: queryKeys.usage(userId),
    queryFn: () => fetchTokenUsage(userId),
    enabled: !!userId,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  // Fetch latest session
  const latestSessionQuery = useQuery({
    queryKey: queryKeys.latestSession,
    queryFn: fetchLatestSession,
    enabled: !!user,
    staleTime: 60 * 1000, // 1 minute
  });

  return {
    // Subjects
    subjects: subjectsQuery.data ?? [],
    isLoadingSubjects: subjectsQuery.isLoading,
    subjectsError: subjectsQuery.error?.message ?? null,

    // Token usage
    usage: usageQuery.data ?? null,
    isLoadingUsage: usageQuery.isLoading,
    usageError: usageQuery.error?.message ?? null,

    // Latest session
    latestSession: latestSessionQuery.data ?? null,
    isLoadingSession: latestSessionQuery.isLoading,

    // User info
    userName: user?.name?.split(' ')[0] ?? 'Élève',
    schoolLevel,
  };
}
