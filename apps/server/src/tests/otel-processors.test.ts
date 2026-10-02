import { describe, it, expect } from 'bun:test';
import { simulateReadableStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';

delete process.env.OTEL_DISABLED;
delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

const { setupOtel, shutdownOtel } = await import('../platform/observability/otel');
const { streamChat } = await import('../modules/tutor/ai-chat.service');

describe('setupOtel with caller processors', () => {
  it('sends the AI SDK spans to the processors it is given', async () => {
    const exporter = new InMemorySpanExporter();
    setupOtel([new SimpleSpanProcessor(exporter)]);
    const model = new MockLanguageModelV4({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunkDelayInMs: 0,
          initialDelayInMs: 0,
          chunks: [
            { type: 'stream-start', warnings: [] },
            {
              type: 'finish',
              usage: {
                inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
                outputTokens: { total: 1, text: 1, reasoning: undefined },
              },
              finishReason: { unified: 'stop', raw: undefined },
            },
          ],
        }),
      }),
    });

    await streamChat({
      userId: 'u',
      sessionId: 's',
      content: 'bonjour',
      schoolLevel: 'sixieme',
      userRole: 'student',
      conversationHistory: [],
      tools: {},
      model,
    }).text;

    expect(exporter.getFinishedSpans().length).toBeGreaterThan(0);
    await shutdownOtel();
  });
});
