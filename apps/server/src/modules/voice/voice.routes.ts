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
import { educationLevelSchema } from '../../lib/education-levels.js';
import { AppError } from '../../platform/http/errors.js';
import { checkQuota } from '../billing/index.js';

// ============================================
// Routes
// ============================================

const synthesizeBody = z.object({
  text: z.string().min(1).max(5000),
  // Only the French voice exists (fr_marie_*): no other language is accepted or advertised.
  language: z.literal('fr').optional(),
  schoolLevel: educationLevelSchema.optional(),
});

/** The users whose reading is in progress, on this instance. */
const readingNow = new Set<string>();

// Mounted under /api/tts by app.ts.
export const voiceRoutes = new Hono<AppEnv>()

    // POST /api/tts/synthesize - Synthétiser texte en audio
    .post('/synthesize', requireUser, validate('json', synthesizeBody), async (c) => {
      const user = c.var.user;
      const { text, language = 'fr', schoolLevel } = c.req.valid('json');
      const startTime = Date.now();
      // Speech is the first cost (`etudes/2026-10-01/couts.md`): it draws on the same daily budget,
      // its cost known before the call. One reading at a time, or parallel ones would all pass the
      // check before any is recorded.
      if (readingNow.has(user.id)) throw new AppError('CONCURRENT_STREAM');
      readingNow.add(user.id);

      try {
        if (!(await checkQuota(user.id, textToSpeechService.costMicroEur(text))).allowed) throw new AppError('QUOTA_EXCEEDED');

        const ttsOptions: TTSOptions = { language, schoolLevel };
        const result = await textToSpeechService.synthesize(text, { userId: user.id }, ttsOptions);

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
        if (error instanceof AppError) throw error;
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
      } finally {
        readingNow.delete(user.id);
      }
    });
