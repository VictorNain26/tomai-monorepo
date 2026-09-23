/**
 * Text-to-Speech façade — délègue à Voxtral (Mistral, souveraineté EU).
 *
 * Lecture des réponses de l'IA à voix haute, prononciation pour les matières
 * de langue, accessibilité dyslexie. Pas de fallback silencieux : si Voxtral
 * n'est pas configuré, on retourne une erreur explicite — la route TTS
 * répond 500 et le frontend peut afficher un message clair.
 */

import { logger } from '../lib/observability.js';
import { normalizeForSpeech } from '../lib/text/speech-normalize.js';
import type { EducationLevelType } from '../types/education.types.js';
import { getVoxtralTTSService, isVoxtralTTSConfigured } from './voxtral-tts.service.js';

interface TTSResult {
  success: boolean;
  audioData?: string;
  mimeType?: string;
  _error?: string;
}

export interface TTSOptions {
  language?: 'fr' | 'en' | 'es' | 'de';
  schoolLevel?: EducationLevelType;
}

class TextToSpeechService {
  constructor() {
    if (!isVoxtralTTSConfigured()) {
      logger.warn('MISTRAL_API_KEY not configured — TTS (Voxtral) will fail', {
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
      const normalizedText = normalizeForSpeech(text);
      const result = await getVoxtralTTSService().synthesize(normalizedText, {
        schoolLevel: options.schoolLevel,
      });

      if (!result.success || !result.audioData) {
        return { success: false, _error: result.error ?? 'Échec de la synthèse vocale' };
      }

      logger.info('TTS synthesis completed', {
        operation: 'tts:synthesis:complete',
        provider: 'voxtral',
        textLength: text.length,
        durationMs: Date.now() - startTime,
      });

      return {
        success: true,
        audioData: result.audioData,
        mimeType: result.mimeType ?? 'audio/mpeg',
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
