/**
 * Optimiseur de conversations — SummaryBuffer pattern
 *
 * Best Practice 2026:
 * - Si pas de résumé → retourner l'historique tel quel (backward compatible)
 * - Si résumé disponible → retourner UNIQUEMENT la fenêtre verbatim récente (≤ RECENT_WINDOW_SIZE)
 * - Le texte du résumé synthétique est injecté en amont (chat-message-assembler), PAS ici
 * - Budget tokens géré par truncation intelligente
 */

import type { IAIMessage, OptimizationContext } from './types.js';
import { estimateTokens, calculateBudget } from '../../services/chat/token-budget.service.js';

/**
 * Nombre max de messages récents gardés verbatim (5 échanges user+assistant)
 */
const RECENT_WINDOW_SIZE = 10;

/**
 * Optimise l'historique conversationnel avec le pattern SummaryBuffer.
 *
 * - Sans résumé: retourne l'historique tel quel (backward compatible)
 * - Avec résumé: retourne UNIQUEMENT la fenêtre verbatim récente (≤ RECENT_WINDOW_SIZE), tronquée au budget
 * - Le résumé synthétique est injecté séparément en amont (chat-message-assembler)
 */
export function optimizeConversationHistory(
  history: IAIMessage[],
  context?: OptimizationContext
): IAIMessage[] {
  // Backward compatible: pas de résumé → pass-through
  if (!context?.conversationSummary) {
    return history;
  }

  const budget = calculateBudget();

  // Garder les messages récents (fenêtre glissante)
  const recentMessages = history.slice(-RECENT_WINDOW_SIZE);

  // Vérifier le budget tokens pour l'historique récent
  const historyText = recentMessages.map(m => m.content).join('\n');
  const historyTokens = estimateTokens(historyText);

  // Si l'historique récent dépasse le budget, supprimer les plus anciens
  if (historyTokens > budget.historyMaxTokens) {
    let currentTokens = historyTokens;
    const trimmed = [...recentMessages];

    while (trimmed.length > 2 && currentTokens > budget.historyMaxTokens) {
      const removed = trimmed.shift();
      if (removed) {
        currentTokens -= estimateTokens(removed.content);
      }
    }

    return trimmed;
  }

  return recentMessages;
}
