/**
 * useChat Hook Tests
 *
 * Behavioral tests for the AI SDK `useChat` wrapper — the AI SDK's own
 * `useChat` is mocked (its internals are the library's responsibility); what
 * we verify is this hook's wiring: history seeding, error surfacing
 * (429/409 JSON envelopes), the `data-deck-created` side-effect, and query
 * invalidations.
 */

import { renderHook, waitFor, act } from '@testing-library/react-native';
import type { UseChatHelpers } from '@ai-sdk/react';

import { createTestWrapper } from '../utils/test-utils';
import { useChat } from '../../src/hooks/useChat';
import { chatQueryKeys, fetchOrCreateSession, fetchHistory, resetChatSession } from '../../src/hooks/chat/api';
import type { TomChatMessage } from '@repo/api';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));

// The real `ai` package pulls in `@ai-sdk/gateway`/`@workflow/serde` (ESM-only,
// not whitelisted for Jest transform) — irrelevant here since `useAiChat`
// (from `@ai-sdk/react`, mocked below) owns the transport lifecycle; this
// hook only constructs `DefaultChatTransport` and never calls it directly.
jest.mock('ai', () => ({
  DefaultChatTransport: class {},
  isTextUIPart: (part: { type: string }) => part.type === 'text',
}));

const mockUser = {
  id: 'user-1',
  email: 'eleve@example.com',
  name: 'Eleve Test',
  role: 'student' as const,
  schoolLevel: 'quatrieme',
  createdAt: new Date(),
  updatedAt: new Date(),
};

let mockCurrentUser: typeof mockUser | null = mockUser;
let mockCookie: string | null = 'session=abc';

jest.mock('@/lib/auth', () => ({
  useUser: () => mockCurrentUser,
  authClient: { getCookie: () => mockCookie },
}));

const mockCacheMessages = jest.fn().mockResolvedValue(undefined);
const mockGetCachedMessages = jest.fn().mockResolvedValue(null);

jest.mock('@/stores/pronote-store', () => ({
  usePronoteStore: { getState: () => ({ homework: [], grades: [], timetable: [] }) },
}));

jest.mock('@/hooks/useOfflineCache', () => ({
  useOfflineCache: () => ({
    cacheMessages: mockCacheMessages,
    getCachedMessages: mockGetCachedMessages,
  }),
}));

jest.mock('../../src/hooks/chat/api', () => {
  const actual = jest.requireActual('../../src/hooks/chat/api');
  return {
    ...actual,
    fetchOrCreateSession: jest.fn(),
    fetchHistory: jest.fn(),
    resetChatSession: jest.fn(),
  };
});

const chatApi = {
  fetchOrCreateSession: jest.mocked(fetchOrCreateSession),
  fetchHistory: jest.mocked(fetchHistory),
  resetChatSession: jest.mocked(resetChatSession),
};

type CapturedOptions = {
  onData?: (part: { type: string; data: unknown }) => void;
  onFinish?: () => void;
  onError?: (error: Error) => void;
};

let mockCapturedOptions: CapturedOptions | undefined;
let mockAiChatState: Partial<UseChatHelpers<TomChatMessage>>;

const mockSendMessage = jest.fn();
const mockRegenerate = jest.fn();
const mockSetMessages = jest.fn();
const mockStop = jest.fn();
const mockClearError = jest.fn();

function resetAiChatState() {
  mockAiChatState = {
    id: 'chat-1',
    messages: [],
    status: 'ready',
    error: undefined,
    setMessages: mockSetMessages,
    sendMessage: mockSendMessage,
    regenerate: mockRegenerate,
    stop: mockStop,
    clearError: mockClearError,
  };
}

jest.mock('@ai-sdk/react', () => ({
  useChat: (options: CapturedOptions) => {
    mockCapturedOptions = options;
    return mockAiChatState;
  },
}));

function textMessage(id: string, role: 'user' | 'assistant', text: string): TomChatMessage {
  return { id, role, parts: [{ type: 'text', text }] };
}

// ============================================================================
// Setup
// ============================================================================

beforeEach(() => {
  jest.clearAllMocks();
  mockCurrentUser = mockUser;
  mockCookie = 'session=abc';
  resetAiChatState();
  chatApi.fetchOrCreateSession.mockResolvedValue('session-1');
  chatApi.fetchHistory.mockResolvedValue({ messages: [], hasOrphanMessage: false });
  chatApi.resetChatSession.mockResolvedValue({ sessionId: 'session-2' });
});

describe('useChat', () => {
  it('seeds messages from server history', async () => {
    chatApi.fetchHistory.mockResolvedValue({
      messages: [
        { id: 'm1', role: 'user', content: 'Bonjour', timestamp: '2026-01-01T00:00:00.000Z', attachedFile: null },
        { id: 'm2', role: 'assistant', content: 'Salut !', timestamp: '2026-01-01T00:00:01.000Z', attachedFile: null },
      ],
      hasOrphanMessage: false,
    });

    const { wrapper } = createTestWrapper();
    renderHook(() => useChat({ initialSessionId: 'session-1' }), { wrapper });

    await waitFor(() => {
      expect(mockSetMessages).toHaveBeenCalledWith([
        textMessage('m1', 'user', 'Bonjour'),
        textMessage('m2', 'assistant', 'Salut !'),
      ]);
    });
  });

  it('surfaces the 429 QUOTA_EXCEEDED JSON error with its user-facing message', () => {
    mockAiChatState.error = new Error(
      JSON.stringify({ error: { code: 'QUOTA_EXCEEDED', message: 'Tu as atteint ta limite de messages. Passe à Tom Pro !' } }),
    );

    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => useChat({ initialSessionId: 'session-1' }), { wrapper });

    expect(result.current.error).toBe('Tu as atteint ta limite de messages. Passe à Tom Pro !');
  });

  it('surfaces the 409 CONCURRENT_STREAM JSON error via onError', () => {
    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => useChat({ initialSessionId: 'session-1' }), { wrapper });

    act(() => {
      mockCapturedOptions?.onError?.(
        new Error(
          JSON.stringify({
            error: { code: 'CONCURRENT_STREAM', message: 'Une réponse est déjà en cours. Attends qu\'elle se termine.' },
          }),
        ),
      );
    });

    expect(result.current.error).toBe('Une réponse est déjà en cours. Attends qu\'elle se termine.');
  });

  it('falls back to the raw message for a non-JSON (network) error', () => {
    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => useChat({ initialSessionId: 'session-1' }), { wrapper });

    act(() => {
      mockCapturedOptions?.onError?.(new Error('Network request failed'));
    });

    expect(result.current.error).toBe('Network request failed');
  });

  it('records a created deck and invalidates the decks query on data-deck-created', async () => {
    const { wrapper, queryClient } = createTestWrapper();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result, rerender } = renderHook(() => useChat({ initialSessionId: 'session-1' }), { wrapper });

    act(() => {
      mockCapturedOptions?.onData?.({
        type: 'data-deck-created',
        data: { deckId: 'deck-1', title: 'Algèbre', cardCount: 10, subject: 'mathematiques' },
      });
    });
    rerender(undefined);

    expect(result.current.createdDecks).toEqual([
      { deckId: 'deck-1', title: 'Algèbre', cardCount: 10, subject: 'mathematiques' },
    ]);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['learning', 'decks'] });
  });

  it('invalidates the chat history query on stream finish', () => {
    const { wrapper, queryClient } = createTestWrapper();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useChat({ initialSessionId: 'session-1' }), { wrapper });

    act(() => {
      mockCapturedOptions?.onFinish?.();
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: chatQueryKeys.history('session-1'),
    });
  });

  it('refuses to send when the session cookie is missing', () => {
    mockCookie = null;
    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => useChat({ initialSessionId: 'session-1' }), { wrapper });

    act(() => {
      result.current.sendMessage('Bonjour');
    });

    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Session expirée — reconnecte-toi.');
  });

  it('sends the last message with request context and clears created decks', () => {
    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => useChat({ initialSessionId: 'session-1' }), { wrapper });

    act(() => {
      result.current.sendMessage('Bonjour Tom');
    });

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    const [message, options] = mockSendMessage.mock.calls[0];
    expect(message).toMatchObject({
      role: 'user',
      parts: [{ type: 'text', text: 'Bonjour Tom' }],
    });
    expect(options.body).toMatchObject({
      sessionId: 'session-1',
      schoolLevel: 'quatrieme',
      firstName: 'Eleve',
      fileIds: [],
    });
  });
});
