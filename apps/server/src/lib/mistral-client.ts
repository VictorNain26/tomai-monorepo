/**
 * Shared Mistral SDK client.
 *
 * Single instance per process for chat, summarization, intent classification,
 * auto-titling, card generation, document analysis.
 *
 * Embeddings keep their own dedicated client instance in
 * `services/mistral-embeddings.service.ts` (different lazy lifecycle so tests
 * can run without an API key).
 */

import { Mistral } from '@mistralai/mistralai';
import { appConfig } from '../config/app.config.js';

let instance: Mistral | null = null;

export function getMistralClient(): Mistral {
  if (!instance) {
    const apiKey = appConfig.ai.mistral?.apiKey;
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error(
        'MISTRAL_API_KEY is required. Set it in the environment to use Mistral-backed AI services.',
      );
    }
    instance = new Mistral({ apiKey });
  }
  return instance;
}

/** Test hook: inject a mock client or reset to force re-init. */
export function setMistralClient(client: Mistral | null): void {
  instance = client;
}
