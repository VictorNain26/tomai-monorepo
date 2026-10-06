/**
 * Voxtral TTS Service — Mistral text-to-speech souveraine EU.
 *
 * Appelle POST {MISTRAL_SERVER_URL}/v1/audio/speech via le SDK
 * @mistralai/mistralai (`audio.speech.complete`), avec le client partagé
 * `getMistralSdk()` — aucune clé ni URL de base à gérer ici.
 *
 * @see https://docs.mistral.ai/capabilities/audio/text_to_speech
 */

import { logger } from '../../platform/observability/logger.js';
import { env } from '../../platform/config/env.js';
import { getMistralSdk } from '../../platform/ai/mistral-sdk.js';
import { recordAiCost, type CostOwner } from '../../platform/ai/cost.js';
import { MistralError } from '@mistralai/mistralai/models/errors';
import type { EducationLevelType } from '../../types/index.js';

interface VoxtralTTSResult {
  success: boolean;
  audioData?: string;
  mimeType?: string;
  error?: string;
}

interface VoxtralTTSOptions {
  voiceId?: string | undefined;
  schoolLevel?: EducationLevelType | undefined;
  outputFormat?: 'mp3' | 'wav' | 'pcm' | 'flac' | 'opus' | undefined;
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

const GRAPHEMES = new Intl.Segmenter('fr', { granularity: 'grapheme' });

class VoxtralTTSService {
  private readonly model = env.MISTRAL_TTS_MODEL;

  async synthesize(text: string, owner: CostOwner, options: VoxtralTTSOptions = {}): Promise<VoxtralTTSResult> {
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
      // Billed on the characters of the text read (https://mistral.ai/news/voxtral-tts/), counted as
      // graphemes, not UTF-16 units: an emoji or a decomposed accent is one. The response gives no usage.
      void recordAiCost(owner, { model: this.model, operation: 'text-to-speech', characters: [...GRAPHEMES.segment(text)].length });

      logger.info('Voxtral TTS synthesis completed', {
        operation: 'voxtral:tts:complete',
        textLength: text.length,
        durationMs: Date.now() - startTime,
      });

      return { success: true, audioData: response.audioData, mimeType };
    } catch (error) {
      logger.error('Voxtral TTS synthesis error', {
        operation: 'voxtral:tts',
        err: error,
        durationMs: Date.now() - startTime,
        severity: 'high' as const,
      });
      if (error instanceof MistralError) {
        return { success: false, error: `Mistral TTS API error: ${error.statusCode}` };
      }
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
