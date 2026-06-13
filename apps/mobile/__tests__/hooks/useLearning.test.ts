/**
 * useLearning Hook Tests
 *
 * Tests for learning deck operations and AI generation.
 * Follows TanStack Query testing best practices.
 * @see https://tanstack.com/query/v4/docs/framework/react/guides/testing
 */

import { renderHook, waitFor, act } from '@testing-library/react-native';
import { getTreaty } from '@repo/api';

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

const mockGetTreaty = getTreaty as jest.MockedFunction<typeof getTreaty>;

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
  createdAt: new Date('2025-01-10T10:00:00Z'),
  updatedAt: new Date('2025-01-10T10:00:00Z'),
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
  createdAt: new Date('2025-01-10T10:00:00Z'),
  updatedAt: new Date('2025-01-10T10:00:00Z'),
};

function mockTreatyApi(overrides: Record<string, unknown>) {
  mockGetTreaty.mockReturnValue({
    api: {
      learning: {
        decks: Object.assign(
          jest.fn(() => ({
            get: jest.fn().mockResolvedValue({ data: null, error: { status: 404, value: 'Not found' } }),
            delete: jest.fn().mockResolvedValue({ data: { success: true }, error: null }),
          })),
          {
            get: jest.fn().mockResolvedValue({ data: { decks: [], count: 0 }, error: null }),
            post: jest.fn().mockResolvedValue({ data: { deck: mockDeck }, error: null }),
          }
        ),
        subjects: {
          get: jest.fn().mockResolvedValue({ data: { subjects: [] }, error: null }),
        },
        topics: {
          get: jest.fn().mockResolvedValue({ data: { domaines: [] }, error: null }),
        },
        generate: {
          post: jest.fn().mockResolvedValue({ data: null, error: { status: 500, value: 'Error' } }),
        },
      },
      ...overrides,
    },
  } as unknown as ReturnType<typeof getTreaty>);
}

describe('useDecks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch decks successfully', async () => {
    mockTreatyApi({});
    const decksGet = mockGetTreaty().api.learning.decks.get as unknown as jest.Mock;
    decksGet.mockResolvedValueOnce({
      data: { decks: [mockDeck], count: 1 },
      error: null,
    });

    const { wrapper, queryClient } = createTestWrapper();
    const { result } = renderHook(() => useDecks(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].title).toBe('Mathématiques - Algèbre');

    queryClient.clear();
  });

  it('should handle fetch error', async () => {
    mockTreatyApi({});
    const decksGet = mockGetTreaty().api.learning.decks.get as unknown as jest.Mock;
    decksGet.mockResolvedValueOnce({
      data: null,
      error: { status: 500, value: { message: 'Network error' } },
    });

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
    const mockDeckGet = jest.fn().mockResolvedValueOnce({
      data: { deck: mockDeck, cards: [mockCard] },
      error: null,
    });
    mockGetTreaty.mockReturnValue({
      api: {
        learning: {
          decks: Object.assign(
            jest.fn(() => ({ get: mockDeckGet, delete: jest.fn() })),
            { get: jest.fn(), post: jest.fn() }
          ),
        },
      },
    } as unknown as ReturnType<typeof getTreaty>);

    const { wrapper, queryClient } = createTestWrapper();
    const { result } = renderHook(() => useDeck('deck-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.deck.id).toBe('deck-1');
    expect(result.current.data?.cards).toHaveLength(1);

    queryClient.clear();
  });

  it('should not fetch when id is empty', async () => {
    mockTreatyApi({});
    const treaty = mockGetTreaty();

    const { wrapper, queryClient } = createTestWrapper();
    const { result } = renderHook(() => useDeck(''), { wrapper });
    await act(async () => {
      await Promise.resolve();
    });

    // Empty id => enabled:false => the query must stay idle and never hit the API.
    expect(treaty.api.learning.decks).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');

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
        decksRemainingToday: 3,
        decksRemainingThisMonth: 10,
      },
    };

    const generatePost = jest.fn().mockResolvedValueOnce({
      data: mockResponse,
      error: null,
    });
    mockGetTreaty.mockReturnValue({
      api: {
        learning: {
          decks: Object.assign(jest.fn(), { get: jest.fn(), post: jest.fn() }),
          generate: { post: generatePost },
        },
      },
    } as unknown as ReturnType<typeof getTreaty>);

    const { wrapper, queryClient } = createTestWrapper();
    const { result } = renderHook(() => useGenerateDeck(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        subject: 'mathematiques',
        domaine: 'Algèbre',
        topic: 'Équations',
      });
    });

    expect(generatePost).toHaveBeenCalledWith({
      subject: 'mathematiques',
      domaine: 'Algèbre',
      topic: 'Équations',
    });

    queryClient.clear();
  });

  it('should handle generation error', async () => {
    const generatePost = jest.fn().mockResolvedValueOnce({
      data: null,
      error: { status: 403, value: { message: 'Abonnement requis', code: 'SUBSCRIPTION_REQUIRED' } },
    });
    mockGetTreaty.mockReturnValue({
      api: {
        learning: {
          decks: Object.assign(jest.fn(), { get: jest.fn(), post: jest.fn() }),
          generate: { post: generatePost },
        },
      },
    } as unknown as ReturnType<typeof getTreaty>);

    const { wrapper, queryClient } = createTestWrapper();
    const { result } = renderHook(() => useGenerateDeck(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          subject: 'mathematiques',
          domaine: 'Algèbre',
        });
      })
    ).rejects.toThrow('Abonnement requis');

    queryClient.clear();
  });
});

describe('useLearningSubjects', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch subjects for a level', async () => {
    const subjectsGet = jest.fn().mockResolvedValueOnce({
      data: {
        niveau: 'quatrieme',
        subjects: [
          { id: 'mathematiques', label: 'Mathématiques' },
          { id: 'francais', label: 'Français' },
        ],
      },
      error: null,
    });
    mockGetTreaty.mockReturnValue({
      api: {
        learning: {
          subjects: { get: subjectsGet },
        },
      },
    } as unknown as ReturnType<typeof getTreaty>);

    const { wrapper, queryClient } = createTestWrapper();
    const { result } = renderHook(() => useLearningSubjects('quatrieme'), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(2);

    queryClient.clear();
  });

  it('should not fetch when niveau is empty', async () => {
    mockTreatyApi({});
    const treaty = mockGetTreaty();

    const { wrapper, queryClient } = createTestWrapper();
    const { result } = renderHook(() => useLearningSubjects(undefined), { wrapper });
    await act(async () => {
      await Promise.resolve();
    });

    expect(treaty.api.learning.subjects.get).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');

    queryClient.clear();
  });
});

describe('useLearningTopics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch topics for subject and level', async () => {
    const topicsGet = jest.fn().mockResolvedValueOnce({
      data: {
        matiere: 'mathematiques',
        niveau: 'quatrieme',
        domaines: [
          {
            domaine: 'Algèbre',
            themes: ['Équations', 'Inéquations', 'Systèmes'],
          },
        ],
        totalTopics: 3,
      },
      error: null,
    });
    mockGetTreaty.mockReturnValue({
      api: {
        learning: {
          topics: { get: topicsGet },
        },
      },
    } as unknown as ReturnType<typeof getTreaty>);

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

  it('should not fetch when matiere or niveau is empty', async () => {
    mockTreatyApi({});
    const treaty = mockGetTreaty();

    const { wrapper: wrapper1, queryClient: qc1 } = createTestWrapper();
    const { result: result1 } = renderHook(() => useLearningTopics('', 'quatrieme'), {
      wrapper: wrapper1,
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result1.current.fetchStatus).toBe('idle');
    qc1.clear();

    const { wrapper: wrapper2, queryClient: qc2 } = createTestWrapper();
    const { result: result2 } = renderHook(() => useLearningTopics('mathematiques', undefined), {
      wrapper: wrapper2,
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result2.current.fetchStatus).toBe('idle');
    qc2.clear();

    // Neither partial-arg combination may reach the API.
    expect(treaty.api.learning.topics.get).not.toHaveBeenCalled();
  });
});
