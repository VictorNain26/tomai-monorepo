/**
 * Hook useLearning - Gestion des outils de révision
 *
 * Outils simples de révision: Flashcards, QCM, Vrai/Faux
 * Design: Pas de gamification, pas de tracking de progression visible
 * FSRS fonctionne silencieusement en arrière-plan
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  learningQueries,
  learningMutations,
  invalidationHelpers,
} from '@/lib/query-factories';
import { logger } from '@/lib/logger';
import type {
  ILearningDeck,
  ILearningCard,
  ICreateDeckRequest,
  ICreateCardRequest,
  CardContent,
  IGenerateDeckRequest,
  IGenerateDeckResponse,
} from '@/types';

// ============================================
// Hook: useDecks - Liste des decks utilisateur
// ============================================

interface UseDecksReturn {
  decks: ILearningDeck[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDecks(): UseDecksReturn {
  const query = useQuery({
    ...learningQueries.decks(),
  });

  return {
    decks: query.data?.decks ?? [],
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: () => void query.refetch(),
  };
}

// ============================================
// Hook: useDeck - Un deck avec ses cartes
// ============================================

interface UseDeckReturn {
  deck: ILearningDeck | null;
  cards: ILearningCard[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDeck(deckId: string | null): UseDeckReturn {
  const query = useQuery({
    ...learningQueries.deckWithCards(deckId ?? ''),
    enabled: !!deckId,
  });

  return {
    deck: query.data?.deck ?? null,
    cards: query.data?.cards ?? [],
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: () => void query.refetch(),
  };
}

// ============================================
// Hook: useDeckMutations - CRUD opérations decks
// ============================================

interface UseDeckMutationsReturn {
  createDeck: (data: ICreateDeckRequest) => Promise<ILearningDeck>;
  updateDeck: (deckId: string, data: Partial<Pick<ILearningDeck, 'title' | 'description' | 'subject'>>) => Promise<ILearningDeck>;
  deleteDeck: (deckId: string) => Promise<void>;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
}

export function useDeckMutations(): UseDeckMutationsReturn {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    ...learningMutations.createDeck(),
    onSuccess: () => {
      invalidationHelpers.invalidateLearningData(queryClient);
      toast.success('Deck créé');
    },
    onError: (error: Error) => {
      logger.error('Error creating deck', error, {
        component: 'useLearning',
        operation: 'createDeck',
      });
      toast.error('Erreur lors de la création du deck');
    },
  });

  const updateMutation = useMutation({
    ...learningMutations.updateDeck(),
    onSuccess: (_, { deckId }) => {
      invalidationHelpers.invalidateLearningData(queryClient, deckId);
      toast.success('Deck mis à jour');
    },
    onError: (error: Error) => {
      logger.error('Error updating deck', error, {
        component: 'useLearning',
        operation: 'updateDeck',
      });
      toast.error('Erreur lors de la mise à jour');
    },
  });

  const deleteMutation = useMutation({
    ...learningMutations.deleteDeck(),
    onSuccess: () => {
      invalidationHelpers.invalidateLearningData(queryClient);
      toast.success('Deck supprimé');
    },
    onError: (error: Error) => {
      logger.error('Error deleting deck', error, {
        component: 'useLearning',
        operation: 'deleteDeck',
      });
      toast.error('Erreur lors de la suppression');
    },
  });

  return {
    createDeck: async (data: ICreateDeckRequest) => {
      const result = await createMutation.mutateAsync(data);
      return result.deck;
    },
    updateDeck: async (deckId: string, data: Partial<Pick<ILearningDeck, 'title' | 'description' | 'subject'>>) => {
      const result = await updateMutation.mutateAsync({ deckId, data });
      return result.deck;
    },
    deleteDeck: async (deckId: string) => {
      await deleteMutation.mutateAsync(deckId);
    },
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

// ============================================
// Hook: useCardMutations - CRUD opérations cartes
// ============================================

interface UseCardMutationsReturn {
  addCards: (deckId: string, cards: ICreateCardRequest[]) => Promise<ILearningCard[]>;
  updateCard: (cardId: string, data: { content?: CardContent; position?: number }) => Promise<ILearningCard>;
  deleteCard: (cardId: string, deckId: string) => Promise<void>;
  /** Update FSRS data (internal, hidden from user) */
  updateCardFSRS: (cardId: string, fsrsData: Record<string, unknown>) => Promise<void>;
  isAdding: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
}

export function useCardMutations(): UseCardMutationsReturn {
  const queryClient = useQueryClient();

  const addMutation = useMutation({
    ...learningMutations.addCards(),
    onSuccess: (_, { deckId }) => {
      invalidationHelpers.invalidateLearningData(queryClient, deckId);
      toast.success('Cartes ajoutées');
    },
    onError: (error: Error) => {
      logger.error('Error adding cards', error, {
        component: 'useLearning',
        operation: 'addCards',
      });
      toast.error('Erreur lors de l\'ajout des cartes');
    },
  });

  const updateMutation = useMutation({
    ...learningMutations.updateCard(),
    // No toast for card updates (silent FSRS updates)
    onError: (error: Error) => {
      logger.error('Error updating card', error, {
        component: 'useLearning',
        operation: 'updateCard',
      });
    },
  });

  const deleteMutation = useMutation({
    ...learningMutations.deleteCard(),
    onSuccess: () => {
      // Invalidation handled by parent calling with deckId
      toast.success('Carte supprimée');
    },
    onError: (error: Error) => {
      logger.error('Error deleting card', error, {
        component: 'useLearning',
        operation: 'deleteCard',
      });
      toast.error('Erreur lors de la suppression');
    },
  });

  return {
    addCards: async (deckId: string, cards: ICreateCardRequest[]) => {
      const result = await addMutation.mutateAsync({ deckId, cards });
      return result.cards;
    },
    updateCard: async (cardId: string, data: { content?: CardContent; position?: number }) => {
      const result = await updateMutation.mutateAsync({ cardId, data });
      return result.card;
    },
    deleteCard: async (cardId: string, deckId: string) => {
      await deleteMutation.mutateAsync(cardId);
      // Invalidate deck to refresh card count
      invalidationHelpers.invalidateLearningData(queryClient, deckId);
    },
    updateCardFSRS: async (cardId: string, fsrsData: Record<string, unknown>) => {
      // Silent FSRS update - no toast, no UI feedback
      await updateMutation.mutateAsync({ cardId, data: { fsrsData } });
    },
    isAdding: addMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

// ============================================
// Hook: useGenerateDeck - AI deck generation
// ============================================

interface UseGenerateDeckReturn {
  generateDeck: (data: IGenerateDeckRequest) => Promise<IGenerateDeckResponse>;
  isGenerating: boolean;
}

export function useGenerateDeck(): UseGenerateDeckReturn {
  const queryClient = useQueryClient();

  const generateMutation = useMutation({
    ...learningMutations.generateDeck(),
    onSuccess: () => {
      // Invalidate cache pour que la liste des decks se mette à jour
      invalidationHelpers.invalidateLearningData(queryClient);
      // Note: Les toasts sont gérés dans LearningDeckNew.tsx avec un ID unique
      // pour éviter les doublons et permettre la mise à jour du toast loading
    },
    onError: (error: Error) => {
      logger.error('Error generating deck', error, {
        component: 'useLearning',
        operation: 'generateDeck',
      });
      // Note: Les toasts d'erreur sont gérés dans LearningDeckNew.tsx
    },
  });

  return {
    generateDeck: async (data: IGenerateDeckRequest) => {
      return await generateMutation.mutateAsync(data);
    },
    isGenerating: generateMutation.isPending,
  };
}

// ============================================
// Combined Hook: useLearningTools
// ============================================

interface UseLearningToolsReturn extends UseDecksReturn, UseDeckMutationsReturn, UseCardMutationsReturn {
  // Current selected deck
  selectedDeck: ILearningDeck | null;
  selectedDeckCards: ILearningCard[];
  selectedDeckLoading: boolean;
  selectedDeckError: string | null;
  // Actions
  selectDeck: (deckId: string | null) => void;
}

/**
 * Combined hook for full learning tools functionality
 * Use this for pages that need all learning capabilities
 */
export function useLearningTools(initialDeckId: string | null = null): UseLearningToolsReturn {
  const decksData = useDecks();
  const deckMutations = useDeckMutations();
  const cardMutations = useCardMutations();

  // For selected deck, use useDeck hook
  const selectedDeckData = useDeck(initialDeckId);

  return {
    // Decks list
    ...decksData,
    // Deck mutations
    ...deckMutations,
    // Card mutations
    ...cardMutations,
    // Selected deck
    selectedDeck: selectedDeckData.deck,
    selectedDeckCards: selectedDeckData.cards,
    selectedDeckLoading: selectedDeckData.isLoading,
    selectedDeckError: selectedDeckData.error,
    // Note: selectDeck would need state management
    // For now, pass initialDeckId or use URL params in component
    selectDeck: () => {
      // This is a placeholder - actual implementation would use
      // useState or URL params in the component
      logger.debug('selectDeck called - use URL params or component state', {
        component: 'useLearningTools',
      });
    },
  };
}
