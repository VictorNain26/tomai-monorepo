/**
 * Tests unitaires — AiChatService (services/chat/ai-chat.service.ts)
 *
 * Verifies the streamText wiring against a `MockLanguageModelV4` (the
 * interface version @ai-sdk/mistral@4.0.48 implements — confirmed in
 * node_modules/@ai-sdk/mistral/dist/index.d.ts): the system prompt lands as
 * the first prompt message, `stopWhen: isStepCount(5)` caps the agentic loop,
 * and text chunks stream out in order. No network call, no real tool
 * execution — a trivial fake tool stands in for `buildChatTools`'s output.
 */

import './_helpers/mistral-env';
import { describe, it, expect, afterEach } from 'bun:test';
import { z } from 'zod';
import { tool, type ToolSet, simulateReadableStream, toUIMessageStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { streamChat, type ChatStreamParams } from '../services/chat/ai-chat.service.js';

const baseParams: Omit<ChatStreamParams, 'model' | 'tools'> = {
  userId: 'user-001',
  sessionId: 'session-001',
  content: 'Bonjour Tom',
  schoolLevel: 'troisieme',
  userRole: 'student',
  conversationHistory: [],
};

const noopTools: ToolSet = {
  noop_tool: tool({
    description: 'Test-only no-op tool',
    inputSchema: z.object({}),
    execute: async () => 'ok',
  }),
};

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};

const stopFinishReason = { unified: 'stop' as const, raw: undefined };
const toolCallsFinishReason = { unified: 'tool-calls' as const, raw: undefined };

function finishStreamPart(): { type: 'finish'; usage: typeof usage; finishReason: typeof stopFinishReason } {
  return { type: 'finish', usage, finishReason: stopFinishReason };
}

describe('streamChat', () => {
  it('assembles the system prompt as the first message sent to the model', async () => {
    const model = new MockLanguageModelV4({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunkDelayInMs: 0,
          initialDelayInMs: 0,
          chunks: [{ type: 'stream-start', warnings: [] }, finishStreamPart()],
        }),
      }),
    });

    const result = streamChat({ ...baseParams, tools: noopTools, model });
    await result.text;

    const firstCall = model.doStreamCalls[0];
    expect(firstCall?.prompt[0]).toEqual({
      role: 'system',
      content: expect.any(String),
    });
  });

  it('stops the agentic loop after 5 steps via stopWhen: isStepCount(5)', async () => {
    let callIndex = 0;
    const model = new MockLanguageModelV4({
      doStream: async () => {
        callIndex += 1;
        return {
          stream: simulateReadableStream({
            chunkDelayInMs: 0,
            initialDelayInMs: 0,
            chunks: [
              { type: 'stream-start', warnings: [] },
              {
                type: 'tool-call',
                toolCallId: `call-${callIndex}`,
                toolName: 'noop_tool',
                input: '{}',
              },
              { type: 'finish', usage, finishReason: toolCallsFinishReason },
            ],
          }),
        };
      },
    });

    const result = streamChat({ ...baseParams, tools: noopTools, model });
    await result.text;

    expect(model.doStreamCalls.length).toBe(5);
  });

  it('streams text chunks in order', async () => {
    const model = new MockLanguageModelV4({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunkDelayInMs: 0,
          initialDelayInMs: 0,
          chunks: [
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Bonjour ' },
            { type: 'text-delta', id: 'text-1', delta: 'le monde' },
            { type: 'text-end', id: 'text-1' },
            finishStreamPart(),
          ],
        }),
      }),
    });

    const result = streamChat({ ...baseParams, tools: noopTools, model });

    const received: string[] = [];
    for await (const chunk of result.textStream) {
      received.push(chunk);
    }

    expect(received).toEqual(['Bonjour ', 'le monde']);
  });

  it('never forwards reasoning chunks through toUIMessageStream with sendReasoning: false — a real serialized stream, not just the option value', async () => {
    const model = new MockLanguageModelV4({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunkDelayInMs: 0,
          initialDelayInMs: 0,
          chunks: [
            { type: 'stream-start', warnings: [] },
            { type: 'reasoning-start', id: 'r1' },
            { type: 'reasoning-delta', id: 'r1', delta: 'thinking...' },
            { type: 'reasoning-end', id: 'r1' },
            { type: 'text-start', id: 't1' },
            { type: 'text-delta', id: 't1', delta: 'Bonjour' },
            { type: 'text-end', id: 't1' },
            finishStreamPart(),
          ],
        }),
      }),
    });

    const result = streamChat({ ...baseParams, tools: noopTools, model });
    const chunks: Array<{ type: string }> = [];
    for await (const chunk of toUIMessageStream({ stream: result.stream, tools: noopTools, sendReasoning: false })) {
      chunks.push(chunk);
    }

    expect(chunks.some((c) => c.type.startsWith('reasoning'))).toBe(false);
    expect(chunks.some((c) => c.type === 'text-delta')).toBe(true);
  });
});

describe('streamChat — Mistral wire request', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockMistralStream(capture: { url?: string; body?: Record<string, unknown> }) {
    const chunk = (delta: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
      `data: ${JSON.stringify({ id: 'c1', object: 'chat.completion.chunk', created: 0, model: 'mistral-small-2603', choices: [{ index: 0, delta, finish_reason: extra['finish_reason'] ?? null }], ...extra })}\n\n`;
    const sse =
      chunk({ role: 'assistant', content: 'ok' }) +
      chunk({ content: '' }, {
        finish_reason: 'stop',
        usage: { prompt_tokens: 200, completion_tokens: 1, total_tokens: 201, prompt_tokens_details: { cached_tokens: 128 } },
      }) +
      'data: [DONE]\n\n';
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      capture.url = String(url);
      capture.body = JSON.parse(init?.body as string) as Record<string, unknown>;
      return new Response(sse, { headers: { 'content-type': 'text/event-stream' } });
    }) as unknown as typeof fetch;
  }

  it('sends the dated model, the session cache key and high reasoning on a STEM solve turn', async () => {
    const capture: { url?: string; body?: Record<string, unknown> } = {};
    mockMistralStream(capture);

    const result = streamChat({
      ...baseParams,
      subject: 'mathematiques',
      classifiedIntent: { intent: 'solve-this-for-me', confidence: 'high' },
      tools: noopTools,
    });
    await result.text;

    expect(capture.url).toBe('https://api.eu.mistral.ai/v1/chat/completions');
    expect(capture.body?.['model']).toBe('mistral-small-2603');
    expect(capture.body?.['prompt_cache_key']).toBe('session-001');
    expect(capture.body?.['reasoning_effort']).toBe('high');
  });

  it("sends reasoning_effort 'none' outside the STEM hard-intent route", async () => {
    const capture: { url?: string; body?: Record<string, unknown> } = {};
    mockMistralStream(capture);

    await streamChat({ ...baseParams, subject: 'francais', tools: noopTools }).text;

    expect(capture.body?.['reasoning_effort']).toBe('none');
  });

  it('surfaces cached prompt tokens from the streamed usage', async () => {
    mockMistralStream({});

    const usage = await streamChat({ ...baseParams, tools: noopTools }).usage;

    expect(usage.inputTokens).toBe(200);
    expect(usage.inputTokenDetails.cacheReadTokens).toBe(128);
  });
});
