/**
 * Auto-Title Service — Generate conversation titles after first exchange
 *
 * Called fire-and-forget after the first assistant response.
 * Uses Gemini Flash to generate a short, descriptive title.
 */

import { GoogleGenAI } from '@google/genai';
import { appConfig } from '../../config/app.config.js';
import { studySessionsRepository } from '../../db/repositories/study-sessions.repository.js';
import { logger } from '../../lib/observability.js';

const TITLE_PROMPT = `Génère un titre COURT (max 50 caractères) pour cette conversation de tutorat scolaire.

RÈGLES:
- Max 50 caractères
- Pas de guillemets
- Décris le SUJET principal (ex: "Équations du 2nd degré", "Conjugaison imparfait", "Guerre de 14-18")
- Si c'est un devoir, mentionne-le (ex: "Devoir maths - Pythagore")
- Langue: français

MESSAGE DE L'ÉLÈVE:
{userMessage}

RÉPONSE DU TUTEUR (début):
{assistantPreview}

TITRE:`;

class AutoTitleService {
  private readonly ai: GoogleGenAI;
  private readonly model: string;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: appConfig.ai.gemini.apiKey ?? '' });
    this.model = appConfig.ai.gemini.model;
  }

  /**
   * Generate and store a title for a session after first exchange.
   * Fire-and-forget: never throws, logs errors.
   */
  async generateTitleIfNeeded(
    sessionId: string,
    userMessage: string,
    assistantResponse: string,
  ): Promise<void> {
    try {
      const session = await studySessionsRepository.findById(sessionId);
      if (!session) return;

      // Skip if session already has a title
      if (session.topic) return;

      const assistantPreview = assistantResponse.slice(0, 300);

      const prompt = TITLE_PROMPT
        .replace('{userMessage}', userMessage.slice(0, 500))
        .replace('{assistantPreview}', assistantPreview);

      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature: 0.3,
          maxOutputTokens: 64,
        },
      });

      let title = response.text?.trim();
      if (!title) return;

      // Clean up: remove quotes, truncate
      title = title.replace(/^["'«]|["'»]$/g, '').trim();
      if (title.length > 50) {
        title = title.slice(0, 47) + '...';
      }

      await studySessionsRepository.update(sessionId, { topic: title });

      logger.info('Auto-title generated', {
        sessionId,
        title,
        operation: 'auto-title:complete',
      });
    } catch (err) {
      logger.warn('Auto-title generation failed', {
        _error: err instanceof Error ? err.message : String(err),
        sessionId,
        operation: 'auto-title:error',
      });
    }
  }
}

export const autoTitleService = new AutoTitleService();
