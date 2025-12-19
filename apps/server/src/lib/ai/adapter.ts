/**
 * TanStack AI - Configuration adapter Gemini
 *
 * Architecture 2025 : Unified AI SDK avec Gemini 2.5 Flash
 * Remplace @google/genai par @tanstack/ai-gemini pour :
 * - API unifiée type-safe
 * - Server Tools avec Zod
 * - Structured Output natif
 * - Streaming simplifié
 */

import { gemini, type GeminiAdapterConfig } from '@tanstack/ai-gemini';
import { appConfig } from '../../config/app.config.js';

/** Configuration Gemini avec API Key */
const geminiConfig: GeminiAdapterConfig = {
  apiKey: appConfig.ai.gemini.apiKey ?? '',
};

/**
 * Adapter Gemini configuré pour TomAI
 * Utilise les variables d'environnement centralisées
 */
export const geminiAdapter = gemini(geminiConfig);

/**
 * Modèles disponibles pour différents cas d'usage
 */
export const AI_MODELS = {
  /** Chat principal - Socratique éducatif */
  chat: appConfig.ai.gemini.model,
  /** Génération de cartes - Structured output */
  cards: appConfig.ai.gemini.model,
  /** Transcription audio */
  audio: appConfig.ai.gemini.audioModel,
} as const;

/**
 * Type pour les modèles disponibles
 */
export type AIModel = typeof AI_MODELS[keyof typeof AI_MODELS];
