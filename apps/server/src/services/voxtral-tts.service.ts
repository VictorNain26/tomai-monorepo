/**
 * Voxtral TTS Service — Mistral text-to-speech souveraine EU.
 *
 * Appelle directement POST {MISTRAL_SERVER_URL}/v1/audio/speech car le SDK
 * `@mistralai/mistralai` 2.2.1 expose seulement la transcription (audio→texte),
 * pas la synthèse (texte→audio). Confirmé par inspection v2.2.1 en mai 2026 :
 * funcs/audioTranscriptions{Complete,Stream} existent, aucun équivalent speech.
 *
 * @see https://docs.mistral.ai/capabilities/audio/text_to_speech
 */

import { logger } from '../lib/observability.js';
import { env } from '../config/env.js';
import type { EducationLevelType } from '../types/education.types.js';

interface VoxtralTTSResult {
  success: boolean;
  audioData?: string;
  mimeType?: string;
  durationMs?: number;
  error?: string;
}

interface VoxtralTTSOptions {
  voiceId?: string;
  schoolLevel?: EducationLevelType;
  outputFormat?: 'mp3' | 'wav' | 'pcm' | 'flac' | 'opus';
}

// Mistral expose 30 preset voices accessibles sans création préalable (GET
// /v1/audio/voices). fr_marie_neutral est la seule voix française neutre —
// casual_male, utilisée avant, n'existe pas (404 "Voice 'casual_male' not
// found", observé sur l'API live le 2026-09-22). Voice cloning + mapping par
// niveau scolaire viendront dans une itération suivante.
const DEFAULT_VOICE = 'fr_marie_neutral';

const FORMAT_TO_MIME: Record<NonNullable<VoxtralTTSOptions['outputFormat']>, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  pcm: 'audio/pcm',
  flac: 'audio/flac',
  opus: 'audio/opus',
};

// MP3 128 kbps ≈ 16 KB/s — sert à estimer la durée sans décoder l'audio.
const MP3_BYTES_PER_SECOND = 16_000;
const MAX_INPUT_CHARS = 5_000;

class VoxtralTTSService {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl = `${env.MISTRAL_SERVER_URL}/v1`;

  constructor() {
    if (!env.MISTRAL_API_KEY) {
      throw new Error('MISTRAL_API_KEY is required for Voxtral TTS');
    }
    this.apiKey = env.MISTRAL_API_KEY;
    this.model = env.MISTRAL_TTS_MODEL;
  }

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
      const response = await fetch(`${this.baseUrl}/audio/speech`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: text,
          voice,
          response_format: outputFormat,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Voxtral TTS request failed', {
          operation: 'voxtral:tts',
          _error: `${response.status} — ${errorText.slice(0, 500)}`,
          severity: 'high' as const,
        });
        return { success: false, error: `Mistral TTS API error: ${response.status}` };
      }

      const audioData = await this.readAudio(response);
      const audioBytes = Buffer.from(audioData, 'base64').byteLength;
      const estimatedDurationMs = Math.round((audioBytes / MP3_BYTES_PER_SECOND) * 1000);

      logger.info('Voxtral TTS synthesis completed', {
        operation: 'voxtral:tts:complete',
        textLength: text.length,
        audioBytes,
        estimatedDurationMs,
        durationMs: Date.now() - startTime,
      });

      return { success: true, audioData, mimeType, durationMs: estimatedDurationMs };
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

  /**
   * L'API peut renvoyer soit l'audio binaire brut (audio/*), soit un JSON
   * {audio_data: "<base64>"} selon la version. On gère les deux pour rester
   * robuste face à un changement de schéma documenté.
   */
  private async readAudio(response: Response): Promise<string> {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as { audio_data?: string };
      if (!payload.audio_data) {
        throw new Error('Mistral TTS JSON response missing audio_data');
      }
      return payload.audio_data;
    }
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
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
