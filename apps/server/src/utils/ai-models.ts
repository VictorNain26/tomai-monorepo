/**
 * AI Models Utilities - Normalisation centralisée Gemini 3 Flash
 */

import { logger } from '../lib/observability.js';

export type AIModelEnum = 'gemini_3_flash';

/**
 * Mapping centralisé des noms de modèles Gemini 2025 (usage interne)
 */
const AI_MODELS = {
  GEMINI: {
    enum: 'gemini_3_flash' as const,
    keywords: ['gemini', 'gemini-3-flash', 'gemini-3-flash-preview', 'gemini-flash']
  }
} as const;

/**
 * Normalise le nom du modèle vers l'enum de la base de données
 */
export function normalizeToEnum(modelName?: string | null): AIModelEnum {
  if (!modelName) return AI_MODELS.GEMINI.enum;

  const normalized = modelName.toLowerCase().trim();

  // Recherche par mots-clés
  for (const model of Object.values(AI_MODELS)) {
    if (model.keywords.some(keyword => normalized.includes(keyword))) {
      return model.enum;
    }
  }

  logger.warn(`Unknown AI model: "${modelName}" - using Gemini`, { operation: 'ai:model:normalize', modelName });
  return AI_MODELS.GEMINI.enum;
}
