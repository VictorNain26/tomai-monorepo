/**
 * Token Budget Service — Estimation et allocation de budget tokens
 *
 * Estimation par comptage caractères (4 chars ≈ 1 token pour du français).
 * Pas d'appel API — vitesse prioritaire.
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Budget total cible envoyé à Mistral (input tokens).
 * Mistral mistral-medium-latest has 128k context window. We conservatively
 * target 30k tokens of input to leave room for cached prompt sections
 * (9k system prompt + tools) and output tokens (16k). Recalibrated for
 * Mistral from Gemini-era values (formerly 25k for Gemini's 32k window).
 * CCA Sprint 1 safety: confirmed for mistral-medium-latest v0.14.1+.
 */
const TARGET_BUDGET_TOKENS = 30_000;

/**
 * Overhead fixe: system prompt + tool declarations.
 * Mistral system prompt: ~2k. Tool declarations: ~500. Total: ~2.5k.
 * Capped at 2500 to account for prompt cache overhead.
 */
const FIXED_OVERHEAD_TOKENS = 2_500;

/**
 * Réserve pour la réponse générée.
 * Output reserve: 16k tokens for assistant response. Mistral limit per
 * completion is typically 4k (configurable per call), but we reserve more
 * for multi-turn conversations where the assistant may generate longer reasoning.
 */
const OUTPUT_RESERVE_TOKENS = 16_384;

/** Ratio chars/token pour du texte français */
const CHARS_PER_TOKEN = 4;

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface TokenBudget {
  /** Budget total disponible pour le contenu (hors overhead + output) */
  availableTokens: number;
  /** Budget alloué au résumé (15%) */
  summaryMaxTokens: number;
  /** Budget alloué à l'historique récent (55%) */
  historyMaxTokens: number;
  /** Budget alloué au contexte RAG (20%) */
  ragMaxTokens: number;
  /** Budget alloué au message courant (10%) */
  currentMessageMaxTokens: number;
}

interface TokenEstimate {
  text: string;
  estimatedTokens: number;
  wasTruncated: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Estime le nombre de tokens dans un texte (heuristique rapide).
 * Ratio: ~4 caractères par token pour du français.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Tronque un texte pour respecter un budget tokens.
 * Coupe à la fin de la dernière phrase complète avant la limite.
 */
export function truncateToTokenBudget(text: string, maxTokens: number): TokenEstimate {
  if (!text) return { text: '', estimatedTokens: 0, wasTruncated: false };

  const estimated = estimateTokens(text);
  if (estimated <= maxTokens) {
    return { text, estimatedTokens: estimated, wasTruncated: false };
  }

  const maxChars = maxTokens * CHARS_PER_TOKEN;
  let truncated = text.slice(0, maxChars);

  // Couper à la dernière phrase complète (point, exclamation, interrogation)
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('.\n'),
    truncated.lastIndexOf('! '),
    truncated.lastIndexOf('? ')
  );

  if (lastSentenceEnd > maxChars * 0.5) {
    truncated = truncated.slice(0, lastSentenceEnd + 1);
  }

  return {
    text: truncated,
    estimatedTokens: estimateTokens(truncated),
    wasTruncated: true,
  };
}

/**
 * Calcule le budget tokens disponible et sa répartition.
 */
export function calculateBudget(): TokenBudget {
  const availableTokens = TARGET_BUDGET_TOKENS - FIXED_OVERHEAD_TOKENS - OUTPUT_RESERVE_TOKENS;

  return {
    availableTokens,
    summaryMaxTokens: Math.floor(availableTokens * 0.15),
    historyMaxTokens: Math.floor(availableTokens * 0.55),
    ragMaxTokens: Math.floor(availableTokens * 0.20),
    currentMessageMaxTokens: Math.floor(availableTokens * 0.10),
  };
}
