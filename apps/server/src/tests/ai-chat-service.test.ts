/**
 * Tests unitaires — AiChatService (services/chat/ai-chat.service.ts)
 *
 * Verifies the streamText wiring against a `MockLanguageModelV4` (the
 * interface version @ai-sdk/mistral@4.0.5 implements — confirmed in
 * node_modules/@ai-sdk/mistral/dist/index.d.ts): the system prompt lands as
 * the first prompt message, `stopWhen: isStepCount(5)` caps the agentic loop,
 * and text chunks stream out in order. No network call, no real tool
 * execution — a trivial fake tool stands in for `buildChatTools`'s output.
 */

import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import { tool, type ToolSet } from 'ai';
import { MockLanguageModelV4, simulateReadableStream } from 'ai/test';
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
});
