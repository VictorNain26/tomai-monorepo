/**
 * Voxtral STT Service — Mistral speech-to-text souveraine EU.
 *
 * Remplace Gladia (retiré). Appelle directement
 * POST https://api.mistral.ai/v1/audio/transcriptions via multipart/form-data.
 * La clé Mistral existante (MISTRAL_API_KEY) est réutilisée — aucune clé tierce.
 *
 * Réponse Mistral : { model: string, text: string }
 * Champs Gladia non fournis par Voxtral (signalés aux appelants) :
 *   - words/confidence : pas de timecodes ni de score par mot → pronunciationAnalysis
 *     sera ignoré faute de données (audio-transcription.service.ts l'ignore déjà
 *     quand words est vide).
 *   - detectedLanguage : on renvoie la langue forcée à la transcription.
 *   - duration : non fourni, renvoyé undefined.
 *
 * @see https://docs.mistral.ai/capabilities/audio/
 */

import { logger } from '../lib/observability.js';
import { env } from '../config/env.js';

const STT_ENDPOINT = 'https://api.mistral.ai/v1/audio/transcriptions';
const STT_MODEL = env.MISTRAL_STT_MODEL;

export interface VoxtralTranscribeResult {
  success: boolean;
  transcription?: string;
  /** Langue passée à la requête (Voxtral ne détecte pas automatiquement). */
  detectedLanguage?: string;
  /**
   * Toujours undefined : Voxtral ne renvoie pas de durée.
   * Présent pour compatibilité avec l'ancienne interface Gladia.
   */
  duration?: number;
  /**
   * Toujours undefined : Voxtral ne fournit pas de score de confiance global.
   * L'analyse de prononciation dans audio-transcription.service ne sera pas
   * calculée (words vide → branche ignorée).
   */
  words?: never;
  confidence?: never;
  error?: string;
}

export interface VoxtralTranscribeOptions {
  /**
   * Code ISO-639-1 de la langue attendue (ex. "fr").
   * Forcer la langue améliore la précision sur Voxtral.
   * @default "fr"
   */
  language?: string;
}

class VoxtralTranscribeService {
  private readonly apiKey: string;

  constructor() {
    if (!env.MISTRAL_API_KEY) {
      throw new Error('MISTRAL_API_KEY is required for Voxtral STT');
    }
    this.apiKey = env.MISTRAL_API_KEY;
  }

  async transcribe(
    audioBuffer: ArrayBuffer,
    mimeType: string,
    options: VoxtralTranscribeOptions = {}
  ): Promise<VoxtralTranscribeResult> {
    const startTime = Date.now();
    const language = options.language ?? 'fr';

    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer], { type: mimeType }), 'audio');
    formData.append('model', STT_MODEL);
    formData.append('language', language);

    try {
      const response = await fetch(STT_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Voxtral STT request failed', {
          operation: 'voxtral:stt',
          _error: `${response.status} — ${errorText.slice(0, 500)}`,
          severity: 'high' as const,
        });
        return {
          success: false,
          error: `Mistral STT API error: ${response.status}`,
        };
      }

      const payload = (await response.json()) as { text: string; model?: string };

      if (!payload.text) {
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
        model: payload.model ?? STT_MODEL,
        durationMs: Date.now() - startTime,
      });

      return {
        success: true,
        transcription: payload.text,
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
