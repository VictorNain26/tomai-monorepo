/**
 * AppError — Unified error handling for TomAI
 *
 * Provides:
 * - Typed error codes for client-side handling
 * - HTTP status code mapping
 * - User-facing vs internal error messages
 * - Correlation with request context
 */

type ErrorCode =
  // Auth (401, 403)
  | 'UNAUTHORIZED'
  | 'SESSION_EXPIRED'
  | 'FORBIDDEN'
  // Validation (400)
  | 'VALIDATION_ERROR'
  | 'EMPTY_MESSAGE'
  // Rate limiting (429)
  | 'RATE_LIMITED'
  | 'QUOTA_EXCEEDED'
  // Business logic (400, 409)
  | 'SESSION_NOT_FOUND'
  | 'CONCURRENT_STREAM'
  | 'DECK_NOT_FOUND'
  | 'FILE_NOT_FOUND'
  | 'PRONOTE_NOT_CONNECTED'
  // AI / External (502, 503)
  | 'AI_RATE_LIMIT'
  | 'AI_UNAVAILABLE'
  | 'AI_CONFIGURATION'
  | 'EXTERNAL_SERVICE_ERROR'
  // Server (500)
  | 'INTERNAL_ERROR';

const STATUS_MAP: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  SESSION_EXPIRED: 401,
  FORBIDDEN: 403,
  VALIDATION_ERROR: 400,
  EMPTY_MESSAGE: 400,
  RATE_LIMITED: 429,
  QUOTA_EXCEEDED: 429,
  SESSION_NOT_FOUND: 404,
  CONCURRENT_STREAM: 409,
  DECK_NOT_FOUND: 404,
  FILE_NOT_FOUND: 404,
  PRONOTE_NOT_CONNECTED: 400,
  AI_RATE_LIMIT: 429,
  AI_UNAVAILABLE: 503,
  AI_CONFIGURATION: 503,
  EXTERNAL_SERVICE_ERROR: 502,
  INTERNAL_ERROR: 500,
};

const USER_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHORIZED: 'Tu dois être connecté pour continuer.',
  SESSION_EXPIRED: 'Ta session a expiré. Reconnecte-toi.',
  FORBIDDEN: 'Tu n\'as pas accès à cette ressource.',
  VALIDATION_ERROR: 'Les données envoyées sont invalides.',
  EMPTY_MESSAGE: 'Le message ne peut pas être vide.',
  RATE_LIMITED: 'Trop de requêtes. Réessaie dans quelques secondes.',
  QUOTA_EXCEEDED: 'Tu as atteint ta limite de messages. Passe à Tom Pro !',
  SESSION_NOT_FOUND: 'Conversation introuvable.',
  CONCURRENT_STREAM: 'Une réponse est déjà en cours. Attends qu\'elle se termine.',
  DECK_NOT_FOUND: 'Deck introuvable.',
  FILE_NOT_FOUND: 'Fichier introuvable.',
  PRONOTE_NOT_CONNECTED: 'Pronote n\'est pas connecté.',
  AI_RATE_LIMIT: 'Le service est temporairement surchargé. Réessaie dans quelques secondes.',
  AI_UNAVAILABLE: 'Le service IA est temporairement indisponible. Réessaie.',
  AI_CONFIGURATION: 'Erreur de configuration du service IA. Contacte le support.',
  EXTERNAL_SERVICE_ERROR: 'Un service externe ne répond pas. Réessaie.',
  INTERNAL_ERROR: 'Erreur interne. Réessaie ou contacte le support.',
};

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly userMessage: string;

  constructor(code: ErrorCode, internalMessage?: string) {
    super(internalMessage ?? USER_MESSAGES[code]);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = STATUS_MAP[code];
    this.userMessage = USER_MESSAGES[code];
  }
}

/** Standard error response envelope */
export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
  };
  requestId?: string;
}

/** Build a standard error response */
export function toErrorResponse(error: AppError, requestId?: string): ErrorResponse {
  return {
    error: {
      code: error.code,
      message: error.userMessage,
    },
    ...(requestId && { requestId }),
  };
}
