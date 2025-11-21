/**
 * Hook useStudentGamification - Gestion de la gamification élève
 *
 * 🎯 Features MINIMALISTES:
 * - Récupération des données de gamification (badges, streaks)
 * - Système ULTRA-MINIMALISTE: badges + streaks uniquement
 * - PAS d'XP ni de niveaux (supprimé car anxiogène)
 * - Formatage des données pour UI
 * - Cache avec TanStack Query (5 minutes staleTime)
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

/**
 * Types pour la gamification (miroir du backend)
 * ⚠️ icon supprimé - géré dans badgeConfig.ts frontend
 */
export interface BadgeCatalog {
  id: string;
  badgeKey: string;
  name: string;
  description: string;
  category: 'progression' | 'engagement' | 'mastery' | 'special';
  xpReward: number; // Legacy field (toujours 0)
  displayOrder: number;
}

export interface StudentGamificationView {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastStudyDate: Date | null;
  unlockedBadges: string[];
}

export interface BadgeWithDetails extends BadgeCatalog {
  unlocked: boolean;
  unlockedAt: string | undefined;
}

/**
 * Données de gamification enrichies pour l'UI
 * Système MINIMALISTE: badges + streaks uniquement
 */
export interface GamificationUIData {
  // Données brutes
  raw: StudentGamificationView | null;

  // Badges débloqués avec détails
  unlockedBadges: BadgeWithDetails[];

  // Tous les badges disponibles
  allBadges: BadgeWithDetails[];

  // Stats globales (streaks + badges uniquement)
  stats: {
    currentStreak: number;
    longestStreak: number;
    totalBadgesUnlocked: number;
    totalBadgesAvailable: number;
  };
}

/**
 * Hook principal pour la gamification élève
 */
export function useStudentGamification() {
  // Query gamification data
  const gamificationQuery = useQuery({
    queryKey: ['student-gamification'],
    queryFn: async (): Promise<StudentGamificationView | null> => {
      // Backend renvoie directement l'objet, pas { data: ... }
      return await apiClient.get<StudentGamificationView | null>('/api/gamification/me');
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });

  // Query all badges catalog
  const badgesQuery = useQuery({
    queryKey: ['badges-catalog'],
    queryFn: async (): Promise<BadgeCatalog[]> => {
      // Backend renvoie directement le tableau, pas { data: ... }
      return await apiClient.get<BadgeCatalog[]>('/api/gamification/badges');
    },
    staleTime: 60 * 60 * 1000, // 1 heure (data statique)
  });

  // Calculer données UI enrichies
  const uiData: GamificationUIData | null = useMemo(() => {
    if (!gamificationQuery.data || !badgesQuery.data) {
      return null;
    }

    const rawData = gamificationQuery.data;
    const allBadgesCatalog = badgesQuery.data;

    // Préparer badges avec détails
    const unlockedBadgeKeys = new Set(rawData.unlockedBadges);

    const allBadges: BadgeWithDetails[] = allBadgesCatalog.map(badge => ({
      ...badge,
      unlocked: unlockedBadgeKeys.has(badge.badgeKey),
      unlockedAt: undefined // Badge unlock timestamp - not currently tracked by backend
    }));

    const unlockedBadges = allBadges.filter(b => b.unlocked);

    // Stats globales (streaks + badges uniquement)
    const stats = {
      currentStreak: rawData.currentStreak,
      longestStreak: rawData.longestStreak,
      totalBadgesUnlocked: unlockedBadges.length,
      totalBadgesAvailable: allBadges.length
    };

    return {
      raw: rawData,
      unlockedBadges,
      allBadges,
      stats
    };
  }, [gamificationQuery.data, badgesQuery.data]);

  return {
    // Données
    data: uiData,

    // Loading states
    isLoading: gamificationQuery.isLoading || badgesQuery.isLoading,
    isError: gamificationQuery.isError || badgesQuery.isError,
    error: gamificationQuery.error ?? badgesQuery.error,

    // Refetch
    refetch: () => {
      void Promise.all([
        gamificationQuery.refetch(),
        badgesQuery.refetch()
      ]);
    }
  };
}

/**
 * Hook pour récupérer les badges débloqués seulement
 */
export function useUnlockedBadges() {
  const { data, isLoading } = useStudentGamification();

  return {
    badges: data?.unlockedBadges ?? [],
    count: data?.stats.totalBadgesUnlocked ?? 0,
    isLoading
  };
}

/**
 * Hook pour récupérer les stats globales
 */
export function useGamificationStats() {
  const { data, isLoading } = useStudentGamification();

  return {
    stats: data?.stats ?? {
      currentStreak: 0,
      longestStreak: 0,
      totalBadgesUnlocked: 0,
      totalBadgesAvailable: 0
    },
    isLoading
  };
}
