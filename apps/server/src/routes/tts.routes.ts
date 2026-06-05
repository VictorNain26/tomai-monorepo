/**
 * Routes Text-to-Speech (TTS) - TomAI
 * Synthèse vocale via Voxtral (Mistral, souveraineté EU).
 *
 * Cas d'usage éducatif :
 * - Lecture des réponses de l'IA à voix haute
 * - Prononciation correcte pour les matières de langue
 * - Accessibilité pour les élèves dyslexiques
 */

import { Elysia, t } from 'elysia';
import { authMacro } from '../lib/auth-macro.js';
import { textToSpeechService, type TTSOptions } from '../services/text-to-speech.service.js';
import { logger } from '../lib/observability.js';
import type { EducationLevelType } from '../types/education.types.js';

// ============================================
// Routes
// ============================================

export const ttsRoutes = new Elysia({ name: 'tts-routes' })
  .use(authMacro)
  .guard({ auth: true })
  .group('/api/tts', (app) => app

    // POST /api/tts/synthesize - Synthétiser texte en audio
    .post('/synthesize', async ({ body, user, status }) => {
      const startTime = Date.now();

      try {
        const { text, language = 'fr', schoolLevel } = body;

        // Options TTS (voix auto-sélectionnée par niveau scolaire)
        const ttsOptions: TTSOptions = {
          language,
          schoolLevel: schoolLevel as EducationLevelType | undefined,
        };

        const result = await textToSpeechService.synthesize(text, ttsOptions);

        if (!result.success) {
          logger.error('TTS synthesis failed', {
            operation: 'tts:route:synthesize',
            userId: user.id,
            _error: result._error ?? 'Unknown TTS error',
            severity: 'medium' as const
          });

          return status(500, {
            success: false,
            error: result._error ?? 'Échec de la synthèse vocale',
          });
        }

        logger.info('TTS synthesis completed', {
          operation: 'tts:route:synthesize:success',
          userId: user.id,
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
          userId: user.id,
          _error: error instanceof Error ? error.message : String(error),
          severity: 'high' as const
        });

        return status(500, {
          success: false,
          error: 'Erreur interne lors de la synthèse vocale',
        });
      }
    }, {
      body: t.Object({
        text: t.String({ minLength: 1, maxLength: 5000 }),
        language: t.Optional(t.Union([
          t.Literal('fr'), t.Literal('en'), t.Literal('es'), t.Literal('de'),
        ])),
        schoolLevel: t.Optional(t.String({ minLength: 2, maxLength: 20 })),
      }),
    })

    // GET /api/tts/voices - Métadonnées Voxtral (MVP : voix par défaut unique)
    .get('/voices', async () => {
      // MVP : voix par défaut Voxtral. Voice cloning + mapping par niveau
      // scolaire viendront dans une itération suivante (POST /v1/audio/voices
      // côté Mistral, samples 3s par profil).
      return {
        success: true,
        provider: 'voxtral',
        autoSelect: false,
        voices: [],
        languages: ['fr', 'en', 'es', 'de'],
        limits: {
          maxTextLength: 5000,
        },
      };
    })
  );
