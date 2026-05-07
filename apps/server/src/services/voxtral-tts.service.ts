/**
 * Voxtral TTS Service — Mistral text-to-speech (souveraineté EU).
 *
 * Voxtral TTS fonctionne par voice cloning : pas de voix pré-définies, on
 * passe soit un `voice_id` (créé via `client.audio.voices.create()` avec un
 * sample audio uploadé une fois pour toutes), soit un `ref_audio` inline à
 * chaque requête (sample base64 + format).
 *
 * Le SDK officiel ne couvre pas encore l'endpoint TTS — appel REST direct.
 *
 * Performance Voxtral (mai 2026) : ~90ms processing, ~0.8s TTFA en PCM,
 * ~3s TTFA en MP3 — adapté aux assistants vocaux temps réel.
 *
 * Workflow opérationnel :
 *  1. Créer 3 voix maîtres (primaire, collège, lycée) via le script
 *     `scripts/voxtral-create-voices.ts` — récupère 3 voice_id stables.
 *  2. Renseigner `VOXTRAL_VOICE_PRIMAIRE`, `VOXTRAL_VOICE_COLLEGE`,
 *     `VOXTRAL_VOICE_LYCEE` dans l'env de prod.
 *  3. Le service sélectionne automatiquement la voix selon le niveau scolaire.
 */

import { logger } from '../lib/observability.js';
import { appConfig } from '../config/app.config.js';
import type { EducationLevelType } from '../types/education.types.js';

export interface VoxtralTTSResult {
  success: boolean;
  /** Base64-encoded audio (mp3 by default). */
  audioData?: string;
  mimeType?: string;
  durationMs?: number;
  error?: string;
}

export interface VoxtralTTSOptions {
  /**
   * Pre-created Voxtral voice id (preferred — stable, no per-call upload).
   * Falls back to the env-configured voice for the school level when omitted.
   */
  voiceId?: string;
  /**
   * One-shot reference audio (base64) used when no `voiceId` is provided and
   * no level-mapped env voice is configured. Costs more (the sample is sent
   * with each request).
   */
  refAudio?: { base64: string; format: 'mp3' | 'wav' | 'opus' | 'pcm' };
  language?: 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'nl' | 'ar' | 'hi';
  schoolLevel?: EducationLevelType;
  /** Output audio format. Default: mp3. */
  format?: 'mp3' | 'wav' | 'opus' | 'pcm';
}

const VOICE_ENV_BY_LEVEL: Record<string, string> = {
  cp: 'VOXTRAL_VOICE_PRIMAIRE',
  ce1: 'VOXTRAL_VOICE_PRIMAIRE',
  ce2: 'VOXTRAL_VOICE_PRIMAIRE',
  cm1: 'VOXTRAL_VOICE_PRIMAIRE',
  cm2: 'VOXTRAL_VOICE_PRIMAIRE',
  sixieme: 'VOXTRAL_VOICE_COLLEGE',
  cinquieme: 'VOXTRAL_VOICE_COLLEGE',
  quatrieme: 'VOXTRAL_VOICE_COLLEGE',
  troisieme: 'VOXTRAL_VOICE_COLLEGE',
  seconde: 'VOXTRAL_VOICE_LYCEE',
  premiere: 'VOXTRAL_VOICE_LYCEE',
  terminale: 'VOXTRAL_VOICE_LYCEE',
};

const TTS_ENDPOINT = 'https://api.mistral.ai/v1/audio/speech';
const MAX_TEXT_LENGTH = 5000;

interface SpeechRequestBody {
  model: string;
  input: string;
  response_format: string;
  voice_id?: string;
  ref_audio?: string;
  ref_audio_format?: string;
  language?: string;
}

export class VoxtralTTSService {
  private readonly apiKey: string;
  private readonly model: string;

  constructor() {
    const apiKey = appConfig.ai.mistral?.apiKey;
    if (!apiKey) {
      throw new Error('MISTRAL_API_KEY is required for Voxtral TTS');
    }
    this.apiKey = apiKey;
    this.model = appConfig.ai.mistral?.ttsModel ?? 'voxtral-tts-2603';
  }

  async synthesize(text: string, options: VoxtralTTSOptions = {}): Promise<VoxtralTTSResult> {
    const startTime = Date.now();
    const { voiceId, refAudio, language = 'fr', schoolLevel, format = 'mp3' } = options;

    if (!text || text.trim().length === 0) {
      return { success: false, error: 'Texte vide' };
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return { success: false, error: `Texte trop long (max ${MAX_TEXT_LENGTH} caractères)` };
    }

    const resolvedVoiceId = voiceId ?? this.resolveVoiceFromEnv(schoolLevel);
    if (!resolvedVoiceId && !refAudio) {
      return {
        success: false,
        error:
          "Aucune voix Voxtral configurée : passe `voiceId`/`refAudio` ou renseigne VOXTRAL_VOICE_* dans l'env.",
      };
    }

    const body: SpeechRequestBody = {
      model: this.model,
      input: text,
      response_format: format,
      language,
    };
    if (resolvedVoiceId) {
      body.voice_id = resolvedVoiceId;
    } else if (refAudio) {
      body.ref_audio = refAudio.base64;
      body.ref_audio_format = refAudio.format;
    }

    try {
      logger.info('Voxtral TTS: starting synthesis', {
        operation: 'voxtral-tts:start',
        textLength: text.length,
        voiceId: resolvedVoiceId ?? 'ref-audio-inline',
        language,
        format,
      });

      const response = await fetch(TTS_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          Accept: format === 'mp3' ? 'audio/mpeg' : `audio/${format}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Voxtral TTS request failed', {
          operation: 'voxtral-tts',
          _error: `${response.status} - ${errorText}`,
          severity: 'high' as const,
        });
        return { success: false, error: `Voxtral TTS error: ${response.status}` };
      }

      const audioBuffer = await response.arrayBuffer();
      const audioData = Buffer.from(audioBuffer).toString('base64');
      // Rough estimate (~16 KB/s for 128kbps mp3).
      const estimatedDurationMs = Math.round((audioBuffer.byteLength / 16000) * 1000);

      logger.info('Voxtral TTS synthesis completed', {
        operation: 'voxtral-tts:complete',
        textLength: text.length,
        audioBytes: audioBuffer.byteLength,
        estimatedDurationMs,
        durationMs: Date.now() - startTime,
      });

      return {
        success: true,
        audioData,
        mimeType: format === 'mp3' ? 'audio/mpeg' : `audio/${format}`,
        durationMs: estimatedDurationMs,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Voxtral TTS synthesis error', {
        operation: 'voxtral-tts',
        _error: errorMessage,
        durationMs: Date.now() - startTime,
        severity: 'high' as const,
      });
      return { success: false, error: errorMessage };
    }
  }

  private resolveVoiceFromEnv(schoolLevel: EducationLevelType | undefined): string | null {
    if (!schoolLevel) {
      return Bun.env['VOXTRAL_VOICE_DEFAULT'] ?? null;
    }
    const envKey = VOICE_ENV_BY_LEVEL[schoolLevel];
    if (envKey) {
      const fromEnv = Bun.env[envKey];
      if (fromEnv) return fromEnv;
    }
    return Bun.env['VOXTRAL_VOICE_DEFAULT'] ?? null;
  }
}

let _voxtralTtsService: VoxtralTTSService | null = null;

export function getVoxtralTTSService(): VoxtralTTSService {
  _voxtralTtsService ??= new VoxtralTTSService();
  return _voxtralTtsService;
}

export function isVoxtralTTSConfigured(): boolean {
  return !!appConfig.ai.mistral?.apiKey;
}
