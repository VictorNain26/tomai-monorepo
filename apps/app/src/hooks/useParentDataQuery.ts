import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { parentQueries, parentMutations, invalidationHelpers } from '@/lib/query-factories';
import type { IChild } from '@/types';
import { toast } from 'sonner';

// Interface for dashboard data
interface _IDashboardData {
  children: IChild[];
  metrics: Array<Record<string, unknown>>;
}

/**
 * Hook optimisé avec TanStack Query pour éviter le clignotement
 * Utilise le pattern Stale-While-Revalidate pour une UX fluide
 */
export const useParentDataQuery = () => {
  const queryClient = useQueryClient();

  const dashboardQuery = useQuery({
    ...parentQueries.dashboard(),
    select: (data) => data || { children: [], metrics: [] },
  });

  const childrenQuery = useQuery({
    ...parentQueries.children(),
    select: (data) => Array.isArray(data) ? data : [],
  });

  // Mutation pour créer un enfant
  const createChildMutation = useMutation({
    ...parentMutations.createChild(),
    onSuccess: () => {
      invalidationHelpers.invalidateParentData(queryClient);
      toast.success('Enfant ajouté avec succès');
    },
    onError: () => {
      toast.error('Erreur lors de la création de l\'enfant');
    },
  });

  // Mutation pour mettre à jour un enfant
  const updateChildMutation = useMutation({
    ...parentMutations.updateChild(),
    onSuccess: () => {
      invalidationHelpers.invalidateParentData(queryClient);
      toast.success('Enfant mis à jour avec succès');
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour');
    },
  });

  // Mutation pour supprimer un enfant
  const deleteChildMutation = useMutation({
    ...parentMutations.deleteChild(),
    onSuccess: () => {
      invalidationHelpers.invalidateParentData(queryClient);
      toast.success('Enfant supprimé avec succès');
    },
    onError: () => {
      toast.error('Erreur lors de la suppression');
    },
  });

  // Fonction pour forcer un refresh - SIMPLIFIÉE
  const refresh = () => {
    invalidationHelpers.invalidateParentData(queryClient);
  };

  // Fonction pour s'assurer que les enfants sont toujours un array
  const ensureArray = <T>(value: T[] | T | null | undefined): T[] => {
    if (Array.isArray(value)) return value;
    return [];
  };

  // Données avec fallback sécurisé (REAL DATA ONLY)
  const safeChildren = ensureArray(
    childrenQuery.data ??
    dashboardQuery.data?.children ??
    []
  );

  return {
    // Données
    dashboardData: dashboardQuery.data ?? { children: safeChildren, metrics: [] },
    children: safeChildren,

    isLoading: dashboardQuery.isLoading || childrenQuery.isLoading,
    isFetching: dashboardQuery.isFetching || childrenQuery.isFetching,
    isError: dashboardQuery.isError || childrenQuery.isError,

    // Mutations
    createChild: createChildMutation.mutate,
    updateChild: updateChildMutation.mutate,
    deleteChild: deleteChildMutation.mutate,

    // Actions
    refresh,

    // États des mutations
    isCreating: createChildMutation.isPending,
    isUpdating: updateChildMutation.isPending,
    isDeleting: deleteChildMutation.isPending,
  };
};

