/**
 * Routes Text-to-Speech (TTS) - TomAI
 * Synthèse vocale avec ElevenLabs (Migration Janvier 2025)
 *
 * Cas d'usage éducatif :
 * - Lecture des réponses de l'IA à voix haute
 * - Prononciation correcte pour les matières de langue
 * - Accessibilité pour les élèves dyslexiques
 */

import { Elysia } from 'elysia';
import { handleAuthWithCookies } from '../middleware/auth.middleware.js';
import { textToSpeechService, type TTSOptions } from '../services/text-to-speech.service.js';
import { logger } from '../lib/observability.js';
import type { EducationLevelType } from '../types/education.types.js';

// ============================================
// Types
// ============================================

interface TTSSynthesizeBody {
  text: string;
  language?: 'fr' | 'en' | 'es' | 'de';
  schoolLevel?: EducationLevelType;
}

// ============================================
// Routes
// ============================================

export const ttsRoutes = new Elysia({ name: 'tts-routes' })
  .group('/api/tts', (app) => app

    // POST /api/tts/synthesize - Synthétiser texte en audio
    .post('/synthesize', async ({ body, request: { headers }, set }) => {
      const authContext = await handleAuthWithCookies(headers, set);
      if (!authContext.success) {
        return authContext.error;
      }

      const startTime = Date.now();

      try {
        const {
          text,
          language = 'fr',
          schoolLevel,
        } = body as TTSSynthesizeBody;

        // Validation du texte
        if (!text || typeof text !== 'string') {
          set.status = 400;
          return {
            success: false,
            error: 'Le texte est requis'
          };
        }

        if (text.trim().length === 0) {
          set.status = 400;
          return {
            success: false,
            error: 'Le texte ne peut pas être vide'
          };
        }

        // ElevenLabs limite à ~5000 caractères
        if (text.length > 5000) {
          set.status = 400;
          return {
            success: false,
            error: 'Le texte est trop long (max 5000 caractères)'
          };
        }

        // Options TTS (voix auto-sélectionnée par niveau scolaire)
        const ttsOptions: TTSOptions = {
          language,
          schoolLevel,
        };

        // Synthèse audio via ElevenLabs
        const result = await textToSpeechService.synthesize(text, ttsOptions);

        if (!result.success) {
          logger.error('TTS synthesis failed', {
            operation: 'tts:route:synthesize',
            userId: authContext.user.id,
            _error: result._error ?? 'Unknown TTS error',
            severity: 'medium' as const
          });

          set.status = 500;
          return {
            success: false,
            error: result._error ?? 'Échec de la synthèse vocale'
          };
        }

        logger.info('TTS synthesis completed', {
          operation: 'tts:route:synthesize:success',
          userId: authContext.user.id,
          textLength: text.length,
          durationMs: Date.now() - startTime,
          audioDurationMs: result.durationMs,
          severity: 'low' as const
        });

        return {
          success: true,
          audio: {
            data: result.audioData,
            mimeType: result.mimeType,
            durationMs: result.durationMs
          },
          meta: {
            textLength: text.length,
            processingMs: Date.now() - startTime
          }
        };

      } catch (error) {
        logger.error('TTS route error', {
          operation: 'tts:route:synthesize:error',
          userId: authContext.user.id,
          _error: error instanceof Error ? error.message : String(error),
          severity: 'high' as const
        });

        set.status = 500;
        return {
          success: false,
          error: 'Erreur interne lors de la synthèse vocale'
        };
      }
    })

    // GET /api/tts/voices - Liste des voix disponibles (ElevenLabs)
    .get('/voices', async ({ request: { headers }, set }) => {
      const authContext = await handleAuthWithCookies(headers, set);
      if (!authContext.success) {
        return authContext.error;
      }

      // Voix ElevenLabs françaises mappées par niveau scolaire
      // La voix est auto-sélectionnée selon le schoolLevel de l'utilisateur
      return {
        success: true,
        provider: 'elevenlabs',
        autoSelect: true, // La voix est choisie automatiquement selon le niveau
        voices: [
          { id: 'charlotte', name: 'Charlotte', description: 'Voix féminine douce', levels: ['cp', 'ce1', 'ce2'] },
          { id: 'sophie', name: 'Sophie', description: 'Voix féminine professionnelle', levels: ['cm1', 'cm2'] },
          { id: 'camille', name: 'Camille', description: 'Voix neutre et claire', levels: ['sixieme', 'cinquieme'] },
          { id: 'thomas', name: 'Thomas', description: 'Voix masculine claire', levels: ['quatrieme', 'troisieme'] },
          { id: 'antoine', name: 'Antoine', description: 'Voix masculine mature', levels: ['seconde', 'premiere', 'terminale'] },
        ],
        languages: ['fr', 'en', 'es', 'de'],
        limits: {
          maxTextLength: 5000
        }
      };
    })
  );
