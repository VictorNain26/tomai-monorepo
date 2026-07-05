/**
 * Tests — Chat stream route (routes/chat-message.routes.ts)
 *
 * Covers the guards that stay plain JSON before the UI Message Stream
 * starts (auth, quota, concurrency) and the post-stream contract:
 * `content-type`/`x-vercel-ai-ui-message-stream` headers, `onFinish`
 * persistence (user + assistant messages), and concurrency release even
 * when the stream throws.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Elysia } from 'elysia';
import { createMockLogger } from './_helpers/mock-logger';

// ============================================
// MOCKS (must be before any import of the real modules)
// ============================================

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

mock.module('../config/env', () => ({
  env: { MISTRAL_MODEL: 'mistral-medium-latest' },
}));

// authMacro — inject a mutable user into every guarded request
let currentUser: Record<string, unknown> | null = null;

const authMacroMock = new Elysia({ name: 'auth-macro' }).macro({
  auth: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolve(ctx: any) {
      if (!currentUser) {
        return ctx.status(401) as never;
      }
      return { user: currentUser, session: { id: 'sess-001' } };
    },
  },
});
mock.module('../lib/auth-macro', () => ({ authMacro: authMacroMock }));

// Rate-limit — no-op in tests
mock.module('../middleware/rate-limit.middleware', () => ({
  createRateLimitMiddleware: mock(() => () => {}),
  RateLimitPresets: { ai: {} },
}));

// tokenQuotaService — mutable quota outcome
let quotaAllowed = true;
const checkQuota = mock(async (_userId: string) => ({
  allowed: quotaAllowed,
  message: quotaAllowed ? undefined : 'Limite atteinte.',
  windowUsagePercent: 100,
  dailyUsagePercent: 100,
  windowRefreshIn: 3600,
  plan: 'free',
}));
mock.module('../services/token-quota.service', () => ({
  tokenQuotaService: { checkQuota },
}));

// chat-orchestration.service — the "business logic" seam
class ChatOrchestrationError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = 'ChatOrchestrationError';
  }
}

const prepareTurn = mock(async (_req: unknown) => ({
  sessionId: 'session-001',
  subject: undefined,
  conversationSummary: null,
  conversationHistory: [],
  cognitiveProfileSummary: null,
  mergedLearningContext: null,
  intentReinforcement: null,
  classifiedIntent: { intent: 'unknown', confidence: 'low', subject: 'general' },
  files: [],
  attachedFiles: [],
  attachedFileInfo: null,
  attachedFileInfos: undefined,
}));
const persistUserTurn = mock(async (_params: unknown) => {});
const finishTurn = mock(async (_params: unknown) => {});

mock.module('../services/chat/chat-orchestration.service', () => ({
  chatOrchestrationService: { prepareTurn, persistUserTurn, finishTurn },
  ChatOrchestrationError,
}));

// chat-tools — irrelevant to the route contract, stubbed
mock.module('../services/chat/chat-tools', () => ({
  buildChatTools: mock(() => ({})),
}));

// ai-chat.service — controls what the "model" produces on the wire
type FakeStreamChatResult = {
  toUIMessageStream: () => ReadableStream<unknown>;
  totalUsage: Promise<{ inputTokens: number; outputTokens: number; totalTokens: number; inputTokenDetails: { cacheReadTokens: number } }>;
};

let streamChatImpl: (params: unknown) => FakeStreamChatResult = () => ({
  toUIMessageStream: () =>
    new ReadableStream({
      start(controller) {
        controller.enqueue({ type: 'text-start', id: 't1' });
        controller.enqueue({ type: 'text-delta', id: 't1', delta: 'Bonjour' });
        controller.enqueue({ type: 'text-end', id: 't1' });
        controller.close();
      },
    }),
  totalUsage: Promise.resolve({
    inputTokens: 10,
    outputTokens: 5,
    totalTokens: 15,
    inputTokenDetails: { cacheReadTokens: 0 },
  }),
});

mock.module('../services/chat/ai-chat.service', () => ({
  streamChat: (params: unknown) => streamChatImpl(params),
}));

// Import real route AFTER all mocks are registered
const { chatMessageRoutes } = await import('../routes/chat-message.routes');

// ============================================
// Test app
// ============================================

const app = new Elysia().use(chatMessageRoutes);

function makeRequest(body?: unknown) {
  return new Request('http://localhost/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      body ?? {
        message: { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'Bonjour Tom' }] },
      },
    ),
  });
}

describe('POST /api/chat/stream', () => {
  beforeEach(() => {
    currentUser = null;
    quotaAllowed = true;
    checkQuota.mockClear();
    prepareTurn.mockClear();
    persistUserTurn.mockClear();
    finishTurn.mockClear();
    streamChatImpl = () => ({
      toUIMessageStream: () =>
        new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'text-start', id: 't1' });
            controller.enqueue({ type: 'text-delta', id: 't1', delta: 'Bonjour' });
            controller.enqueue({ type: 'text-end', id: 't1' });
            controller.close();
          },
        }),
      totalUsage: Promise.resolve({
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        inputTokenDetails: { cacheReadTokens: 0 },
      }),
    });
  });

  it('returns 401 when unauthenticated', async () => {
    currentUser = null;
    const res = await app.handle(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 429 JSON when the quota is exceeded', async () => {
    currentUser = { id: 'user-001', role: 'student', schoolLevel: 'sixieme', firstName: 'Léo' };
    quotaAllowed = false;
    const res = await app.handle(makeRequest());
    expect(res.status).toBe(429);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('QUOTA_EXCEEDED');
  });

  it('returns a 200 UI Message Stream response with the expected headers', async () => {
    currentUser = { id: 'user-001', role: 'student', schoolLevel: 'sixieme', firstName: 'Léo' };
    const res = await app.handle(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    expect(res.headers.get('x-vercel-ai-ui-message-stream')).toBe('v1');
    await res.text();
  });

  it('persists the user message before streaming and the assistant message in onFinish', async () => {
    currentUser = { id: 'user-001', role: 'student', schoolLevel: 'sixieme', firstName: 'Léo' };
    const res = await app.handle(makeRequest());
    await res.text();

    expect(persistUserTurn).toHaveBeenCalledTimes(1);
    expect(persistUserTurn.mock.calls[0]?.[0]).toMatchObject({
      sessionId: 'session-001',
      content: 'Bonjour Tom',
    });

    expect(finishTurn).toHaveBeenCalledTimes(1);
    const finishArgs = finishTurn.mock.calls[0]?.[0] as { sessionId: string; userId: string; responseMessage: { parts: unknown[] } };
    expect(finishArgs.sessionId).toBe('session-001');
    expect(finishArgs.userId).toBe('user-001');
    expect(finishArgs.responseMessage.parts).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'text', text: 'Bonjour' })]),
    );
  });

  it('releases the concurrency slot even when the stream throws', async () => {
    currentUser = { id: 'user-001', role: 'student', schoolLevel: 'sixieme', firstName: 'Léo' };
    streamChatImpl = () => {
      throw new Error('boom');
    };

    // MAX_CONCURRENT_STREAMS is 2 — send 3 requests sequentially, fully
    // consuming each stream (which drives release via onFinish/onError).
    // If the slot were never released, the 3rd request would 409.
    for (let i = 0; i < 3; i += 1) {
      const res = await app.handle(makeRequest());
      expect(res.status).toBe(200);
      await res.text();
    }
  });
});
