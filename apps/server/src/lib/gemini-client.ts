/**
 * Shared GoogleGenAI client.
 *
 * Previously each AI service (chat, summarization, auto-title, card-generator,
 * document-analysis) instantiated its own GoogleGenAI object at module load.
 * That duplicated the SDK's internal state (HTTP agents, auth refresh) and
 * made dependency injection in tests awkward.
 *
 * Share a single client per process. Tests can override via `setGeminiClient`.
 */

import { GoogleGenAI } from '@google/genai';
import { appConfig } from '../config/app.config.js';

let instance: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  instance ??= new GoogleGenAI({ apiKey: appConfig.ai.gemini.apiKey ?? '' });
  return instance;
}

/** Test hook: inject a mock client or reset to force re-init. */
export function setGeminiClient(client: GoogleGenAI | null): void {
  instance = client;
}
