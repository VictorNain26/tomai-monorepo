/**
 * Routes Text-to-Speech (TTS) - TomAI
 * Synthèse vocale via Voxtral (Mistral, souveraineté EU).
 *
 * Cas d'usage éducatif :
 * - Lecture des réponses de l'IA à voix haute
 * - Prononciation correcte pour les matières de langue
 * - Accessibilité pour les élèves dyslexiques
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { requireUser, validate, type AppEnv } from '../../platform/http/context.js';
import { textToSpeechService, type TTSOptions } from './text-to-speech.service.js';
import { logger } from '../../platform/observability/logger.js';
import type { EducationLevelType } from '../../types/education.types.js';

// ============================================
// Routes
// ============================================

const synthesizeBody = z.object({
  text: z.string().min(1).max(5000),
  language: z.enum(['fr', 'en', 'es', 'de']).optional(),
  schoolLevel: z.string().min(2).max(20).optional(),
});

// Mounted under /api/tts by app.ts.
export const voiceRoutes = new Hono<AppEnv>()

    // POST /api/tts/synthesize - Synthétiser texte en audio
    .post('/synthesize', requireUser, validate('json', synthesizeBody), async (c) => {
      const user = c.var.user;
      const body = c.req.valid('json');
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
            reason: result._error ?? 'Unknown TTS error',
            severity: 'medium' as const
          });

          return c.json({
            success: false,
            error: result._error ?? 'Échec de la synthèse vocale',
          }, 500);
        }

        logger.info('TTS synthesis completed', {
          operation: 'tts:route:synthesize:success',
          userId: user.id,
          textLength: text.length,
          durationMs: Date.now() - startTime,
          severity: 'low' as const
        });

        return c.json({
          success: true,
          audio: {
            data: result.audioData,
            mimeType: result.mimeType
          },
          meta: {
            textLength: text.length,
            processingMs: Date.now() - startTime
          }
        });

      } catch (error) {
        logger.error('TTS route error', {
          operation: 'tts:route:synthesize:error',
          userId: user.id,
          err: error,
          severity: 'high' as const
        });

        return c.json({
          success: false,
          error: 'Erreur interne lors de la synthèse vocale',
        }, 500);
      }
    })

    // GET /api/tts/voices - Métadonnées Voxtral (MVP : voix par défaut unique)
    .get('/voices', requireUser, (c) => {
      // MVP : voix par défaut Voxtral. Voice cloning + mapping par niveau
      // scolaire viendront dans une itération suivante (POST /v1/audio/voices
      // côté Mistral, samples 3s par profil).
      return c.json({
        success: true,
        provider: 'voxtral',
        autoSelect: false,
        voices: [],
        languages: ['fr', 'en', 'es', 'de'],
        limits: {
          maxTextLength: 5000,
        },
      });
    });
