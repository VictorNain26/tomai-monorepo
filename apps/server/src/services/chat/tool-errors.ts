/**
 * Structured tool error — CCA Sprint 1 safety.
 *
 * Replaces ad-hoc `{error: true, message: '…'}` pattern with a discriminated
 * union that lets the model decide between retry / reformulate / escalate
 * based on the error category and retryability.
 *
 * Categories:
 * - `transient`   : timeout, 5xx, rate-limit. Safe to retry.
 * - `validation`  : bad arguments, schema mismatch. Retry only after fixing input.
 * - `business`    : valid call, unexpected domain state (missing profile, etc.).
 * - `permission`  : 401/403, RLS denial. Never retry, escalate.
 */

type ToolErrorCategory = 'transient' | 'validation' | 'business' | 'permission';

export interface StructuredToolError {
  isError: true;
  errorCategory: ToolErrorCategory;
  isRetryable: boolean;
  message: string;
  partialResults?: unknown;
}

/**
 * Successful tool result — discriminated union for full type safety.
 * `ok: true` signals success; callers can't mix error and success fields.
 */
/** @public — reachable only via Eden Treaty's inferred route return types (apps/server build:types), not a direct import; knip false positive. */
export interface ToolSuccess<T = unknown> {
  ok: true;
  data: T;
}

export type ToolResult<T = unknown> = ToolSuccess<T> | StructuredToolError;

export function makeToolError(
  category: ToolErrorCategory,
  message: string,
  partialResults?: unknown,
): StructuredToolError {
  const error: StructuredToolError = {
    isError: true,
    errorCategory: category,
    isRetryable: category === 'transient',
    message,
  };
  if (partialResults !== undefined) {
    error.partialResults = partialResults;
  }
  return error;
}

