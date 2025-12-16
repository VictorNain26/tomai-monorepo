/**
 * ElevenLabs Text-to-Speech Service - TomAI
 *
 * Service TTS utilisant ElevenLabs (entreprise UK, GDPR compliant)
 * API REST avec voix multilingues haute qualité
 *
 * Migration Gemini → ElevenLabs (Janvier 2025)
 * - TTS production : ElevenLabs (70+ langues, voix naturelles)
 * - Fallback : Gemini TTS si ElevenLabs non configuré
 *
 * @see https://elevenlabs.io/docs/api-reference/text-to-speech
 */

import { logger } from '../lib/observability.js';
import { appConfig } from '../config/app.config.js';
import type { EducationLevelType } from '../types/education.types.js';

// ============================================
// Types
// ============================================

export interface ElevenLabsTTSResult {
  success: boolean;
  audioData?: string; // Base64 encoded audio
  mimeType?: string; // audio/mpeg (MP3)
  durationMs?: number;
  error?: string;
}

export interface ElevenLabsTTSOptions {
  /** Voice ID to use */
  voiceId?: string;
  /** Language for voice selection */
  language?: 'fr' | 'en' | 'es' | 'de';
  /** School level to adapt voice */
  schoolLevel?: EducationLevelType;
  /** Output format */
  outputFormat?: 'mp3_44100_128' | 'mp3_22050_32' | 'pcm_16000' | 'pcm_24000';
}

// Voix ElevenLabs par défaut pour le français
// Ces IDs sont des voix populaires de la Voice Library
const FRENCH_VOICES = {
  // Voix féminines
  charlotte: 'XB0fDUnXU5powFXDhCwa', // Charlotte - voix féminine douce
  sophie: 'jBpfuIE2acCO8z3wKNLl', // Sophie - professionnelle
  // Voix masculines
  thomas: 'GBv7mTt0atIp3Br8iCZE', // Thomas - voix masculine claire
  antoine: 'IKne3meq5aSn9XLyUdCD', // Antoine - voix masculine mature
  // Voix neutre
  camille: 'EXAVITQu4vr4xnSDxMaL', // Camille - voix neutre/claire
};

// Mapping voix par niveau scolaire (similaire à Gemini)
const VOICE_BY_LEVEL: Record<string, string> = {
  // Primaire - voix douce et chaleureuse
  cp: FRENCH_VOICES.charlotte,
  ce1: FRENCH_VOICES.charlotte,
  ce2: FRENCH_VOICES.charlotte,
  cm1: FRENCH_VOICES.sophie,
  cm2: FRENCH_VOICES.sophie,
  // Collège - voix claire et professionnelle
  sixieme: FRENCH_VOICES.camille,
  cinquieme: FRENCH_VOICES.camille,
  quatrieme: FRENCH_VOICES.thomas,
  troisieme: FRENCH_VOICES.thomas,
  // Lycée - voix mature
  seconde: FRENCH_VOICES.antoine,
  premiere: FRENCH_VOICES.antoine,
  terminale: FRENCH_VOICES.antoine,
};

// Modèles disponibles
const MODELS = {
  multilingual_v2: 'eleven_multilingual_v2', // Meilleure qualité, 32 langues
  flash_v2_5: 'eleven_flash_v2_5', // Plus rapide, ~75ms latence
  turbo_v2_5: 'eleven_turbo_v2_5', // Ultra rapide
};

// ============================================
// Service
// ============================================

export class ElevenLabsTTSService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.elevenlabs.io/v1';

  constructor() {
    const apiKey = appConfig.ai.elevenlabs?.apiKey;
    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY is required for TTS');
    }
    this.apiKey = apiKey;
  }

  /**
   * Synthétise du texte en audio via ElevenLabs
   */
  async synthesize(
    text: string,
    options: ElevenLabsTTSOptions = {}
  ): Promise<ElevenLabsTTSResult> {
    const startTime = Date.now();

    const {
      voiceId,
      language = 'fr',
      schoolLevel,
      outputFormat = 'mp3_44100_128',
    } = options;

    try {
      // Validation du texte
      if (!text || text.trim().length === 0) {
        return {
          success: false,
          error: 'Texte vide',
        };
      }

      // ElevenLabs limite à ~5000 caractères par requête
      if (text.length > 5000) {
        return {
          success: false,
          error: 'Texte trop long (max 5000 caractères)',
        };
      }

      // Sélection de la voix
      const selectedVoiceId = voiceId ?? this.selectVoiceForLevel(schoolLevel, language);

      logger.info('ElevenLabs: Starting TTS synthesis', {
        operation: 'elevenlabs:tts:start',
        textLength: text.length,
        voiceId: selectedVoiceId,
        language,
      });

      // Appel API ElevenLabs
      const response = await fetch(
        `${this.baseUrl}/text-to-speech/${selectedVoiceId}?output_format=${outputFormat}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            model_id: MODELS.multilingual_v2, // Meilleure qualité pour l'éducation
            voice_settings: {
              stability: 0.5, // Balance stabilité/expressivité
              similarity_boost: 0.75, // Fidélité à la voix originale
              style: 0.0, // Style exagéré (0 = naturel)
              use_speaker_boost: true, // Améliore la clarté
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('ElevenLabs TTS request failed', {
          operation: 'elevenlabs:tts',
          _error: `${response.status} - ${errorText}`,
          severity: 'high' as const,
        });

        return {
          success: false,
          error: `ElevenLabs API error: ${response.status}`,
        };
      }

      // Récupérer l'audio binaire
      const audioBuffer = await response.arrayBuffer();
      const audioData = Buffer.from(audioBuffer).toString('base64');

      // Estimation de la durée (MP3 128kbps = ~16KB/s)
      const audioBytes = audioBuffer.byteLength;
      const estimatedDurationMs = Math.round((audioBytes / 16000) * 1000);

      const durationMs = Date.now() - startTime;

      logger.info('ElevenLabs TTS synthesis completed', {
        operation: 'elevenlabs:tts:complete',
        textLength: text.length,
        audioBytes,
        estimatedDurationMs,
        durationMs,
      });

      return {
        success: true,
        audioData,
        mimeType: 'audio/mpeg', // MP3
        durationMs: estimatedDurationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      logger.error('ElevenLabs TTS synthesis error', {
        operation: 'elevenlabs:tts',
        _error: error instanceof Error ? error.message : String(error),
        durationMs,
        severity: 'high' as const,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown TTS error',
      };
    }
  }

  /**
   * Sélectionne la voix optimale selon le niveau scolaire
   */
  private selectVoiceForLevel(schoolLevel?: EducationLevelType, language?: string): string {
    // Pour les langues autres que le français, utiliser la voix par défaut
    if (language && language !== 'fr') {
      // Voix multilingue par défaut
      return FRENCH_VOICES.camille;
    }

    if (!schoolLevel) {
      return FRENCH_VOICES.camille; // Voix par défaut - neutre et claire
    }

    return VOICE_BY_LEVEL[schoolLevel] ?? FRENCH_VOICES.camille;
  }

  /**
   * Liste les voix disponibles (utile pour debug/configuration)
   */
  async listVoices(): Promise<{ voiceId: string; name: string; language: string }[]> {
    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
        method: 'GET',
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        logger.warn('Failed to list ElevenLabs voices', {
          operation: 'elevenlabs:list-voices',
          status: response.status,
        });
        return [];
      }

      const data = (await response.json()) as {
        voices: Array<{
          voice_id: string;
          name: string;
          labels?: { language?: string };
        }>;
      };

      return data.voices.map((v) => ({
        voiceId: v.voice_id,
        name: v.name,
        language: v.labels?.language ?? 'unknown',
      }));
    } catch (error) {
      logger.error('Error listing ElevenLabs voices', {
        operation: 'elevenlabs:list-voices',
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      return [];
    }
  }
}

// Singleton (lazy initialization)
let _elevenLabsService: ElevenLabsTTSService | null = null;

export function getElevenLabsTTSService(): ElevenLabsTTSService {
  _elevenLabsService ??= new ElevenLabsTTSService();
  return _elevenLabsService;
}

/**
 * Check if ElevenLabs is configured
 */
export function isElevenLabsConfigured(): boolean {
  return !!appConfig.ai.elevenlabs?.apiKey;
}
