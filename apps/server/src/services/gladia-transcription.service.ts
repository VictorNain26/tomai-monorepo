/**
 * Gladia Transcription Service - TomAI
 *
 * Service de transcription audio utilisant Gladia (entreprise française)
 * API Speech-to-Text haute précision avec support de 100+ langues
 *
 * Migration Gemini → Gladia (Janvier 2025)
 * - Transcription pure : Gladia
 * - Analyse de prononciation : reste sur Gemini (inference AI)
 *
 * @see https://docs.gladia.io/chapters/speech-to-text-api/pages/automatic-speech-recognition
 */

import { logger } from '../lib/observability.js';
import { appConfig } from '../config/app.config.js';

// ============================================
// Types
// ============================================

export interface GladiaTranscriptionResult {
  success: boolean;
  transcription?: string;
  detectedLanguage?: string;
  confidence?: number;
  duration?: number;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
  error?: string;
}

export interface GladiaTranscriptionOptions {
  /** Langue cible (code ISO 2 lettres: fr, en, es, de) */
  language?: string;
  /** Activer la détection automatique de langue */
  detectLanguage?: boolean;
}

interface GladiaUploadResponse {
  audio_url: string;
  audio_metadata?: {
    duration: number;
    sample_rate: number;
    channels: number;
  };
}

interface GladiaTranscriptionResponse {
  id: string;
  status: 'queued' | 'processing' | 'done' | 'error';
  result?: {
    transcription?: {
      full_transcript?: string;
      languages?: string[];
      utterances?: Array<{
        text: string;
        start: number;
        end: number;
        confidence: number;
        words?: Array<{
          word: string;
          start: number;
          end: number;
          confidence: number;
        }>;
      }>;
    };
    metadata?: {
      audio_duration: number;
    };
  };
  error?: {
    message: string;
    code: string;
  };
}

// ============================================
// Service
// ============================================

export class GladiaTranscriptionService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.gladia.io/v2';

  constructor() {
    const apiKey = appConfig.ai.gladia?.apiKey;
    if (!apiKey) {
      throw new Error('GLADIA_API_KEY is required for audio transcription');
    }
    this.apiKey = apiKey;
  }

  /**
   * Transcrit un fichier audio via Gladia
   *
   * Flow:
   * 1. Upload du fichier audio
   * 2. Lancement de la transcription
   * 3. Polling jusqu'à completion
   */
  async transcribe(
    audioBuffer: ArrayBuffer,
    mimeType: string,
    options: GladiaTranscriptionOptions = {}
  ): Promise<GladiaTranscriptionResult> {
    const startTime = Date.now();
    const { language, detectLanguage = true } = options;

    try {
      // Step 1: Upload audio file
      logger.info('Gladia: Uploading audio file', {
        operation: 'gladia:upload',
        mimeType,
        size: audioBuffer.byteLength,
      });

      const uploadResponse = await this.uploadAudio(audioBuffer, mimeType);

      // Step 2: Start transcription
      logger.info('Gladia: Starting transcription', {
        operation: 'gladia:transcribe',
        audioUrl: uploadResponse.audio_url,
      });

      const transcriptionId = await this.startTranscription(uploadResponse.audio_url, {
        language,
        detectLanguage,
      });

      // Step 3: Poll for results
      const result = await this.pollForResults(transcriptionId);

      const durationMs = Date.now() - startTime;

      if (result.status === 'error' || !result.result?.transcription) {
        logger.error('Gladia transcription failed', {
          operation: 'gladia:transcribe',
          _error: result.error?.message ?? 'No transcription result',
          durationMs,
          severity: 'high' as const,
        });

        return {
          success: false,
          error: result.error?.message ?? 'Transcription failed',
        };
      }

      const transcription = result.result.transcription;
      const fullText = transcription.full_transcript ?? '';
      const detectedLang = transcription.languages?.[0] ?? language ?? 'unknown';

      // Extraire les mots avec timestamps (toujours activé pour analyse prononciation)
      const words: GladiaTranscriptionResult['words'] = transcription.utterances
        ? transcription.utterances.flatMap(
            (u) =>
              u.words?.map((w) => ({
                word: w.word,
                start: w.start,
                end: w.end,
                confidence: w.confidence,
              })) ?? []
          )
        : undefined;

      // Calculer la confiance moyenne
      const avgConfidence =
        transcription.utterances && transcription.utterances.length > 0
          ? transcription.utterances.reduce((sum, u) => sum + u.confidence, 0) /
            transcription.utterances.length
          : undefined;

      logger.info('Gladia transcription completed', {
        operation: 'gladia:transcribe',
        durationMs,
        transcriptionLength: fullText.length,
        detectedLanguage: detectedLang,
        confidence: avgConfidence,
      });

      return {
        success: true,
        transcription: fullText,
        detectedLanguage: detectedLang,
        confidence: avgConfidence,
        duration: result.result.metadata?.audio_duration,
        words,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      logger.error('Gladia transcription error', {
        operation: 'gladia:transcribe',
        _error: error instanceof Error ? error.message : String(error),
        durationMs,
        severity: 'high' as const,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown transcription error',
      };
    }
  }

  /**
   * Upload un fichier audio vers Gladia
   */
  private async uploadAudio(audioBuffer: ArrayBuffer, mimeType: string): Promise<GladiaUploadResponse> {
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: mimeType });

    // Déterminer l'extension depuis le mimeType
    const extensions: Record<string, string> = {
      'audio/webm': 'webm',
      'audio/mp3': 'mp3',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/x-wav': 'wav',
      'audio/ogg': 'ogg',
      'audio/m4a': 'm4a',
      'audio/mp4': 'm4a',
    };
    const ext = extensions[mimeType] ?? 'webm';

    formData.append('audio', blob, `audio.${ext}`);

    const response = await fetch(`${this.baseUrl}/upload`, {
      method: 'POST',
      headers: {
        'x-gladia-key': this.apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gladia upload failed: ${response.status} - ${errorText}`);
    }

    return (await response.json()) as GladiaUploadResponse;
  }

  /**
   * Lance la transcription d'un fichier audio uploadé
   */
  private async startTranscription(
    audioUrl: string,
    options: GladiaTranscriptionOptions
  ): Promise<string> {
    const { language, detectLanguage } = options;

    const body: Record<string, unknown> = {
      audio_url: audioUrl,
      // Toujours activer les timestamps par mot pour l'analyse de prononciation
      enable_word_timestamps: true,
    };

    // Configuration de la langue
    if (language && !detectLanguage) {
      body.language = language;
    } else {
      body.detect_language = true;
    }

    const response = await fetch(`${this.baseUrl}/pre-recorded`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-gladia-key': this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gladia transcription start failed: ${response.status} - ${errorText}`);
    }

    const result = (await response.json()) as { id: string };
    return result.id;
  }

  /**
   * Polling pour récupérer les résultats
   */
  private async pollForResults(transcriptionId: string): Promise<GladiaTranscriptionResponse> {
    const maxAttempts = 60; // 60 attempts * 2s = 2 minutes max
    const pollInterval = 2000; // 2 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(`${this.baseUrl}/pre-recorded/${transcriptionId}`, {
        method: 'GET',
        headers: {
          'x-gladia-key': this.apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gladia poll failed: ${response.status} - ${errorText}`);
      }

      const result = (await response.json()) as GladiaTranscriptionResponse;

      if (result.status === 'done' || result.status === 'error') {
        return result;
      }

      // Attendre avant le prochain poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error('Gladia transcription timeout after 2 minutes');
  }
}

// Singleton (lazy initialization)
let _gladiaService: GladiaTranscriptionService | null = null;

export function getGladiaTranscriptionService(): GladiaTranscriptionService {
  _gladiaService ??= new GladiaTranscriptionService();
  return _gladiaService;
}

/**
 * Check if Gladia is configured
 */
export function isGladiaConfigured(): boolean {
  return !!appConfig.ai.gladia?.apiKey;
}
