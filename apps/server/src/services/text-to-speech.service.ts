/**
 * Service Text-to-Speech - TomAI
 *
 * Architecture ElevenLabs 100% (Migration Janvier 2025):
 * - ElevenLabs (UK, GDPR) : TTS production haute qualité
 *
 * ❌ Plus de dépendance Gemini pour le TTS
 * ❌ Pas de fallback silencieux - échec explicite si non configuré
 *
 * Cas d'usage éducatif :
 * - Lecture des réponses de l'IA à voix haute
 * - Prononciation correcte pour les matières de langue
 * - Accessibilité pour les élèves dyslexiques
 */

import { logger } from '../lib/observability.js';
import type { EducationLevelType } from '../types/education.types.js';
import { getElevenLabsTTSService, isElevenLabsConfigured } from './elevenlabs-tts.service.js';

// ============================================
// Types
// ============================================

export interface TTSResult {
  success: boolean;
  audioData?: string; // Base64 encoded audio
  mimeType?: string; // audio/mpeg (MP3)
  durationMs?: number; // Durée estimée en ms
  _error?: string;
}

export interface TTSOptions {
  /** Langue du texte */
  language?: 'fr' | 'en' | 'es' | 'de';
  /** Niveau scolaire pour adapter la voix */
  schoolLevel?: EducationLevelType;
}

// ============================================
// Service
// ============================================

export class TextToSpeechService {
  constructor() {
    if (!isElevenLabsConfigured()) {
      logger.warn('ElevenLabs API key not configured - TTS will fail', {
        operation: 'tts:init',
      });
    }
  }

  /**
   * Synthétise du texte en audio via ElevenLabs
   * Pas de fallback - échec explicite si non configuré
   */
  async synthesize(text: string, options: TTSOptions = {}): Promise<TTSResult> {
    const startTime = Date.now();

    // Vérifier que ElevenLabs est configuré
    if (!isElevenLabsConfigured()) {
      return {
        success: false,
        _error: 'Service TTS non configuré (ELEVENLABS_API_KEY manquant)',
      };
    }

    try {
      const elevenLabsService = getElevenLabsTTSService();
      const result = await elevenLabsService.synthesize(text, {
        language: options.language,
        schoolLevel: options.schoolLevel,
      });

      if (!result.success || !result.audioData) {
        logger.error('ElevenLabs TTS failed', {
          operation: 'tts:synthesis',
          _error: result.error ?? 'No audio data',
          severity: 'high' as const,
        });

        return {
          success: false,
          _error: result.error ?? 'Échec de la synthèse vocale',
        };
      }

      logger.info('TTS synthesis completed (ElevenLabs 100%)', {
        operation: 'tts:synthesis:complete',
        provider: 'elevenlabs',
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

  /**
   * Synthétise en WAV (conversion depuis MP3 si nécessaire)
   * Note: ElevenLabs retourne du MP3, pas besoin de conversion WAV
   */
  async synthesizeToWav(text: string, options: TTSOptions = {}): Promise<TTSResult> {
    // ElevenLabs retourne déjà du MP3 haute qualité
    // Pas de conversion nécessaire pour les navigateurs modernes
    return this.synthesize(text, options);
  }
}

// Singleton
let _textToSpeechService: TextToSpeechService | null = null;

export function getTextToSpeechService(): TextToSpeechService {
  _textToSpeechService ??= new TextToSpeechService();
  return _textToSpeechService;
}

// Export pour compatibilité
export const textToSpeechService = new TextToSpeechService();
