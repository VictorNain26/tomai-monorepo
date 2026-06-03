/**
 * OpenTelemetry init — server boot path.
 *
 * Called by `index.ts` BEFORE any application import so the tracer is
 * available the first time a service file is evaluated.
 *
 * Configuration via env (no code-side config knob):
 *   OTEL_EXPORTER_OTLP_ENDPOINT   — OTLP HTTP endpoint (default: console only)
 *   OTEL_EXPORTER_OTLP_HEADERS    — comma-separated `key=value` headers
 *   OTEL_SERVICE_NAME             — defaults to "tomai-server"
 *   OTEL_DEPLOYMENT_ENVIRONMENT   — propagated to resource (dev/staging/prod)
 *   OTEL_DISABLED                 — set to "1" to skip init (tests / CI)
 *
 * GenAI conventions are still in Development (SemConv 1.41). We import the
 * incubating attribute keys explicitly in `spans.ts` to keep the typed
 * surface stable as the spec moves. See the audit P1-9 entry for context.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
} from '@opentelemetry/semantic-conventions/incubating';

let sdk: NodeSDK | null = null;
let started = false;

function buildHeaders(raw: string | undefined): Record<string, string> | undefined {
  if (!raw) return undefined;
  const headers: Record<string, string> = {};
  for (const pair of raw.split(',')) {
    const [k, v] = pair.split('=');
    if (k && v) headers[k.trim()] = v.trim();
  }
  return Object.keys(headers).length ? headers : undefined;
}

function buildProcessors(): SpanProcessor[] {
  const processors: SpanProcessor[] = [];
  // Pre-boot context: env singleton not yet initialized. Reads Bun.env directly.
  const endpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
  const headers = buildHeaders(process.env['OTEL_EXPORTER_OTLP_HEADERS']);

  if (endpoint) {
    // Production / staging — push to OTLP HTTP endpoint (Langfuse self-hosted,
    // Tempo, Honeycomb, Grafana Cloud, etc.).
    processors.push(
      new BatchSpanProcessor(
        new OTLPTraceExporter({
          url: `${endpoint.replace(/\/$/, '')}/v1/traces`,
          headers,
        }),
      ),
    );
  }

  // Always emit to console in dev so we get traces without infra setup. The
  // simple processor is fine here — volume is low and visibility immediate.
  if (process.env['NODE_ENV'] !== 'production' && !endpoint) {
    processors.push(new SimpleSpanProcessor(new ConsoleSpanExporter()));
  }

  return processors;
}

/**
 * Initialise the global tracer provider. Idempotent — safe to call from
 * multiple entry points (boot path, worker, test setup).
 */
export function setupOtel(): void {
  if (started) return;
  if (process.env['OTEL_DISABLED'] === '1') {
    started = true;
    return;
  }

  const processors = buildProcessors();
  if (processors.length === 0) {
    started = true;
    return;
  }

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env['OTEL_SERVICE_NAME'] ?? 'tomai-server',
      [ATTR_SERVICE_VERSION]: process.env['APP_VERSION'] ?? 'dev',
      [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]:
        process.env['OTEL_DEPLOYMENT_ENVIRONMENT'] ?? process.env['NODE_ENV'] ?? 'development',
    }),
    spanProcessors: processors,
  });

  sdk.start();
  started = true;

  // Flush traces on shutdown so the OTLP exporter actually sends the last
  // batch. SIGTERM is what Koyeb / Docker send before killing the container.
  const shutdown = async () => {
    try {
      await sdk?.shutdown();
    } catch {
      // best-effort; nothing to do if shutdown fails on already-dead process
    }
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}

/** Test hook: tear down the SDK between integration tests. */
export async function shutdownOtel(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
  }
  started = false;
}
