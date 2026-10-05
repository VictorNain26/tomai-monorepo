/**
 * Service de Transcription Audio - TomAI
 *
 * STT via Voxtral (voxtral-mini-2602) — stack 100 % Mistral souveraine.
 * Voxtral ne fournit pas de timecodes par mot ni de score de confiance ;
 * l'analyse de prononciation sera portée par un modèle phonétique dédié.
 */

import { logger } from '../../platform/observability/logger.js';
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
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();

    if (!isVoxtralTranscribeConfigured()) {
      return {
        success: false,
        _error: 'Service de transcription non configuré (MISTRAL_API_KEY manquant)',
      };
    }

    try {
      const sttService = getVoxtralTranscribeService();
      const sttResult = await sttService.transcribe(audioBuffer, mimeType);

      if (!sttResult.success || !sttResult.transcription) {
        logger.error('Voxtral STT transcription failed', {
          operation: 'audio:transcription',
          reason: sttResult.error ?? 'No transcription result',
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
        ...(sttResult.detectedLanguage && { detectedLanguage: sttResult.detectedLanguage }),
      };

      logger.info('Audio transcription completed (Voxtral STT)', {
        operation: 'audio:transcription',
        provider: 'voxtral',
        durationMs: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      logger.error('Audio transcription error', {
        operation: 'audio:transcription',
        err: error,
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
