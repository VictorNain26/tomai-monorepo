/**
 * Tests — Chat stream route (routes/chat-message.routes.ts)
 *
 * Covers the guards that stay plain JSON before the UI Message Stream
 * starts (auth, quota, concurrency) and the post-stream contract:
 * `content-type`/`x-vercel-ai-ui-message-stream` headers, `onFinish`
 * persistence (user + assistant messages), concurrency release even when
 * the stream throws, no reasoning on the wire, and the usage recorded.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Elysia } from 'elysia';
import { z } from 'zod';
import { isStepCount, simulateReadableStream, streamText, tool, type ToolSet } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { createMockLogger } from './_helpers/mock-logger';

// ============================================
// MOCKS (must be before any import of the real modules)
// ============================================

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

mock.module('../config/env', () => ({
  env: { MISTRAL_MODEL: 'mistral-small-2603' },
}));

// authMacro — inject a mutable user into every guarded request
let currentUser: Record<string, unknown> | null = null;

interface MacroResolveContext {
  status: (code: number) => unknown;
}

const authMacroMock = new Elysia({ name: 'auth-macro' }).macro({
  auth: {
    resolve(ctx: MacroResolveContext) {
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

const chatTools: ToolSet = {
  noop_tool: tool({
    description: 'Test-only no-op tool',
    inputSchema: z.object({}),
    execute: async () => 'ok',
  }),
};
mock.module('../services/chat/chat-tools', () => ({
  buildChatTools: mock(() => chatTools),
}));

// ai-chat.service — a real streamText over a mock model: step 1 calls a
// tool, step 2 reasons then answers, so usage spans two steps.
function stepUsage(input: number, cacheRead: number, output: number) {
  return {
    inputTokens: { total: input, noCache: input - cacheRead, cacheRead, cacheWrite: undefined },
    outputTokens: { total: output, text: output, reasoning: undefined },
  };
}

function mockChatModel(): MockLanguageModelV4 {
  let callIndex = 0;
  return new MockLanguageModelV4({
    doStream: async () => {
      callIndex += 1;
      if (callIndex === 1) {
        return {
          stream: simulateReadableStream({
            chunkDelayInMs: 0,
            initialDelayInMs: 0,
            chunks: [
              { type: 'stream-start', warnings: [] },
              { type: 'tool-call', toolCallId: 'call-1', toolName: 'noop_tool', input: '{}' },
              { type: 'finish', usage: stepUsage(100, 64, 3), finishReason: { unified: 'tool-calls', raw: undefined } },
            ],
          }),
        };
      }
      return {
        stream: simulateReadableStream({
          chunkDelayInMs: 0,
          initialDelayInMs: 0,
          chunks: [
            { type: 'stream-start', warnings: [] },
            { type: 'reasoning-start', id: 'r1' },
            { type: 'reasoning-delta', id: 'r1', delta: 'secret chain of thought' },
            { type: 'reasoning-end', id: 'r1' },
            { type: 'text-start', id: 't1' },
            { type: 'text-delta', id: 't1', delta: 'Bonjour' },
            { type: 'text-end', id: 't1' },
            { type: 'finish', usage: stepUsage(120, 100, 4), finishReason: { unified: 'stop', raw: undefined } },
          ],
        }),
      };
    },
  });
}

type StreamChatResult = ReturnType<typeof streamText>;

let lastStreamChatResult: StreamChatResult | undefined;

function realStreamChat(params: unknown): StreamChatResult {
  lastStreamChatResult = streamText({
    model: mockChatModel(),
    prompt: 'Bonjour Tom',
    tools: (params as { tools: ToolSet }).tools,
    stopWhen: isStepCount(5),
  });
  return lastStreamChatResult;
}

let streamChatImpl: (params: unknown) => StreamChatResult = realStreamChat;

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
    lastStreamChatResult = undefined;
    streamChatImpl = realStreamChat;
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

  it('never forwards the model reasoning to the client', async () => {
    currentUser = { id: 'user-001', role: 'student', schoolLevel: 'troisieme', firstName: 'Léo' };
    const res = await app.handle(makeRequest());
    const body = await res.text();

    expect(body).toContain('"type":"text-delta"');
    expect(body).toContain('Bonjour');
    expect(body).not.toContain('"type":"reasoning');
    expect(body).not.toContain('secret chain of thought');
  });

  it('records the model usage summed over every step', async () => {
    currentUser = { id: 'user-001', role: 'student', schoolLevel: 'troisieme', firstName: 'Léo' };
    const res = await app.handle(makeRequest());
    await res.text();

    const finishArgs = finishTurn.mock.calls[0]?.[0] as { usage: unknown };
    expect(finishArgs.usage).toEqual(await lastStreamChatResult?.usage);
    expect(finishArgs.usage).toMatchObject({
      inputTokens: 220,
      outputTokens: 7,
      totalTokens: 227,
      inputTokenDetails: { cacheReadTokens: 164 },
    });
  });
});
