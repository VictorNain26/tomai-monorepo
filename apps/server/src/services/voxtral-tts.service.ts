/**
 * Voxtral TTS Service — Mistral text-to-speech souveraine EU.
 *
 * Appelle POST {MISTRAL_SERVER_URL}/v1/audio/speech via le SDK
 * @mistralai/mistralai (`audio.speech.complete`), avec le client partagé
 * `getMistralSdk()` — aucune clé ni URL de base à gérer ici.
 *
 * @see https://docs.mistral.ai/capabilities/audio/text_to_speech
 */

import { logger } from '../lib/observability.js';
import { env } from '../config/env.js';
import { getMistralSdk } from '../lib/ai/mistral-sdk.js';
import type { EducationLevelType } from '../types/education.types.js';

interface VoxtralTTSResult {
  success: boolean;
  audioData?: string;
  mimeType?: string;
  error?: string;
}

interface VoxtralTTSOptions {
  voiceId?: string;
  schoolLevel?: EducationLevelType;
  outputFormat?: 'mp3' | 'wav' | 'pcm' | 'flac' | 'opus';
}

// fr_marie_neutral est la voix française neutre parmi les 30 presets exposés
// sans création préalable (GET /v1/audio/voices) ; l'API rejette `language`,
// c'est la voix qui porte la langue. Voice cloning + mapping par niveau
// scolaire viendront dans une itération suivante.
const DEFAULT_VOICE = 'fr_marie_neutral';

const FORMAT_TO_MIME: Record<NonNullable<VoxtralTTSOptions['outputFormat']>, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  pcm: 'audio/pcm',
  flac: 'audio/flac',
  opus: 'audio/opus',
};

const MAX_INPUT_CHARS = 5_000;

class VoxtralTTSService {
  private readonly model = env.MISTRAL_TTS_MODEL;

  async synthesize(text: string, options: VoxtralTTSOptions = {}): Promise<VoxtralTTSResult> {
    const startTime = Date.now();

    if (!text || text.trim().length === 0) {
      return { success: false, error: 'Texte vide' };
    }
    if (text.length > MAX_INPUT_CHARS) {
      return { success: false, error: `Texte trop long (max ${MAX_INPUT_CHARS} caractères)` };
    }

    const voice = options.voiceId ?? DEFAULT_VOICE;
    const outputFormat = options.outputFormat ?? 'mp3';
    const mimeType = FORMAT_TO_MIME[outputFormat];

    logger.info('Voxtral TTS synthesis starting', {
      operation: 'voxtral:tts:start',
      textLength: text.length,
      voice,
      model: this.model,
    });

    try {
      const response = await getMistralSdk().audio.speech.complete({
        model: this.model,
        input: text,
        voiceId: voice,
        responseFormat: outputFormat,
      });

      logger.info('Voxtral TTS synthesis completed', {
        operation: 'voxtral:tts:complete',
        textLength: text.length,
        durationMs: Date.now() - startTime,
      });

      return { success: true, audioData: response.audioData, mimeType };
    } catch (error) {
      logger.error('Voxtral TTS synthesis error', {
        operation: 'voxtral:tts',
        _error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
        severity: 'high' as const,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown Voxtral TTS error',
      };
    }
  }
}

let _voxtralService: VoxtralTTSService | null = null;

export function getVoxtralTTSService(): VoxtralTTSService {
  _voxtralService ??= new VoxtralTTSService();
  return _voxtralService;
}

export function isVoxtralTTSConfigured(): boolean {
  return Boolean(env.MISTRAL_API_KEY);
}
