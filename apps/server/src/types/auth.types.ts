/**
 * Types d'authentification - Aliases pour compatibilité
 */

import type { ElysiaAuthenticatedUser } from './index.js';

// Alias pour compatibilité avec les imports existants
export type User = ElysiaAuthenticatedUser;

export type {
  ElysiaAuthenticatedUser,
  BetterAuthSession,
  ElysiaAuthContext
} from './index.js';