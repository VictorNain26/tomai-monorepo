/**
 * useLearning Hook Tests
 *
 * Tests for learning deck operations and AI generation.
 * Follows TanStack Query testing best practices.
 * @see https://tanstack.com/query/v4/docs/framework/react/guides/testing
 */

import { renderHook, waitFor, act } from '@testing-library/react-native';
import { apiClient } from '@repo/api';

import { createTestWrapper } from '../utils/test-utils';
import {
  useDecks,
  useDeck,
  useGenerateDeck,
  useLearningSubjects,
  useLearningTopics,
  type LearningDeck,
  type LearningCard,
  type GenerateDeckResponse,
} from '../../src/hooks/useLearning';

// Mock apiClient
jest.mock('@repo/api', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

// Mock data
const mockDeck: LearningDeck = {
  id: 'deck-1',
  userId: 'user-1',
  title: 'Mathématiques - Algèbre',
  description: 'Deck de révision algèbre',
  subject: 'mathematiques',
  source: 'prompt',
  sourceId: null,
  sourcePrompt: "Génère des cartes sur l'algèbre",
  schoolLevel: 'quatrieme',
  cardCount: 10,
  createdAt: '2025-01-10T10:00:00Z',
  updatedAt: '2025-01-10T10:00:00Z',
};

const mockCard: LearningCard = {
  id: 'card-1',
  deckId: 'deck-1',
  cardType: 'flashcard',
  content: {
    question: "Qu'est-ce qu'une équation ?",
    answer: 'Une égalité contenant une inconnue',
  },
  position: 0,
  fsrsData: null,
  createdAt: '2025-01-10T10:00:00Z',
  updatedAt: '2025-01-10T10:00:00Z',
};

describe('useDecks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch decks successfully', async () => {
    mockApiClient.get.mockResolvedValueOnce({
      decks: [mockDeck],
      count: 1,
    });

    const { wrapper, queryClient } = createTestWrapper();
    const { result } = renderHook(() => useDecks(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].title).toBe('Mathématiques - Algèbre');
    expect(mockApiClient.get).toHaveBeenCalledWith('/api/learning/decks');

    // Cleanup: clear cache to prevent timer leaks
    queryClient.clear();
  });

  it('should handle fetch error', async () => {
    mockApiClient.get.mockRejectedValueOnce(new Error('Network error'));

    const { wrapper, queryClient } = createTestWrapper();
    const { result } = renderHook(() => useDecks(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Network error');

    queryClient.clear();
  });
});

describe('useDeck', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch single deck with cards', async () => {
    mockApiClient.get.mockResolvedValueOnce({
      deck: mockDeck,
      cards: [mockCard],
    });

    const { wrapper, queryClient } = createTestWrapper();
    const { result } = renderHook(() => useDeck('deck-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.deck.id).toBe('deck-1');
    expect(result.current.data?.cards).toHaveLength(1);
    expect(mockApiClient.get).toHaveBeenCalledWith('/api/learning/decks/deck-1');

    queryClient.clear();
  });

  it('should not fetch when id is empty', () => {
    const { wrapper, queryClient } = createTestWrapper();
    renderHook(() => useDeck(''), { wrapper });

    expect(mockApiClient.get).not.toHaveBeenCalled();

    queryClient.clear();
  });
});

describe('useGenerateDeck', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should generate deck with AI', async () => {
    const mockResponse: GenerateDeckResponse = {
      deck: mockDeck,
      cards: [mockCard],
      metadata: {
        ragStrategy: 'hybrid',
        tokensUsed: 1500,
      },
    };

    mockApiClient.post.mockResolvedValueOnce(mockResponse);

    const { wrapper, queryClient } = createTestWrapper();
    const { result } = renderHook(() => useGenerateDeck(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        subject: 'mathematiques',
        domaine: 'Algèbre',
        topic: 'Équations',
      });
    });

    expect(mockApiClient.post).toHaveBeenCalledWith('/api/learning/generate', {
      subject: 'mathematiques',
      domaine: 'Algèbre',
      topic: 'Équations',
    });

    queryClient.clear();
  });

  it('should handle generation error', async () => {
    const errorResponse = {
      code: 'SUBSCRIPTION_REQUIRED',
      message: 'Abonnement requis',
    };
    mockApiClient.post.mockRejectedValueOnce(errorResponse);

    const { wrapper, queryClient } = createTestWrapper();
    const { result } = renderHook(() => useGenerateDeck(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          subject: 'mathematiques',
          domaine: 'Algèbre',
        });
      })
    ).rejects.toEqual(errorResponse);

    queryClient.clear();
  });
});

describe('useLearningSubjects', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch subjects for a level', async () => {
    mockApiClient.get.mockResolvedValueOnce({
      niveau: 'quatrieme',
      subjects: [
        { id: 'mathematiques', label: 'Mathématiques' },
        { id: 'francais', label: 'Français' },
      ],
    });

    const { wrapper, queryClient } = createTestWrapper();
    const { result } = renderHook(() => useLearningSubjects('quatrieme'), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(2);
    expect(mockApiClient.get).toHaveBeenCalledWith('/api/learning/subjects', {
      params: { niveau: 'quatrieme' },
    });

    queryClient.clear();
  });

  it('should not fetch when niveau is empty', () => {
    const { wrapper, queryClient } = createTestWrapper();
    renderHook(() => useLearningSubjects(''), { wrapper });

    expect(mockApiClient.get).not.toHaveBeenCalled();

    queryClient.clear();
  });
});

describe('useLearningTopics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch topics for subject and level', async () => {
    mockApiClient.get.mockResolvedValueOnce({
      matiere: 'mathematiques',
      niveau: 'quatrieme',
      domaines: [
        {
          domaine: 'Algèbre',
          themes: ['Équations', 'Inéquations', 'Systèmes'],
        },
      ],
      totalTopics: 3,
    });

    const { wrapper, queryClient } = createTestWrapper();
    const { result } = renderHook(
      () => useLearningTopics('mathematiques', 'quatrieme'),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].domaine).toBe('Algèbre');
    expect(result.current.data?.[0].themes).toHaveLength(3);

    queryClient.clear();
  });

  it('should not fetch when matiere or niveau is empty', () => {
    const { wrapper: wrapper1, queryClient: qc1 } = createTestWrapper();
    renderHook(() => useLearningTopics('', 'quatrieme'), { wrapper: wrapper1 });
    expect(mockApiClient.get).not.toHaveBeenCalled();
    qc1.clear();

    const { wrapper: wrapper2, queryClient: qc2 } = createTestWrapper();
    renderHook(() => useLearningTopics('mathematiques', ''), {
      wrapper: wrapper2,
    });
    expect(mockApiClient.get).not.toHaveBeenCalled();
    qc2.clear();
  });
});
