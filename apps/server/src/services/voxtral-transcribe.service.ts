/**
 * Voxtral STT Service — Mistral speech-to-text souveraine EU.
 *
 * Appelle POST {MISTRAL_SERVER_URL}/v1/audio/transcriptions via le SDK
 * @mistralai/mistralai (multipart/form-data géré par le SDK), avec la clé
 * MISTRAL_API_KEY portée par le client partagé — aucune clé tierce.
 *
 * Réponse Mistral : { model, text, language, usage }. Voxtral ne détecte pas la
 * langue : detectedLanguage renvoie la langue forcée à la transcription.
 *
 * @see https://docs.mistral.ai/capabilities/audio/
 */

import { logger } from '../lib/observability.js';
import { env } from '../config/env.js';
import { getMistralSdk } from '../lib/ai/mistral-sdk.js';

const STT_MODEL = env.MISTRAL_STT_MODEL;

/** @public — reachable only via Eden Treaty's inferred route return types (apps/server build:types), not a direct import; knip false positive. */
export interface VoxtralTranscribeResult {
  success: boolean;
  transcription?: string;
  /** Langue passée à la requête (Voxtral ne détecte pas automatiquement). */
  detectedLanguage?: string;
  error?: string;
}

/** @public — reachable only via Eden Treaty's inferred route return types (apps/server build:types), not a direct import; knip false positive. */
export interface VoxtralTranscribeOptions {
  /**
   * Code ISO-639-1 de la langue attendue (ex. "fr").
   * Forcer la langue améliore la précision sur Voxtral.
   * @default "fr"
   */
  language?: string;
}

class VoxtralTranscribeService {
  async transcribe(
    audioBuffer: ArrayBuffer,
    mimeType: string,
    options: VoxtralTranscribeOptions = {}
  ): Promise<VoxtralTranscribeResult> {
    const startTime = Date.now();
    const language = options.language ?? 'fr';

    try {
      const response = await getMistralSdk().audio.transcriptions.complete({
        model: STT_MODEL,
        file: { fileName: 'audio', content: new Blob([audioBuffer], { type: mimeType }) },
        language,
      });

      if (!response.text) {
        logger.error('Voxtral STT returned empty text', {
          operation: 'voxtral:stt',
          _error: 'empty transcription',
          severity: 'high' as const,
        });
        return { success: false, error: 'Voxtral STT returned empty transcription' };
      }

      logger.info('Voxtral STT transcription completed', {
        operation: 'voxtral:stt',
        language,
        model: response.model,
        durationMs: Date.now() - startTime,
      });

      return {
        success: true,
        transcription: response.text,
        detectedLanguage: language,
      };
    } catch (error) {
      logger.error('Voxtral STT transcription error', {
        operation: 'voxtral:stt',
        _error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
        severity: 'high' as const,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown Voxtral STT error',
      };
    }
  }
}

let _service: VoxtralTranscribeService | null = null;

export function getVoxtralTranscribeService(): VoxtralTranscribeService {
  _service ??= new VoxtralTranscribeService();
  return _service;
}

export function isVoxtralTranscribeConfigured(): boolean {
  return Boolean(env.MISTRAL_API_KEY);
}
