/**
 * Voxtral Transcription Service — Mistral STT (souveraineté EU)
 *
 * Voxtral Mini Transcribe 2 via Mistral Audio API. Multilingue avec
 * détection automatique de la langue.
 *
 * @see https://docs.mistral.ai/api/#tag/audio
 */

import { logger } from '../lib/observability.js';
import { appConfig } from '../config/app.config.js';
import { getMistralClient } from '../lib/mistral-client.js';

export interface VoxtralTranscriptionSegment {
  text: string;
  start: number;
  end: number;
}

export interface VoxtralTranscriptionResult {
  success: boolean;
  transcription?: string;
  detectedLanguage?: string;
  /** Estimated confidence (segment count / words count heuristic, 0-1). */
  confidence?: number;
  duration?: number;
  segments?: VoxtralTranscriptionSegment[];
  error?: string;
}

export interface VoxtralTranscriptionOptions {
  /** Two-letter ISO language code (fr, en, es, de). Boosts accuracy when set. */
  language?: string;
  /** Auto-detect language. When true, `language` becomes a hint only. */
  detectLanguage?: boolean;
  /** Mistral model id (default: voxtral-mini-transcribe-latest). */
  model?: string;
}

const EXTENSIONS: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp3': 'mp3',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/m4a': 'm4a',
  'audio/mp4': 'm4a',
  'audio/flac': 'flac',
};

export class VoxtralTranscriptionService {
  private readonly defaultModel: string;

  constructor() {
    this.defaultModel =
      appConfig.ai.mistral?.transcribeModel ?? 'voxtral-mini-transcribe-latest';
  }

  async transcribe(
    audioBuffer: ArrayBuffer,
    mimeType: string,
    options: VoxtralTranscriptionOptions = {},
  ): Promise<VoxtralTranscriptionResult> {
    const startTime = Date.now();
    const { language, detectLanguage = true, model = this.defaultModel } = options;
    const ext = EXTENSIONS[mimeType] ?? 'webm';

    try {
      logger.info('Voxtral: starting transcription', {
        operation: 'voxtral:transcribe',
        mimeType,
        sizeBytes: audioBuffer.byteLength,
        model,
      });

      const client = getMistralClient();
      const blob = new Blob([audioBuffer], { type: mimeType });

      const response = await client.audio.transcriptions.complete({
        model,
        file: { fileName: `audio.${ext}`, content: blob },
        ...(language && !detectLanguage ? { language } : {}),
        timestampGranularities: ['segment'],
      });

      const text = (response.text ?? '').trim();
      const detectedLang = response.language ?? language ?? 'unknown';
      const segments = response.segments?.map<VoxtralTranscriptionSegment>((s) => ({
        text: s.text,
        start: s.start,
        end: s.end,
      })) ?? [];
      const duration = segments.length > 0 ? segments[segments.length - 1]?.end : undefined;

      const durationMs = Date.now() - startTime;

      logger.info('Voxtral transcription completed', {
        operation: 'voxtral:transcribe',
        durationMs,
        transcriptionLength: text.length,
        detectedLanguage: detectedLang,
        segmentCount: segments.length,
      });

      return {
        success: true,
        transcription: text,
        detectedLanguage: detectedLang,
        duration,
        segments,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Voxtral transcription error', {
        operation: 'voxtral:transcribe',
        _error: errorMessage,
        durationMs,
        severity: 'high' as const,
      });
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}

let _voxtralTranscriptionService: VoxtralTranscriptionService | null = null;

export function getVoxtralTranscriptionService(): VoxtralTranscriptionService {
  _voxtralTranscriptionService ??= new VoxtralTranscriptionService();
  return _voxtralTranscriptionService;
}

export function isVoxtralTranscriptionConfigured(): boolean {
  return !!appConfig.ai.mistral?.apiKey;
}
