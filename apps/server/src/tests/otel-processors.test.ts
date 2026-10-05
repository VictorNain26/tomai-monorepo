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
    const processor = new SimpleSpanProcessor(exporter);
    setupOtel([processor]);
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

    // The whole stream, not its text: the root span ends as the stream closes.
    await streamChat({
      userId: 'u',
      sessionId: 's',
      content: 'bonjour',
      schoolLevel: 'sixieme',
      conversationHistory: [],
      tools: {},
      model,
    }).consumeStream();
    // NodeSDK detects the resource attributes asynchronously, and the processor exports a span
    // only once they are in: under load, after the stream ends.
    await processor.forceFlush();

    expect(exporter.getFinishedSpans().length).toBeGreaterThan(0);
    await shutdownOtel();
  });
});
