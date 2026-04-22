/**
 * Utilitaire de retry avec backoff exponentiel
 *
 * Utilisé pour les appels IA qui peuvent échouer temporairement
 * (rate limiting, timeouts, indisponibilité temporaire)
 */

import { logger } from './observability.js';

// ============================================================================
// TYPES
// ============================================================================

export interface RetryOptions {
  /** Nombre maximum de tentatives (défaut: 3) */
  maxAttempts?: number;
  /** Délai initial en ms (défaut: 1000) */
  initialDelayMs?: number;
  /** Multiplicateur du délai entre tentatives (défaut: 2) */
  backoffMultiplier?: number;
  /** Délai maximum en ms (défaut: 10000) */
  maxDelayMs?: number;
  /** Erreurs qui ne doivent pas déclencher de retry */
  nonRetryableErrors?: string[];
  /** Nom de l'opération pour les logs */
  operationName?: string;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'operationName'>> & { operationName?: string } = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 10000,
  nonRetryableErrors: ['INVALID_', 'VALIDATION_'],
  operationName: undefined
};

// ============================================================================
// UTILITAIRE
// ============================================================================

/**
 * Exécute une fonction avec retry et backoff exponentiel
 *
 * @example
 * const result = await withRetry(
 *   () => generateDeckPlanInternal(params),
 *   { operationName: 'deck-planning', maxAttempts: 3 }
 * );
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;
  let delay = config.initialDelayMs;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Vérifier si l'erreur est non-retryable
      const isNonRetryable = config.nonRetryableErrors.some(
        prefix => lastError?.message.includes(prefix)
      );

      if (isNonRetryable || attempt === config.maxAttempts) {
        if (config.operationName) {
          logger.error(`${config.operationName} failed after ${attempt} attempts`, {
            operation: `retry:${config.operationName}:failed`,
            attempts: attempt,
            _error: lastError.message,
            severity: 'high' as const
          });
        }
        throw lastError;
      }

      // Log le retry
      if (config.operationName) {
        logger.warn(`${config.operationName} attempt ${attempt} failed, retrying in ${delay}ms`, {
          operation: `retry:${config.operationName}:attempt`,
          attempt,
          nextDelayMs: delay,
          error: lastError.message
        });
      }

      // Attendre avec backoff
      await sleep(delay);
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelayMs);
    }
  }

  // Ne devrait jamais arriver, mais TypeScript le demande
  throw lastError ?? new Error('Retry failed');
}

/**
 * Délai asynchrone
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wrap a promise with a timeout. Rejects with a TimeoutError if the inner promise
 * doesn't settle within `timeoutMs`. Prevents AI SDK calls from hanging indefinitely
 * and holding DB connections open.
 *
 * @example
 * const result = await withTimeout(client.embeddings.create(...), 30_000, 'mistral:embed');
 */
export class TimeoutError extends Error {
  constructor(operation: string, timeoutMs: number) {
    super(`Operation "${operation}" timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName = 'operation'
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(operationName, timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
