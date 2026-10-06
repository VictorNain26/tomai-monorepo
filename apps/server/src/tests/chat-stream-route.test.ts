/**
 * Tests — Chat stream route (modules/tutor/chat-message.routes.ts)
 *
 * Covers the guards that stay plain JSON before the UI Message Stream
 * starts (auth, quota, concurrency) and the post-stream contract:
 * `content-type`/`x-vercel-ai-ui-message-stream` headers, `onEnd`
 * persistence (user + assistant messages), concurrency release even when
 * the stream throws, no reasoning on the wire, and the usage recorded.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Hono } from 'hono';
import { z } from 'zod';
import { isStepCount, simulateReadableStream, streamText, tool, type ToolSet } from 'ai';
import type { TurnUsage } from '../modules/tutor/turn-usage';
import { MockLanguageModelV4 } from 'ai/test';
import type { AppEnv } from '../platform/http/context';
import { createMockLogger } from './_helpers/mock-logger';

// Moderation is a network call: stubbed, nothing flagged.
mock.module('../platform/ai/moderation', () => ({
  moderateReply: mock(async () => []),
  moderateTexts: mock(async (texts: string[]) => texts.map(() => [])),
}));


// ============================================
// MOCKS (must be before any import of the real modules)
// ============================================

const mockLogger = createMockLogger();
mock.module('../platform/observability/logger', () => ({ logger: mockLogger }));

mock.module('../platform/config/env', () => ({
  env: { MISTRAL_MODEL: 'mistral-small-2603' },
}));

// Auth — inject a mutable user into every guarded request
let currentUser: Record<string, unknown> | null = null;
const resolveUser = () =>
  Promise.resolve(
    currentUser
      ? { success: true as const, user: currentUser, session: { id: 'sess-001' } }
      : { success: false as const, _error: 'Unauthorized', status: 401 as const },
  );
mock.module('../platform/auth/session', () => ({
  requireAuth: resolveUser,
  requireParentRole: resolveUser,
}));

// Rate-limit — pass-through in tests
mock.module('../platform/http/rate-limit', () => ({
  createRateLimitMiddleware: () => (_c: unknown, next: () => Promise<void>) => next(),
  RateLimitPresets: { ai: {} },
}));

// checkQuota — mutable quota outcome
let quotaAllowed = true;
const checkQuota = mock(async (_userId: string) => ({
  allowed: quotaAllowed,
  plan: 'free' as const,
  usage: { plan: 'free' as const, spentMicroEur: 20_000, budgetMicroEur: 20_000, usagePercent: 100, resetsIn: '3h' },
}));
mock.module('../modules/billing/index', () => ({ checkQuota }));

// chat-orchestration.service — the "business logic" seam
class ChatOrchestrationError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = 'ChatOrchestrationError';
  }
}

const prepareTurn = mock(async (_req: unknown) => ({
  kind: 'tutor',
  sessionId: 'session-001',
  inputModeration: [],
  subject: undefined,
  conversationSummary: null,
  conversationHistory: [],
  turnInstruction: null,
  turnAnalysis: { subject: 'general', bringsExercise: false, proposesAnswer: false, asksSolution: false, asksExplanation: false, wantsFlashcards: false },
  files: [],
  attachedFiles: [],
  attachedFileInfo: null,
  attachedFileInfos: undefined,
}));
const persistUserTurn = mock(async (_params: unknown) => {});
const finishTurn = mock(async (_params: unknown) => {});

mock.module('../modules/tutor/chat-orchestration.service', () => ({
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
mock.module('../modules/tutor/chat-tools', () => ({
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
  const { tools, usage } = params as { tools: ToolSet; usage: TurnUsage };
  // Wired as streamChat wires it: the route reads the turn's usage from the meter.
  lastStreamChatResult = streamText({
    model: mockChatModel(),
    prompt: 'Bonjour Tom',
    tools,
    stopWhen: isStepCount(5),
    onLanguageModelCallStart: () => { usage.callStarted(); },
    onLanguageModelCallEnd: ({ usage: called }) => { usage.callEnded(called); },
  });
  return lastStreamChatResult;
}

let streamChatImpl: (params: unknown) => StreamChatResult = realStreamChat;

mock.module('../modules/tutor/ai-chat.service', () => ({
  streamChat: (params: unknown) => streamChatImpl(params),
}));

// Import real route AFTER all mocks are registered
const { chatMessageRoutes } = await import('../modules/tutor/chat-message.routes');
const { handleError } = await import('../platform/http/error-handler');

// ============================================
// Test app
// ============================================

const app = new Hono<AppEnv>().route('/api/chat', chatMessageRoutes).onError(handleError);

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
    const res = await app.fetch(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 429 JSON when the quota is exceeded', async () => {
    currentUser = { id: 'user-001', role: 'student', schoolLevel: 'sixieme', firstName: 'Léo' };
    quotaAllowed = false;
    const res = await app.fetch(makeRequest());
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({
      error: { code: 'QUOTA_EXCEEDED', message: 'Tu as atteint la limite du jour. Elle se remet à zéro à 10 h.' },
      usage: { usagePercent: 100, resetsIn: '3h', plan: 'free' },
    });
  });

  it('refuses a level outside the collège, which the prompt does not serve', async () => {
    currentUser = { id: 'user-001', role: 'student', schoolLevel: 'sixieme', firstName: 'Léo' };
    const res = await app.fetch(makeRequest({
      message: { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'Bonjour Tom' }] },
      schoolLevel: 'terminale',
    }));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('refuses a subject outside the collège taxonomy', async () => {
    currentUser = { id: 'user-001', role: 'student', schoolLevel: 'sixieme', firstName: 'Léo' };
    const res = await app.fetch(makeRequest({
      message: { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'Bonjour Tom' }] },
      subject: 'philosophie',
    }));
    expect(res.status).toBe(400);
  });

  it('returns a 200 UI Message Stream response with the expected headers', async () => {
    currentUser = { id: 'user-001', role: 'student', schoolLevel: 'sixieme', firstName: 'Léo' };
    const res = await app.fetch(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    expect(res.headers.get('x-vercel-ai-ui-message-stream')).toBe('v1');
    await res.text();
  });

  it('persists the user message before streaming and the assistant message in onEnd', async () => {
    currentUser = { id: 'user-001', role: 'student', schoolLevel: 'sixieme', firstName: 'Léo' };
    const res = await app.fetch(makeRequest());
    await res.text();

    expect(persistUserTurn).toHaveBeenCalledTimes(1);
    expect(persistUserTurn.mock.calls[0]?.[0]).toMatchObject({
      sessionId: 'session-001',
      content: 'Bonjour Tom',
    });

    expect(finishTurn).toHaveBeenCalledTimes(1);
    const finishArgs = finishTurn.mock.calls[0]?.[0] as { sessionId: string; userId: string; text: string; modelMessages: { role: string }[]; aborted: boolean; outputCheck?: unknown };
    // The model's response messages, tool call and result included, travel to the persistence,
    // with whether the stream was cut.
    expect(finishArgs.modelMessages.map((m) => m.role)).toEqual(['assistant', 'tool', 'assistant']);
    expect(finishArgs.aborted).toBe(false);
    expect(finishArgs.sessionId).toBe('session-001');
    expect(finishArgs.userId).toBe('user-001');
    expect(finishArgs.text).toBe('Bonjour');
    expect(finishArgs.outputCheck).toBeUndefined();
  });

  it('stores the text the student read after a held one, what was held, and replays the turn as read', async () => {
    currentUser = { id: 'user-001', role: 'student', schoolLevel: 'sixieme', firstName: 'Léo' };
    const sheet = {
      statement: 'Résous 3x + 5 = 20.', kind: 'short', answer: 'x = 5', answerForms: ['x = 5'], mathEquation: null, mathAnswer: null,
      steps: [], commonErrors: [], rule: null, facts: [], expectedElements: [], entries: [], laterEntries: [],
    };
    prepareTurn.mockImplementationOnce(async () => ({ ...(await prepareTurn.getMockImplementation()?.({})), exerciseSheet: sheet, exerciseUncertain: false }) as never);
    const replies = ['Donc x = 5.', 'Que fais-tu du + 5 ?'];
    streamChatImpl = (params) => {
      const { usage } = params as { usage: TurnUsage };
      const text = replies.shift() ?? '';
      return streamText({
        model: new MockLanguageModelV4({
          doStream: async () => ({
            stream: simulateReadableStream({
              chunkDelayInMs: 0,
              initialDelayInMs: 0,
              chunks: [
                { type: 'stream-start', warnings: [] },
                { type: 'text-start', id: 't' },
                { type: 'text-delta', id: 't', delta: text },
                { type: 'text-end', id: 't' },
                { type: 'finish', usage: stepUsage(10, 0, 2), finishReason: { unified: 'stop', raw: undefined } },
              ],
            }),
          }),
        }),
        prompt: 'Je bloque',
        onLanguageModelCallStart: () => { usage.callStarted(); },
        onLanguageModelCallEnd: ({ usage: called }) => { usage.callEnded(called); },
      });
    };

    const body = await (await app.fetch(makeRequest())).text();

    expect(body).not.toContain('x = 5');
    expect(body).toContain('Que fais-tu du + 5 ?');
    const finishArgs = finishTurn.mock.calls[0]?.[0] as { text: string; outputCheck: unknown; modelMessages: unknown; usage: { totalTokens: number } };
    expect(finishArgs.text).toBe('Que fais-tu du + 5 ?');
    expect(finishArgs.outputCheck).toEqual({ findings: ['answer'], outcome: 'regenerated' });
    expect(finishArgs.modelMessages).toEqual([{ role: 'assistant', content: [{ type: 'text', text: 'Que fais-tu du + 5 ?' }] }]);
    expect(finishArgs.usage.totalTokens).toBe(24);
  });

  it('releases the concurrency slot even when the stream throws', async () => {
    currentUser = { id: 'user-001', role: 'student', schoolLevel: 'sixieme', firstName: 'Léo' };
    streamChatImpl = () => {
      throw new Error('boom');
    };

    // MAX_CONCURRENT_STREAMS is 2 — send 3 requests sequentially, fully
    // consuming each stream (which drives release via onEnd/onError).
    // If the slot were never released, the 3rd request would 409.
    for (let i = 0; i < 3; i += 1) {
      const res = await app.fetch(makeRequest());
      expect(res.status).toBe(200);
      await res.text();
    }
  });

  it('never forwards the model reasoning to the client', async () => {
    currentUser = { id: 'user-001', role: 'student', schoolLevel: 'troisieme', firstName: 'Léo' };
    const res = await app.fetch(makeRequest());
    const body = await res.text();

    expect(body).toContain('"type":"text-delta"');
    expect(body).toContain('Bonjour');
    expect(body).not.toContain('"type":"reasoning');
    expect(body).not.toContain('secret chain of thought');
  });

  it('records the model usage summed over every step', async () => {
    currentUser = { id: 'user-001', role: 'student', schoolLevel: 'troisieme', firstName: 'Léo' };
    const res = await app.fetch(makeRequest());
    await res.text();

    const finishArgs = finishTurn.mock.calls[0]?.[0] as { usage: { totalTokens: number } };
    // The meter's sum of the calls is the SDK's total of the steps.
    expect(finishArgs.usage.totalTokens).toBe((await lastStreamChatResult?.usage)?.totalTokens ?? -1);
    expect(finishArgs.usage).toMatchObject({
      inputTokens: 220,
      outputTokens: 7,
      totalTokens: 227,
      inputTokenDetails: { cacheReadTokens: 164 },
    });
  });

  it('counts a cut turn with its estimated usage, waits for the model to end, and keeps no model messages', async () => {
    currentUser = { id: 'user-001', role: 'student', schoolLevel: 'troisieme', firstName: 'Léo' };
    streamChatImpl = (params) => {
      const meter = (params as { usage: { prompt: (text: string) => void; callStarted: () => void; delta: (text: string) => void } }).usage;
      meter.prompt('p'.repeat(400));
      return streamText({
        model: new MockLanguageModelV4({
          doStream: async ({ abortSignal }) => ({
            stream: new ReadableStream({
              start: (controller) => {
                controller.enqueue({ type: 'stream-start', warnings: [] });
                abortSignal?.addEventListener('abort', () => { controller.error(abortSignal.reason); });
              },
            }),
          }),
        }),
        prompt: 'Bonjour Tom',
        timeout: 100,
        onLanguageModelCallStart: () => { meter.callStarted(); meter.delta('r'.repeat(80)); },
      });
    };

    const res = await app.fetch(makeRequest());
    await res.text();

    const finishArgs = finishTurn.mock.calls[0]?.[0] as { usage: { totalTokens: number }; aborted: boolean; modelMessages: unknown };
    expect(finishArgs.aborted).toBe(true);
    // 400 prompt characters and 80 streamed ones, at 4 characters a token.
    expect(finishArgs.usage.totalTokens).toBe(120);
    expect(finishArgs.modelMessages).toBeUndefined();
  });
});
