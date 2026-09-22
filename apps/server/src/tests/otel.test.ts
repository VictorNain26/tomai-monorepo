import { describe, it, expect, afterAll } from 'bun:test';
import { simulateReadableStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';

const received: { path: string; authorization: string | null; body: string }[] = [];
const collector = Bun.serve({
  port: 0,
  async fetch(req) {
    received.push({
      path: new URL(req.url).pathname,
      authorization: req.headers.get('authorization'),
      body: new TextDecoder().decode(await req.arrayBuffer()),
    });
    return new Response('{}', { headers: { 'content-type': 'application/json' } });
  },
});

delete process.env['OTEL_DISABLED'];
delete process.env['OTEL_EXPORTER_OTLP_TRACES_ENDPOINT'];
delete process.env['OTEL_EXPORTER_OTLP_TRACES_HEADERS'];
process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] = `http://localhost:${collector.port}/api/public/otel`;
process.env['OTEL_EXPORTER_OTLP_HEADERS'] = 'Authorization=Basic%20cGs6c2s=';

const { setupOtel, shutdownOtel } = await import('../lib/otel/otel');
const { streamChat } = await import('../services/chat/ai-chat.service');

afterAll(() => {
  void collector.stop(true);
});

describe('otel', () => {
  it('registers no signal handler of its own (single shutdown path in index.ts)', () => {
    const term = process.listenerCount('SIGTERM');
    const int = process.listenerCount('SIGINT');

    setupOtel();

    expect(process.listenerCount('SIGTERM')).toBe(term);
    expect(process.listenerCount('SIGINT')).toBe(int);
  });

  it('exports AI SDK spans without the student message, with OTEL_EXPORTER_OTLP_HEADERS intact', async () => {
    setupOtel();
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
      content: 'je suis Léa Martin',
      schoolLevel: 'troisieme',
      userRole: 'student',
      conversationHistory: [],
      tools: {},
      model,
    }).text;
    await shutdownOtel();

    const traceRequests = received.filter((r) => r.path === '/api/public/otel/v1/traces');
    const exported = traceRequests.map((r) => r.body).join('');
    expect(exported).toContain('gen_ai.operation.name');
    expect(exported).not.toContain('Léa Martin');
    expect(traceRequests[0]?.authorization).toBe('Basic cGs6c2s=');
  });
});
