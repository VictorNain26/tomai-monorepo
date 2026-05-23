/**
 * GenAI + Vector DB span helpers — OpenTelemetry semconv (Development for
 * `gen_ai.*`, stable for `db.*`).
 *
 * Two thin wrappers:
 *
 *   withGenAiSpan({ operation, model, request }, fn)
 *     — wraps a Mistral / Anthropic / OpenAI-shaped call. The fn returns a
 *       response that may carry usage + finish_reasons + id; we mirror those
 *       on the span as `gen_ai.response.*` and `gen_ai.usage.*`.
 *
 *   withDbSpan({ system, operation, collection }, fn)
 *     — wraps a vector DB call (Qdrant / pgvector). Stable `db.*` attribute
 *       namespace; uses `db.query.summary` as the span name format.
 *
 * Both swallow the tracer error path (`recordException` + ERROR status) but
 * always re-throw — observability never changes program behaviour.
 *
 * `gen_ai.input.messages` / `gen_ai.output.messages` are deliberately NOT
 * captured by default. They are Opt-In in the spec (PII / cost). Caller can
 * pass `captureInput`/`captureOutput` strings if they have already redacted.
 */

import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';

const tracer = trace.getTracer('tomai-server', '0.1.0');

// Attribute keys — stable in `incubating` for GenAI as of SemConv 1.41.
// Hard-coding the string literals keeps us insulated from minor renames; the
// `incubating` package re-exports change between minors.
const ATTR_GEN_AI_OPERATION_NAME = 'gen_ai.operation.name';
const ATTR_GEN_AI_PROVIDER_NAME = 'gen_ai.provider.name';
const ATTR_GEN_AI_REQUEST_MODEL = 'gen_ai.request.model';
const ATTR_GEN_AI_REQUEST_MAX_TOKENS = 'gen_ai.request.max_tokens';
const ATTR_GEN_AI_REQUEST_TEMPERATURE = 'gen_ai.request.temperature';
const ATTR_GEN_AI_REQUEST_TOP_P = 'gen_ai.request.top_p';
const ATTR_GEN_AI_RESPONSE_ID = 'gen_ai.response.id';
const ATTR_GEN_AI_RESPONSE_MODEL = 'gen_ai.response.model';
const ATTR_GEN_AI_RESPONSE_FINISH_REASONS = 'gen_ai.response.finish_reasons';
const ATTR_GEN_AI_USAGE_INPUT_TOKENS = 'gen_ai.usage.input_tokens';
const ATTR_GEN_AI_USAGE_OUTPUT_TOKENS = 'gen_ai.usage.output_tokens';
const ATTR_GEN_AI_INPUT_MESSAGES = 'gen_ai.input.messages';
const ATTR_GEN_AI_OUTPUT_MESSAGES = 'gen_ai.output.messages';
const ATTR_SERVER_ADDRESS = 'server.address';

const ATTR_DB_SYSTEM_NAME = 'db.system.name';
const ATTR_DB_OPERATION_NAME = 'db.operation.name';
const ATTR_DB_COLLECTION_NAME = 'db.collection.name';
const ATTR_DB_QUERY_SUMMARY = 'db.query.summary';
const ATTR_DB_RESPONSE_RETURNED_ROWS = 'db.response.returned_rows';

export type GenAiOperation = 'chat' | 'embeddings' | 'text_completion' | 'execute_tool';

export interface GenAiSpanInput {
  operation: GenAiOperation;
  /** "mistral_ai" per SemConv (snake_case). */
  provider: 'mistral_ai';
  model: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  serverAddress?: string;
  /** Opt-in: caller-redacted prompt string. */
  captureInput?: string;
}

export interface GenAiResponseFacts {
  id?: string;
  model?: string;
  finishReasons?: string[];
  inputTokens?: number;
  outputTokens?: number;
  /** Opt-in: caller-redacted completion. */
  captureOutput?: string;
}

/**
 * Wrap a GenAI client call. The fn receives a `recordResponse` callback so
 * the caller can splice the response metadata onto the span after the API
 * roundtrip but before whatever post-processing happens.
 */
export async function withGenAiSpan<T>(
  input: GenAiSpanInput,
  fn: (record: (facts: GenAiResponseFacts) => void) => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(
    `${input.operation} ${input.model}`,
    {
      kind: SpanKind.CLIENT,
      attributes: {
        [ATTR_GEN_AI_OPERATION_NAME]: input.operation,
        [ATTR_GEN_AI_PROVIDER_NAME]: input.provider,
        [ATTR_GEN_AI_REQUEST_MODEL]: input.model,
        ...(input.maxTokens !== undefined && { [ATTR_GEN_AI_REQUEST_MAX_TOKENS]: input.maxTokens }),
        ...(input.temperature !== undefined && { [ATTR_GEN_AI_REQUEST_TEMPERATURE]: input.temperature }),
        ...(input.topP !== undefined && { [ATTR_GEN_AI_REQUEST_TOP_P]: input.topP }),
        ...(input.serverAddress && { [ATTR_SERVER_ADDRESS]: input.serverAddress }),
        ...(input.captureInput && { [ATTR_GEN_AI_INPUT_MESSAGES]: input.captureInput }),
      },
    },
    async (span) => {
      try {
        const recordResponse = (facts: GenAiResponseFacts) => {
          if (facts.id) span.setAttribute(ATTR_GEN_AI_RESPONSE_ID, facts.id);
          if (facts.model) span.setAttribute(ATTR_GEN_AI_RESPONSE_MODEL, facts.model);
          if (facts.finishReasons?.length)
            span.setAttribute(ATTR_GEN_AI_RESPONSE_FINISH_REASONS, facts.finishReasons);
          if (facts.inputTokens !== undefined)
            span.setAttribute(ATTR_GEN_AI_USAGE_INPUT_TOKENS, facts.inputTokens);
          if (facts.outputTokens !== undefined)
            span.setAttribute(ATTR_GEN_AI_USAGE_OUTPUT_TOKENS, facts.outputTokens);
          if (facts.captureOutput)
            span.setAttribute(ATTR_GEN_AI_OUTPUT_MESSAGES, facts.captureOutput);
        };
        return await fn(recordResponse);
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err instanceof Error ? err.message : String(err),
        });
        throw err;
      } finally {
        span.end();
      }
    },
  );
}

export interface DbSpanInput {
  /** Stable db.system.name — "qdrant", "postgresql", etc. */
  system: string;
  /** "search", "upsert", "delete", "scroll"... */
  operation: string;
  collection: string;
  serverAddress?: string;
}

/**
 * Wrap a vector / SQL DB call. The fn receives a `recordResponse` callback
 * to post the returned row count once the query completes.
 */
export async function withDbSpan<T>(
  input: DbSpanInput,
  fn: (record: (rows: number) => void) => Promise<T>,
): Promise<T> {
  const summary = `${input.operation} ${input.collection}`;
  return tracer.startActiveSpan(
    summary,
    {
      kind: SpanKind.CLIENT,
      attributes: {
        [ATTR_DB_SYSTEM_NAME]: input.system,
        [ATTR_DB_OPERATION_NAME]: input.operation,
        [ATTR_DB_COLLECTION_NAME]: input.collection,
        [ATTR_DB_QUERY_SUMMARY]: summary,
        ...(input.serverAddress && { [ATTR_SERVER_ADDRESS]: input.serverAddress }),
      },
    },
    async (span) => {
      try {
        const recordResponse = (rows: number) => {
          span.setAttribute(ATTR_DB_RESPONSE_RETURNED_ROWS, rows);
        };
        return await fn(recordResponse);
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err instanceof Error ? err.message : String(err),
        });
        throw err;
      } finally {
        span.end();
      }
    },
  );
}
