/**
 * Service de Transcription Audio - TomAI
 *
 * STT via Voxtral (voxtral-mini-latest) — stack 100 % Mistral souveraine.
 * Voxtral ne fournit pas de timecodes par mot ni de score de confiance ;
 * l'analyse de prononciation sera portée par un modèle phonétique dédié.
 */

import { logger } from '../lib/observability.js';
import type { EducationLevelType } from '../types/education.types.js';
import {
  getVoxtralTranscribeService,
  isVoxtralTranscribeConfigured,
} from './voxtral-transcribe.service.js';

// ============================================
// Types
// ============================================

interface TranscriptionResult {
  success: boolean;
  transcription?: string;
  detectedLanguage?: string;
  _error?: string;
}

interface TranscriptionOptions {
  /** Langue cible pour la transcription */
  targetLanguage?: 'fr' | 'en' | 'es' | 'de';
  /** Niveau scolaire (réservé pour usage futur) */
  schoolLevel?: EducationLevelType;
}

// ============================================
// Service
// ============================================

class AudioTranscriptionService {
  constructor() {
    if (!isVoxtralTranscribeConfigured()) {
      logger.warn('MISTRAL_API_KEY not configured - audio transcription will fail', {
        operation: 'audio:init',
      });
    }
  }

  /**
   * Transcrit un fichier audio via Voxtral STT (Mistral).
   */
  async transcribeAudio(
    audioBuffer: ArrayBuffer,
    mimeType: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();

    const { targetLanguage = 'fr' } = options;

    if (!isVoxtralTranscribeConfigured()) {
      return {
        success: false,
        _error: 'Service de transcription non configuré (MISTRAL_API_KEY manquant)',
      };
    }

    try {
      const sttService = getVoxtralTranscribeService();
      const sttResult = await sttService.transcribe(audioBuffer, mimeType, {
        language: targetLanguage,
      });

      if (!sttResult.success || !sttResult.transcription) {
        logger.error('Voxtral STT transcription failed', {
          operation: 'audio:transcription',
          _error: sttResult.error ?? 'No transcription result',
          severity: 'high' as const,
        });

        return {
          success: false,
          _error: sttResult.error ?? 'Échec de la transcription',
        };
      }

      const result: TranscriptionResult = {
        success: true,
        transcription: sttResult.transcription,
        detectedLanguage: sttResult.detectedLanguage ?? targetLanguage,
      };

      logger.info('Audio transcription completed (Voxtral STT)', {
        operation: 'audio:transcription',
        provider: 'voxtral',
        targetLanguage,
        durationMs: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      logger.error('Audio transcription error', {
        operation: 'audio:transcription',
        _error: error instanceof Error ? error.message : String(error),
        severity: 'high' as const,
      });

      return {
        success: false,
        _error: 'Échec de la transcription audio',
      };
    }
  }
}

// Singleton export
export const audioTranscriptionService = new AudioTranscriptionService();
