import { describe, it, expect, afterAll } from 'bun:test';
import { trace } from '@opentelemetry/api';

const received: { path: string; authorization: string | null }[] = [];
const collector = Bun.serve({
  port: 0,
  fetch(req) {
    received.push({ path: new URL(req.url).pathname, authorization: req.headers.get('authorization') });
    return new Response('{}', { headers: { 'content-type': 'application/json' } });
  },
});

delete process.env['OTEL_DISABLED'];
delete process.env['OTEL_EXPORTER_OTLP_TRACES_ENDPOINT'];
delete process.env['OTEL_EXPORTER_OTLP_TRACES_HEADERS'];
process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] = `http://localhost:${collector.port}/api/public/otel`;
process.env['OTEL_EXPORTER_OTLP_HEADERS'] = 'Authorization=Basic%20cGs6c2s=';

const { setupOtel, shutdownOtel } = await import('../lib/otel/otel');

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

  it('sends OTEL_EXPORTER_OTLP_HEADERS intact: URL-decoded, "=" padding kept', async () => {
    trace.getTracer('otel-test').startSpan('probe').end();
    await shutdownOtel();

    const traceRequest = received.find((r) => r.path === '/api/public/otel/v1/traces');
    expect(traceRequest?.authorization).toBe('Basic cGs6c2s=');
  });
});
