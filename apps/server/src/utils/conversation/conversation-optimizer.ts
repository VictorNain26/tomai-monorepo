/**
 * Optimiseur de conversations - Simple pass-through
 *
 * Best Practice 2025 (Buffer Memory):
 * Avec 20 messages max depuis la DB (~4000 tokens),
 * on est largement dans le budget Gemini (8000 tokens historique).
 * Pas besoin de résumé - garder l'historique tel quel.
 */

import type { IAIMessage } from './types.js';

/**
 * Retourne l'historique tel quel (simple Buffer Memory)
 *
 * Avec limite de 20 messages en DB, pas besoin de compression.
 * Le sliding window de 20 messages est suffisant pour le contexte pédagogique.
 */
export function optimizeConversationHistory(history: IAIMessage[]): IAIMessage[] {
  return history;
}
