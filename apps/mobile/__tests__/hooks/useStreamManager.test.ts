/**
 * Tests for useStreamManager hook
 *
 * Tests SSE streaming lifecycle: start, stop, cleanup, error handling.
 * EventSource is mocked since react-native-sse is a native module.
 *
 * @see src/hooks/chat/useStreamManager.ts
 */

import { renderHook, act } from '@testing-library/react-native';

// ============================================================================
// MOCKS
// ============================================================================

jest.mock('react-native-mmkv', () => {
  const store = new Map<string, string>();
  return {
    createMMKV: () => ({
      set: (key: string, val: string) => store.set(key, val),
      getString: (key: string) => store.get(key),
      remove: (key: string) => store.delete(key),
      contains: (key: string) => store.has(key),
      clearAll: () => store.clear(),
    }),
  };
});

const mockEventSourceInstance = {
  addEventListener: jest.fn(),
  removeAllEventListeners: jest.fn(),
  close: jest.fn(),
};

jest.mock('react-native-sse', () => {
  return jest.fn(() => mockEventSourceInstance);
});

jest.mock('@repo/api', () => ({
  getBaseUrl: () => 'https://api.test.com',
}));

jest.mock('@/lib/auth', () => ({
  authClient: {
    getCookie: jest.fn(() => 'session=test-cookie'),
  },
}));

import EventSource from 'react-native-sse';
import { useStreamManager, type StreamCallbacks } from '@/hooks/chat/useStreamManager';
import { authClient } from '@/lib/auth';

// ============================================================================
// HELPERS
// ============================================================================

function createMockCallbacks(): StreamCallbacks {
  return {
    setMessages: jest.fn(),
    setCreatedDecks: jest.fn(),
    setIsLoading: jest.fn(),
    setIsStreaming: jest.fn(),
    setError: jest.fn(),
    setStreamStatus: jest.fn(),
    setPendingAttachments: jest.fn(),
    pendingAttachmentsRef: { current: [] },
    pendingClearRef: { current: null },
    sessionIdRef: { current: 'session-1' },
    onStreamDone: jest.fn(),
    onDeckCreated: jest.fn(),
    onSessionChanged: jest.fn(),
  };
}

const mockUser = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@test.com',
  role: 'student' as const,
  schoolLevel: '6eme' as const,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

// ============================================================================
// TESTS
// ============================================================================

describe('useStreamManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEventSourceInstance.addEventListener.mockReset();
    mockEventSourceInstance.removeAllEventListeners.mockReset();
    mockEventSourceInstance.close.mockReset();
  });

  it('returns startStream, stopStream, and cleanup functions', () => {
    const callbacks = createMockCallbacks();
    const { result } = renderHook(() => useStreamManager(callbacks));

    expect(result.current.startStream).toBeDefined();
    expect(result.current.stopStream).toBeDefined();
    expect(result.current.cleanup).toBeDefined();
  });

  it('creates EventSource with correct URL and headers on startStream', () => {
    const callbacks = createMockCallbacks();
    const { result } = renderHook(() => useStreamManager(callbacks));

    act(() => {
      result.current.startStream('assistant-1', 'Hello', [], mockUser);
    });

    expect(EventSource).toHaveBeenCalledWith(
      'https://api.test.com/api/chat/stream',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Cookie: 'session=test-cookie',
        }),
      })
    );
  });

  it('sets loading and streaming state on startStream', () => {
    const callbacks = createMockCallbacks();
    const { result } = renderHook(() => useStreamManager(callbacks));

    act(() => {
      result.current.startStream('assistant-1', 'Hello', [], mockUser);
    });

    expect(callbacks.setIsLoading).toHaveBeenCalledWith(true);
    expect(callbacks.setIsStreaming).toHaveBeenCalledWith(true);
    expect(callbacks.setError).toHaveBeenCalledWith(null);
  });

  it('registers message, error, and close event listeners', () => {
    const callbacks = createMockCallbacks();
    const { result } = renderHook(() => useStreamManager(callbacks));

    act(() => {
      result.current.startStream('assistant-1', 'Hello', [], mockUser);
    });

    const eventTypes = mockEventSourceInstance.addEventListener.mock.calls.map(
      (call: unknown[]) => call[0]
    );
    expect(eventTypes).toContain('message');
    expect(eventTypes).toContain('error');
    expect(eventTypes).toContain('close');
  });

  it('includes fileIds in request body when attachments provided', () => {
    const callbacks = createMockCallbacks();
    const { result } = renderHook(() => useStreamManager(callbacks));

    const attachments = [
      { fileId: 'f1', fileName: 'test.pdf', mimeType: 'application/pdf' },
    ];

    act(() => {
      result.current.startStream('assistant-1', 'Check this file', attachments, mockUser);
    });

    const body = JSON.parse((EventSource as jest.Mock).mock.calls[0][1].body);
    expect(body.data.fileIds).toEqual(['f1']);
  });

  it('aborts with error when no cookie available', () => {
    (authClient.getCookie as jest.Mock).mockReturnValueOnce(null);

    const callbacks = createMockCallbacks();
    const { result } = renderHook(() => useStreamManager(callbacks));

    act(() => {
      result.current.startStream('assistant-1', 'Hello', [], mockUser);
    });

    // Should not create EventSource
    expect(EventSource).not.toHaveBeenCalled();
    // Should set error
    expect(callbacks.setError).toHaveBeenCalledWith('Session expirée — reconnecte-toi.');
    expect(callbacks.setIsLoading).toHaveBeenCalledWith(false);
    expect(callbacks.setIsStreaming).toHaveBeenCalledWith(false);
  });

  it('stopStream closes EventSource and resets state', () => {
    const callbacks = createMockCallbacks();
    const { result } = renderHook(() => useStreamManager(callbacks));

    act(() => {
      result.current.startStream('assistant-1', 'Hello', [], mockUser);
    });

    act(() => {
      result.current.stopStream();
    });

    expect(mockEventSourceInstance.removeAllEventListeners).toHaveBeenCalled();
    expect(mockEventSourceInstance.close).toHaveBeenCalled();
    expect(callbacks.setIsStreaming).toHaveBeenCalledWith(false);
    expect(callbacks.setIsLoading).toHaveBeenCalledWith(false);
  });

  it('cleanup closes EventSource without setting state', () => {
    const callbacks = createMockCallbacks();
    const { result } = renderHook(() => useStreamManager(callbacks));

    act(() => {
      result.current.startStream('assistant-1', 'Hello', [], mockUser);
    });

    act(() => {
      result.current.cleanup();
    });

    expect(mockEventSourceInstance.removeAllEventListeners).toHaveBeenCalled();
    expect(mockEventSourceInstance.close).toHaveBeenCalled();
  });

  it('cleans up previous EventSource when starting a new stream', () => {
    const callbacks = createMockCallbacks();
    const { result } = renderHook(() => useStreamManager(callbacks));

    act(() => {
      result.current.startStream('assistant-1', 'Hello', [], mockUser);
    });

    // Reset to track second call
    mockEventSourceInstance.removeAllEventListeners.mockClear();
    mockEventSourceInstance.close.mockClear();

    act(() => {
      result.current.startStream('assistant-2', 'World', [], mockUser);
    });

    // Previous EventSource should be cleaned up
    expect(mockEventSourceInstance.removeAllEventListeners).toHaveBeenCalled();
    expect(mockEventSourceInstance.close).toHaveBeenCalled();
  });

  it('sends sessionId from sessionIdRef in request body', () => {
    const callbacks = createMockCallbacks();
    callbacks.sessionIdRef.current = 'my-session-42';
    const { result } = renderHook(() => useStreamManager(callbacks));

    act(() => {
      result.current.startStream('assistant-1', 'Question', [], mockUser);
    });

    const body = JSON.parse((EventSource as jest.Mock).mock.calls[0][1].body);
    expect(body.data.sessionId).toBe('my-session-42');
  });

  describe('SSE event handling', () => {
    function getEventHandler(eventType: string): (event: Record<string, unknown>) => void {
      const call = mockEventSourceInstance.addEventListener.mock.calls.find(
        (c: unknown[]) => c[0] === eventType
      );
      return call?.[1] as (event: Record<string, unknown>) => void;
    }

    it('handles [DONE] event: closes stream and calls onStreamDone', () => {
      const callbacks = createMockCallbacks();
      const { result } = renderHook(() => useStreamManager(callbacks));

      act(() => {
        result.current.startStream('assistant-1', 'Hello', [], mockUser);
      });

      const messageHandler = getEventHandler('message');

      act(() => {
        messageHandler({ data: '[DONE]' });
      });

      expect(mockEventSourceInstance.close).toHaveBeenCalled();
      expect(callbacks.setIsLoading).toHaveBeenCalledWith(false);
      expect(callbacks.setIsStreaming).toHaveBeenCalledWith(false);
      expect(callbacks.onStreamDone).toHaveBeenCalledWith('session-1');
    });

    it('handles content chunk: schedules rAF flush', () => {
      const callbacks = createMockCallbacks();
      const { result } = renderHook(() => useStreamManager(callbacks));

      act(() => {
        result.current.startStream('assistant-1', 'Hello', [], mockUser);
      });

      // Clear calls from startStream setup
      (callbacks.setError as jest.Mock).mockClear();

      const messageHandler = getEventHandler('message');
      const chunk = JSON.stringify({ type: 'content', id: 'c1', content: 'Bonjour!' });

      act(() => {
        messageHandler({ data: chunk });
      });

      // rAF is called — content will flush on next frame
      expect(callbacks.setError).not.toHaveBeenCalled();
    });

    it('handles error chunk: aborts stream with error message', () => {
      const callbacks = createMockCallbacks();
      const { result } = renderHook(() => useStreamManager(callbacks));

      act(() => {
        result.current.startStream('assistant-1', 'Hello', [], mockUser);
      });

      // Clear calls from startStream setup
      (callbacks.setError as jest.Mock).mockClear();

      const messageHandler = getEventHandler('message');
      const errorChunk = JSON.stringify({
        type: 'error',
        id: 'e1',
        error: { message: 'Quota exceeded' },
      });

      act(() => {
        messageHandler({ data: errorChunk });
      });

      expect(callbacks.setError).toHaveBeenCalledWith('Quota exceeded');
      expect(mockEventSourceInstance.close).toHaveBeenCalled();
    });

    it('handles done chunk with new sessionId: calls onSessionChanged', () => {
      const callbacks = createMockCallbacks();
      callbacks.sessionIdRef.current = 'old-session';
      const { result } = renderHook(() => useStreamManager(callbacks));

      act(() => {
        result.current.startStream('assistant-1', 'Hello', [], mockUser);
      });

      const messageHandler = getEventHandler('message');
      const doneChunk = JSON.stringify({
        type: 'done',
        id: 'd1',
        metadata: { sessionId: 'new-session-99' },
      });

      act(() => {
        messageHandler({ data: doneChunk });
      });

      expect(callbacks.onSessionChanged).toHaveBeenCalledWith('new-session-99');
    });

    it('handles deck_created chunk: adds deck and calls onDeckCreated', () => {
      const callbacks = createMockCallbacks();
      const { result } = renderHook(() => useStreamManager(callbacks));

      act(() => {
        result.current.startStream('assistant-1', 'Create cards', [], mockUser);
      });

      const messageHandler = getEventHandler('message');
      const deckChunk = JSON.stringify({
        type: 'deck_created',
        id: 'dk1',
        deck: { deckId: 'deck-1', title: 'Fractions', cardCount: 10, subject: 'maths' },
      });

      act(() => {
        messageHandler({ data: deckChunk });
      });

      expect(callbacks.setCreatedDecks).toHaveBeenCalled();
      expect(callbacks.onDeckCreated).toHaveBeenCalled();
    });

    it('ignores events with no data', () => {
      const callbacks = createMockCallbacks();
      const { result } = renderHook(() => useStreamManager(callbacks));

      act(() => {
        result.current.startStream('assistant-1', 'Hello', [], mockUser);
      });

      // Clear calls from startStream (setError(null) is called during setup)
      (callbacks.setError as jest.Mock).mockClear();
      (callbacks.onStreamDone as jest.Mock).mockClear();

      const messageHandler = getEventHandler('message');

      act(() => {
        messageHandler({ data: null });
        messageHandler({ data: undefined });
      });

      expect(callbacks.setError).not.toHaveBeenCalled();
      expect(callbacks.onStreamDone).not.toHaveBeenCalled();
    });

    it('ignores malformed JSON gracefully', () => {
      const callbacks = createMockCallbacks();
      const { result } = renderHook(() => useStreamManager(callbacks));

      act(() => {
        result.current.startStream('assistant-1', 'Hello', [], mockUser);
      });

      // Clear calls from startStream setup
      (callbacks.setError as jest.Mock).mockClear();

      const messageHandler = getEventHandler('message');

      act(() => {
        messageHandler({ data: '{broken json' });
      });

      // Should not crash or set error (just console.error)
      expect(callbacks.setError).not.toHaveBeenCalled();
    });

    it('handles EventSource error event: aborts with connection error', () => {
      const callbacks = createMockCallbacks();
      const { result } = renderHook(() => useStreamManager(callbacks));

      act(() => {
        result.current.startStream('assistant-1', 'Hello', [], mockUser);
      });

      const errorHandler = getEventHandler('error');

      act(() => {
        errorHandler({});
      });

      expect(callbacks.setError).toHaveBeenCalledWith('Erreur de connexion au serveur');
    });

    it('restores pending attachments on abort when server never confirmed', () => {
      const savedAttachments = [{ fileId: 'f1', fileName: 'doc.pdf', mimeType: 'application/pdf' }];
      const callbacks = createMockCallbacks();
      callbacks.pendingClearRef.current = savedAttachments;

      const { result } = renderHook(() => useStreamManager(callbacks));

      act(() => {
        result.current.startStream('assistant-1', 'Hello', [], mockUser);
      });

      const errorHandler = getEventHandler('error');

      act(() => {
        errorHandler({});
      });

      expect(callbacks.setPendingAttachments).toHaveBeenCalledWith(savedAttachments);
    });

    it('handles inactivity timeout: aborts stream after 90s', () => {
      const callbacks = createMockCallbacks();
      const { result } = renderHook(() => useStreamManager(callbacks));

      act(() => {
        result.current.startStream('assistant-1', 'Hello', [], mockUser);
      });

      // Advance fake timers past the 90s inactivity threshold
      act(() => {
        jest.advanceTimersByTime(90_000);
      });

      expect(callbacks.setError).toHaveBeenCalledWith(
        expect.stringContaining('ne répond plus')
      );
    });
  });
});
