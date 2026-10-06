/**
 * Tests unitaires — AiChatService (modules/tutor/ai-chat.service.ts)
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
import { APICallError, tool, type ToolSet, simulateReadableStream, toUIMessageStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { streamChat, type ChatStreamParams } from '../modules/tutor/ai-chat.service.js';
import { TurnUsage } from '../modules/tutor/turn-usage.js';
import { analysis } from './_helpers/turn-analysis';
import { env } from '../platform/config/env.js';

const baseParams: Omit<ChatStreamParams, 'model' | 'tools'> = {
  userId: 'user-001',
  sessionId: 'session-001',
  content: 'Bonjour Tom',
  schoolLevel: 'troisieme',
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
    const systemMessage = firstCall?.prompt[0];
    expect(systemMessage?.role).toBe('system');
    expect(typeof systemMessage?.content).toBe('string');
  });

  it('gives the writer the statement of the exercise in progress, out of the system prompt, and not its answer', async () => {
    const model = new MockLanguageModelV4({
      doStream: async () => ({
        stream: simulateReadableStream({ chunkDelayInMs: 0, initialDelayInMs: 0, chunks: [{ type: 'stream-start', warnings: [] }, finishStreamPart()] }),
      }),
    });
    const exerciseSheet = {
      statement: 'Résous 3x + 5 = 20.', kind: 'short' as const, answer: 'x = 5', answerForms: ['x = 5'], mathEquation: null, mathAnswer: null,
      steps: ['Retrancher 5'], commonErrors: [], rule: null, facts: [], expectedElements: [], entries: [], laterEntries: [],
    };

    await streamChat({ ...baseParams, tools: noopTools, model, exerciseSheet }).text;

    const [system, opening] = model.doStreamCalls[0]?.prompt ?? [];
    expect(JSON.stringify(system)).not.toContain('Résous 3x + 5 = 20.');
    const sent = JSON.stringify(opening);
    expect(opening?.role).toBe('user');
    expect(sent).toContain('<exercise_statement>\\nRésous 3x + 5 = 20.\\n</exercise_statement>');
    expect(sent).not.toContain('x = 5');
    expect(sent).not.toContain('Retrancher 5');
  });

  it("sends the session's files as fenced texts opening the window, never in the turn message", async () => {
    const model = new MockLanguageModelV4({
      doStream: async () => ({
        stream: simulateReadableStream({ chunkDelayInMs: 0, initialDelayInMs: 0, chunks: [{ type: 'stream-start', warnings: [] }, finishStreamPart()] }),
      }),
    });

    await streamChat({ ...baseParams, tools: noopTools, model, attachedFiles: [{ fileId: 'f1', fileName: 'exo.png', text: 'Résous 3x + 5 = 20.' }] }).text;

    const prompt = model.doStreamCalls[0]?.prompt ?? [];
    expect(prompt).toHaveLength(2);
    const sent = JSON.stringify(prompt[1]);
    expect(sent.indexOf('<attached_file name=\\"exo.png\\">')).toBeLessThan(sent.indexOf('<student_message>'));
    expect(sent).not.toContain('"type":"file"');
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
    const chunks: { type: string }[] = [];
    for await (const chunk of toUIMessageStream({ stream: result.stream, tools: noopTools, sendReasoning: false })) {
      chunks.push(chunk);
    }

    expect(chunks.some((c) => c.type.startsWith('reasoning'))).toBe(false);
    expect(chunks.some((c) => c.type === 'text-delta')).toBe(true);
  });

  it('retries a retryable provider error MISTRAL_RETRY_ATTEMPTS times, like the other Mistral calls', async () => {
    const configured = env.MISTRAL_RETRY_ATTEMPTS;
    (env as Record<string, unknown>)['MISTRAL_RETRY_ATTEMPTS'] = 0;
    try {
      const model = new MockLanguageModelV4({
        doStream: async () => {
          throw new APICallError({ message: 'overloaded', url: 'https://api.eu.mistral.ai', requestBodyValues: {}, statusCode: 503, isRetryable: true });
        },
      });

      await Promise.resolve(streamChat({ ...baseParams, tools: noopTools, model }).text).catch(() => undefined);

      expect(model.doStreamCalls).toHaveLength(1);
    } finally {
      (env as Record<string, unknown>)['MISTRAL_RETRY_ATTEMPTS'] = configured;
    }
  });
});

describe('flashcards confirmed by the code', () => {
  it('makes cards only when the turn analysis read a request or an agreement', async () => {
    for (const wantsFlashcards of [true, false]) {
      let made = 0;
      let callIndex = 0;
      const model = new MockLanguageModelV4({
        doStream: async () => {
          callIndex += 1;
          if (callIndex === 1) {
            return {
              stream: simulateReadableStream({
                chunkDelayInMs: 0,
                initialDelayInMs: 0,
                chunks: [
                  { type: 'stream-start', warnings: [] },
                  { type: 'tool-call', toolCallId: 'call-1', toolName: 'generate_flashcards', input: '{}' },
                  { type: 'finish', usage, finishReason: toolCallsFinishReason },
                ],
              }),
            };
          }
          return { stream: simulateReadableStream({ chunkDelayInMs: 0, initialDelayInMs: 0, chunks: [{ type: 'stream-start', warnings: [] }, finishStreamPart()] }) };
        },
      });
      const tools: ToolSet = {
        generate_flashcards: tool({ inputSchema: z.object({}), execute: async () => { made += 1; return 'deck'; } }),
      };

      await streamChat({ ...baseParams, tools, model, turnAnalysis: analysis({ wantsFlashcards }) }).text;

      expect(made).toBe(wantsFlashcards ? 1 : 0);
    }
  });

  it('imposes the cards tool on the first step of a turn that asks for cards, and only then', async () => {
    for (const wantsFlashcards of [true, false]) {
      const model = new MockLanguageModelV4({
        doStream: async () => ({ stream: simulateReadableStream({ chunkDelayInMs: 0, initialDelayInMs: 0, chunks: [{ type: 'stream-start', warnings: [] }, finishStreamPart()] }) }),
      });
      const tools: ToolSet = { ...noopTools, generate_flashcards: tool({ inputSchema: z.object({}), execute: async () => 'deck' }) };

      await streamChat({ ...baseParams, tools, model, turnAnalysis: analysis({ wantsFlashcards }) }).text;

      expect(model.doStreamCalls[0]?.toolChoice).toEqual(wantsFlashcards ? { type: 'tool', toolName: 'generate_flashcards' } : { type: 'auto' });
    }
  });

  it('tells the model why cards are denied, and removes the tool after a denial instead of spending the steps', async () => {
    for (const [turnAnalysis, reason] of [
      [analysis(), "L'élève n'a pas demandé de cartes"],
      [analysis({ error: 'timeout' }), 'Les cartes ne peuvent pas être créées à ce tour'],
    ] as const) {
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
                { type: 'tool-call', toolCallId: `call-${callIndex}`, toolName: 'generate_flashcards', input: '{}' },
                { type: 'finish', usage, finishReason: toolCallsFinishReason },
              ],
            }),
          };
        },
      });
      const tools: ToolSet = {
        ...noopTools,
        generate_flashcards: tool({ inputSchema: z.object({}), execute: async () => 'deck' }),
      };

      await streamChat({ ...baseParams, tools, model, turnAnalysis }).text;

      const [first, second] = model.doStreamCalls;
      expect(first?.tools?.map((t) => t.name)).toEqual(['noop_tool', 'generate_flashcards']);
      expect(second?.tools?.map((t) => t.name)).toEqual(['noop_tool']);
      expect(JSON.stringify(second?.prompt.at(-1))).toContain(reason);
    }
  });
});

describe('a turn cut by the timeout', () => {
  it('counts the call that ended exactly, and the one cut while streaming as estimated', async () => {
    const configured = env.CHAT_STREAM_TIMEOUT_MS;
    (env as Record<string, unknown>)['CHAT_STREAM_TIMEOUT_MS'] = 200;
    try {
      let callIndex = 0;
      const model = new MockLanguageModelV4({
        doStream: async ({ abortSignal }) => {
          callIndex += 1;
          if (callIndex === 1) {
            return {
              stream: simulateReadableStream({
                chunkDelayInMs: 0,
                initialDelayInMs: 0,
                chunks: [
                  { type: 'stream-start', warnings: [] },
                  { type: 'tool-call', toolCallId: 'call-1', toolName: 'noop_tool', input: '{}' },
                  { type: 'finish', usage, finishReason: toolCallsFinishReason },
                ],
              }),
            };
          }
          // The second call reasons and never ends, until the timeout aborts the request as a
          // real fetch would be.
          return {
            stream: new ReadableStream({
              start: (controller) => {
                controller.enqueue({ type: 'stream-start', warnings: [] });
                controller.enqueue({ type: 'reasoning-start', id: 'r1' });
                controller.enqueue({ type: 'reasoning-delta', id: 'r1', delta: 'r'.repeat(400) });
                abortSignal?.addEventListener('abort', () => { controller.error(abortSignal.reason); });
              },
            }),
          };
        },
      });
      const turnUsage = new TurnUsage();

      await Promise.resolve(streamChat({ ...baseParams, tools: noopTools, model, usage: turnUsage }).text).catch(() => undefined);

      const { usage: total, cut } = turnUsage.read();
      expect(cut).toBe(true);
      // The first call's input (1) stands for the cut one's, and its 400 streamed characters for its output.
      expect(total).toMatchObject({ inputTokens: 2, outputTokens: 101 });
    } finally {
      (env as Record<string, unknown>)['CHAT_STREAM_TIMEOUT_MS'] = configured;
    }
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
      capture.url = url instanceof Request ? url.url : url.toString();
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
      turnAnalysis: analysis({ subject: 'mathematiques', asksSolution: true }),
      tools: noopTools,
    });
    await result.text;

    expect(capture.url).toBe('https://api.eu.mistral.ai/v1/chat/completions');
    expect(capture.body?.['model']).toBe('mistral-small-2603');
    expect(capture.body?.['prompt_cache_key']).toBe('session-001');
    expect(capture.body?.['reasoning_effort']).toBe('high');
    // No output cap on a reasoning turn: the thinking would eat it.
    expect(capture.body).not.toHaveProperty('max_tokens');
  });

  it('replays a past reasoning as a thinking chunk, and sends one user message for the turn', async () => {
    const capture: { url?: string; body?: Record<string, unknown> } = {};
    mockMistralStream(capture);

    await streamChat({
      ...baseParams,
      subject: 'mathematiques',
      content: 'Je soustrais 5.',
      turnInstruction: '<critical_instruction>X</critical_instruction>',
      conversationHistory: [
        { role: 'user', content: 'Résous 3x + 5 = 20.', timestamp: '2026-10-04T10:00:00Z' },
        {
          role: 'assistant',
          content: 'Que fais-tu du +5 ?',
          timestamp: '2026-10-04T10:00:05Z',
          modelMessages: [{ role: 'assistant', content: [{ type: 'reasoning', text: 'Il a oublié de soustraire 5.' }, { type: 'text', text: 'Que fais-tu du +5 ?' }] }],
        },
      ],
      tools: noopTools,
    }).text;

    const messages = capture.body?.['messages'] as { role: string; content: unknown }[];
    expect(messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(messages[2]?.content).toEqual([
      { type: 'thinking', thinking: [{ type: 'text', text: 'Il a oublié de soustraire 5.' }], closed: true },
      { type: 'text', text: 'Que fais-tu du +5 ?' },
    ]);
    expect(JSON.stringify(messages[3]?.content)).toContain('<subject_specifics matiere=\\"Mathématiques\\">');
    expect(JSON.stringify(messages[0]?.content)).not.toContain('<subject_specifics matiere=');
  });

  it("sends reasoning_effort 'none' outside the STEM hard-intent route", async () => {
    const capture: { url?: string; body?: Record<string, unknown> } = {};
    mockMistralStream(capture);

    await streamChat({ ...baseParams, subject: 'francais', tools: noopTools }).text;

    expect(capture.body?.['reasoning_effort']).toBe('none');
    expect(capture.body?.['max_tokens']).toBe(env.MISTRAL_MAX_TOKENS);
  });

  it('surfaces cached prompt tokens from the streamed usage', async () => {
    mockMistralStream({});

    const usage = await streamChat({ ...baseParams, tools: noopTools }).usage;

    expect(usage.inputTokens).toBe(200);
    expect(usage.inputTokenDetails.cacheReadTokens).toBe(128);
  });
});
