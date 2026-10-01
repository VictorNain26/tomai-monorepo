/**
 * OpenTelemetry init — server boot path.
 *
 * Called by `index.ts` BEFORE any application import so the tracer is
 * available the first time a service file is evaluated.
 *
 * Configuration via env (no code-side config knob):
 *   OTEL_EXPORTER_OTLP_ENDPOINT   — OTLP HTTP base URL, read by the exporter itself (+ /v1/traces)
 *   OTEL_EXPORTER_OTLP_HEADERS    — W3C baggage-style `key=value` pairs, URL-encoded, read by the exporter
 *   OTEL_SERVICE_NAME             — defaults to "tomai-server"
 *   OTEL_DEPLOYMENT_ENVIRONMENT   — propagated to resource (dev/staging/prod)
 *   OTEL_DISABLED                 — set to "1" to skip init (tests / CI)
 *
 * AI SDK calls are traced by `@ai-sdk/otel` (GenAI SemConv spans), registered
 * here once the tracer provider is up. Prompts and completions are never
 * recorded: every call site sets `recordInputs: false, recordOutputs: false`.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { registerTelemetry } from 'ai';
import { OpenTelemetry } from '@ai-sdk/otel';
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

function buildProcessors(): SpanProcessor[] {
  const processors: SpanProcessor[] = [];
  // Pre-boot context: env singleton not yet initialized. Reads Bun.env directly.
  const endpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];

  if (endpoint) {
    // Production / staging — push to OTLP HTTP endpoint (Langfuse self-hosted,
    // Tempo, Honeycomb, Grafana Cloud, etc.).
    processors.push(new BatchSpanProcessor(new OTLPTraceExporter()));
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
  registerTelemetry(new OpenTelemetry());
  started = true;
}

export async function shutdownOtel(): Promise<void> {
  await sdk?.shutdown();
}

