/**
 * TanStack AI - Configuration adapter Gemini
 *
 * Architecture 2025 : Unified AI SDK avec Gemini 3 Flash
 * Remplace @google/genai par @tanstack/ai-gemini pour :
 * - API unifiée type-safe
 * - Server Tools avec Zod
 * - Structured Output natif
 * - Streaming simplifié
 *
 * API v0.2.0: Model baked into adapter via createGeminiChat
 */

import { createGeminiChat, type GeminiTextConfig } from '@tanstack/ai-gemini';
import { appConfig } from '../../config/app.config.js';

/** Configuration Gemini optionnelle */
const geminiConfig: Omit<GeminiTextConfig, 'apiKey'> = {};

/**
 * Modèles disponibles pour différents cas d'usage
 */
export const AI_MODELS = {
  /** Chat principal - Socratique éducatif */
  chat: appConfig.ai.gemini.model as 'gemini-3-flash-preview',
  /** Génération de cartes - Structured output */
  cards: appConfig.ai.gemini.model as 'gemini-3-flash-preview',
  /** Transcription audio */
  audio: appConfig.ai.gemini.audioModel,
} as const;

/**
 * Adapter Gemini pour chat - modèle principal
 * Utilise les variables d'environnement centralisées
 */
export const geminiAdapter = createGeminiChat(
  // @ts-expect-error - Gemini 3 Flash (Dec 2025) not yet in @tanstack/ai-gemini types
  AI_MODELS.chat,
  appConfig.ai.gemini.apiKey ?? '',
  geminiConfig
);

/**
 * Type pour les modèles disponibles
 */
export type AIModel = typeof AI_MODELS[keyof typeof AI_MODELS];
