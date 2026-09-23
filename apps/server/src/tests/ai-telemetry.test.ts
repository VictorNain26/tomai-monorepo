import './_helpers/mistral-env';
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { z } from 'zod';
import { registerTelemetry, simulateReadableStream, tool } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { OpenTelemetry } from '@ai-sdk/otel';
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor, type ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { generateText, generateStructured } from '../lib/ai/mistral-client';
import { streamChat } from '../services/chat/ai-chat.service';

const exporter = new InMemorySpanExporter();
const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
registerTelemetry(new OpenTelemetry({ tracer: provider.getTracer('test') }));

const STUDENT_DATA_ATTRIBUTES = [
  'gen_ai.input.messages',
  'gen_ai.output.messages',
  'gen_ai.system_instructions',
  'gen_ai.tool.call.arguments',
  'gen_ai.tool.call.result',
];

const originalFetch = globalThis.fetch;
beforeEach(() => exporter.reset());
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function genAiSpans(): ReadableSpan[] {
  return exporter.getFinishedSpans().filter((s) => s.attributes['gen_ai.operation.name'] !== undefined);
}

function expectNoStudentData(spans: ReadableSpan[]) {
  for (const span of spans) {
    for (const key of STUDENT_DATA_ATTRIBUTES) expect(span.attributes[key]).toBeUndefined();
  }
}

function mockCompletions(contents: string[]) {
  let index = 0;
  globalThis.fetch = (async () => {
    const content = contents[index++] ?? '';
    return new Response(
      JSON.stringify({
        id: `c${index}`,
        object: 'chat.completion',
        created: 0,
        model: 'mistral-small-2603',
        choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10 * index, completion_tokens: index, total_tokens: 11 * index },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as unknown as typeof fetch;
}

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};

describe('AI SDK telemetry', () => {
  it('emits GenAI spans for generateText without recording prompts or outputs', async () => {
    mockCompletions(['ok']);

    await generateText({
      functionId: 'test-generate-text',
      messages: [
        { role: 'system', content: 'Élève : Léa, 14 ans' },
        { role: 'user', content: 'mon prénom est Léa' },
      ],
    });

    const spans = genAiSpans();
    expect(spans.length).toBeGreaterThan(0);
    expect(spans.some((s) => s.attributes['gen_ai.usage.input_tokens'] === 10)).toBe(true);
    expectNoStudentData(spans);
  });

  it('emits one span with its own usage per generateStructured attempt', async () => {
    mockCompletions(['{"answer":42}', '{"answer":"quarante-deux"}']);

    const result = await generateStructured({
      functionId: 'test-generate-structured',
      schemaName: 'answer',
      schema: z.object({ answer: z.string() }),
      messages: [{ role: 'user', content: 'mon prénom est Léa' }],
    });

    expect(result.usage).toEqual({ inputTokens: 30, outputTokens: 3 });
    const spans = genAiSpans();
    const inputTokens = spans.map((s) => s.attributes['gen_ai.usage.input_tokens']);
    expect(inputTokens).toContain(10);
    expect(inputTokens).toContain(20);
    expectNoStudentData(spans);
  });

  it('emits GenAI spans for the chat stream without recording messages, system prompt or tool calls', async () => {
    let call = 0;
    const model = new MockLanguageModelV4({
      doStream: async () => {
        call += 1;
        if (call === 1) {
          return {
            stream: simulateReadableStream({
              chunkDelayInMs: 0,
              initialDelayInMs: 0,
              chunks: [
                { type: 'stream-start', warnings: [] },
                { type: 'tool-call', toolCallId: 'call-1', toolName: 'lookup', input: '{"name":"Léa"}' },
                { type: 'finish', usage, finishReason: { unified: 'tool-calls', raw: undefined } },
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
              { type: 'text-start', id: 't1' },
              { type: 'text-delta', id: 't1', delta: 'Bonjour Léa' },
              { type: 'text-end', id: 't1' },
              { type: 'finish', usage, finishReason: { unified: 'stop', raw: undefined } },
            ],
          }),
        };
      },
    });

    const result = streamChat({
      userId: 'u',
      sessionId: 's',
      content: 'mon prénom est Léa',
      firstName: 'Léa',
      schoolLevel: 'troisieme',
      userRole: 'student',
      conversationHistory: [],
      tools: {
        lookup: tool({
          description: 'Test-only lookup',
          inputSchema: z.object({ name: z.string() }),
          execute: async ({ name }) => `profil de ${name}`,
        }),
      },
      model,
    });
    await result.text;

    const spans = genAiSpans();
    expect(spans.some((s) => s.attributes['gen_ai.tool.name'] === 'lookup')).toBe(true);
    expect(spans.some((s) => s.attributes['gen_ai.usage.input_tokens'] !== undefined)).toBe(true);
    expectNoStudentData(spans);
  });
});
