/**
 * Structured tool error — CCA D2 §2 / Anthropic tool error pattern.
 *
 * Lets the model decide between retry / reformulate / escalate based on the
 * `errorCategory` and `isRetryable` flags. Replaces the legacy ad-hoc
 * `{error: true, message: '…'}` shape which was the #1 anti-pattern flagged
 * in the audit.
 *
 * - transient   : timeout, 5xx, rate-limit. Safe to retry.
 * - validation  : bad arguments, schema mismatch. Retry only after fixing input.
 * - business    : valid call, unexpected domain state (e.g. missing profile).
 * - permission  : 401/403, RLS denial. Never retry, escalate.
 *
 * Lives in its own module so tool-executor.ts stays under the 400-line cap
 * (constitution).
 */

export type ToolErrorCategory = 'transient' | 'validation' | 'business' | 'permission';

export interface StructuredToolError {
  isError: true;
  errorCategory: ToolErrorCategory;
  isRetryable: boolean;
  message: string;
  partialResults?: unknown;
}

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

export function isStructuredToolError(value: unknown): value is StructuredToolError {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { isError?: unknown }).isError === true &&
    typeof (value as { errorCategory?: unknown }).errorCategory === 'string'
  );
}
