/**
 * Voxtral STT Service — Mistral speech-to-text souveraine EU.
 *
 * Appelle POST {MISTRAL_SERVER_URL}/v1/audio/transcriptions via le SDK
 * @mistralai/mistralai (multipart/form-data géré par le SDK), avec la clé
 * MISTRAL_API_KEY portée par le client partagé — aucune clé tierce.
 *
 * Le français est imposé. Mesuré le 2026-10-05 sur des réponses courtes, propres et bruitées :
 * sans langue, « Non. » devient « No. » ; avec la bonne langue, tout passe ; avec le français,
 * un « Yes. » bruité devient « Oui. ». Un oral de langue attend que le client déclare sa
 * langue (lot 3) : le serveur ne la connaît pas, la matière dit seulement « langues ».
 *
 * @see https://docs.mistral.ai/capabilities/audio/
 */

import { logger } from '../../platform/observability/logger.js';
import { env } from '../../platform/config/env.js';
import { getMistralSdk } from '../../platform/ai/mistral-sdk.js';
import { recordAiCost, type CostOwner } from '../../platform/ai/cost.js';

const STT_MODEL = env.MISTRAL_STT_MODEL;

/** @public — reachable only via the typed client's inferred route return types (apps/server build:types), not a direct import; knip false positive. */
export interface VoxtralTranscribeResult {
  success: boolean;
  transcription?: string;
  error?: string;
}

class VoxtralTranscribeService {
  /** `audio` as stored. Its bytes are copied: a Buffer can be a view into a larger pool. */
  async transcribe(audio: Uint8Array, mimeType: string, owner: CostOwner): Promise<VoxtralTranscribeResult> {
    const startTime = Date.now();

    try {
      const response = await getMistralSdk().audio.transcriptions.complete({
        model: STT_MODEL,
        // A plain { fileName, content } object isn't blob-like to the SDK: it falls back
        // to `getContentTypeFromFileName('audio')` (no extension -> null -> octet-stream),
        // dropping the real mimeType. A File is blob-like, so the SDK forwards it as-is
        // (esm/funcs/audioTranscriptionsComplete.js:33-48, esm/types/blobs.js isBlobLike).
        file: new File([Uint8Array.from(audio)], 'audio', { type: mimeType }),
        language: 'fr',
      });
      const audioSeconds = response.usage.promptAudioSeconds;
      if (audioSeconds == null) {
        logger.warn('Voxtral STT reported no audio length: the call is recorded at 0, marked', { operation: 'voxtral:stt:usage', severity: 'medium' as const });
      }
      void recordAiCost(owner, {
        model: STT_MODEL,
        operation: 'speech-to-text',
        ...(audioSeconds == null ? { usageUnknown: true } : { audioSeconds }),
      });

      if (!response.text) {
        logger.error('Voxtral STT returned empty text', {
          operation: 'voxtral:stt',
          reason: 'empty transcription',
          severity: 'high' as const,
        });
        return { success: false, error: 'Voxtral STT returned empty transcription' };
      }

      logger.info('Voxtral STT transcription completed', {
        operation: 'voxtral:stt',
        model: response.model,
        durationMs: Date.now() - startTime,
      });

      return {
        success: true,
        transcription: response.text,
      };
    } catch (error) {
      logger.error('Voxtral STT transcription error', {
        operation: 'voxtral:stt',
        err: error,
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
