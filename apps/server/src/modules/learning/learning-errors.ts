/**
 * Domain errors for the Learning service.
 *
 * These are raised by `LearningService` when an operation violates a business
 * invariant (deck missing, deck owned by someone else). Route handlers can
 * narrow via `instanceof` to decide on the HTTP status to return.
 */

/**
 * Thrown when the requested deck does not exist.
 * Callers should typically respond with HTTP 404.
 */
export class DeckNotFoundError extends Error {
  constructor(deckId: string) {
    super(`Deck not found: ${deckId}`);
    this.name = 'DeckNotFoundError';
  }
}

/**
 * Thrown when a user attempts to access a deck they do not own.
 * Callers should typically respond with HTTP 404 as well (to avoid leaking
 * the existence of the resource), not 403.
 */
export class DeckOwnershipError extends Error {
  constructor(userId: string, deckId: string) {
    super(`User ${userId} does not own deck ${deckId}`);
    this.name = 'DeckOwnershipError';
  }
}

/**
 * Thrown when the requested card does not exist OR is not owned by the caller.
 * Ownership lookups go through a single JOIN-on-userId query, which cannot
 * distinguish "missing" from "not yours" — both collapse to this error so the
 * API never leaks the existence of another user's card. Respond with HTTP 404.
 */
export class CardNotFoundError extends Error {
  constructor(cardId: string) {
    super(`Card not found: ${cardId}`);
    this.name = 'CardNotFoundError';
  }
}

/**
 * Thrown when a card's content does not satisfy the invariants of its type
 * (e.g. a flashcard missing `front`/`back`, a QCM with an out-of-range
 * `correctIndex`). Callers should respond with HTTP 400.
 */
export class CardValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CardValidationError';
  }
}
