/**
 * Service Text-to-Speech — Voxtral 100% (Mai 2026)
 *
 * Façade autour de `voxtral-tts.service`. Pas de fallback silencieux : si
 * Mistral n'est pas configuré, l'API renvoie une erreur explicite côté route.
 */

import { logger } from '../lib/observability.js';
import type { EducationLevelType } from '../types/education.types.js';
import { getVoxtralTTSService, isVoxtralTTSConfigured } from './voxtral-tts.service.js';

export interface TTSResult {
  success: boolean;
  audioData?: string;
  mimeType?: string;
  durationMs?: number;
  _error?: string;
}

export interface TTSOptions {
  language?: 'fr' | 'en' | 'es' | 'de';
  schoolLevel?: EducationLevelType;
}

export class TextToSpeechService {
  constructor() {
    if (!isVoxtralTTSConfigured()) {
      logger.warn('Mistral API key not configured — TTS will fail', {
        operation: 'tts:init',
      });
    }
  }

  async synthesize(text: string, options: TTSOptions = {}): Promise<TTSResult> {
    const startTime = Date.now();

    if (!isVoxtralTTSConfigured()) {
      return {
        success: false,
        _error: 'Service TTS non configuré (MISTRAL_API_KEY manquant)',
      };
    }

    try {
      const voxtral = getVoxtralTTSService();
      const result = await voxtral.synthesize(text, {
        language: options.language,
        schoolLevel: options.schoolLevel,
      });

      if (!result.success || !result.audioData) {
        logger.error('Voxtral TTS failed', {
          operation: 'tts:synthesis',
          _error: result.error ?? 'No audio data',
          severity: 'high' as const,
        });
        return {
          success: false,
          _error: result.error ?? 'Échec de la synthèse vocale',
        };
      }

      logger.info('TTS synthesis completed (Voxtral)', {
        operation: 'tts:synthesis:complete',
        provider: 'voxtral',
        textLength: text.length,
        durationMs: Date.now() - startTime,
      });

      return {
        success: true,
        audioData: result.audioData,
        mimeType: result.mimeType ?? 'audio/mpeg',
        durationMs: result.durationMs,
      };
    } catch (error) {
      logger.error('TTS synthesis error', {
        operation: 'tts:synthesis',
        _error: error instanceof Error ? error.message : String(error),
        severity: 'high' as const,
      });
      return {
        success: false,
        _error: error instanceof Error ? error.message : 'Échec de la synthèse vocale',
      };
    }
  }
}

export const textToSpeechService = new TextToSpeechService();
