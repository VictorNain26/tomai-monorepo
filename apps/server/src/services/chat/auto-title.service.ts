/**
 * Auto-Title Service — Génère un titre court après le premier échange.
 *
 * Fire-and-forget : appelé après la première réponse assistant.
 * Mistral Small 4 (auxModel), température basse, max 64 tokens.
 */

import type { Mistral } from '@mistralai/mistralai';
import { appConfig } from '../../config/app.config.js';
import { studySessionsRepository } from '../../db/repositories/study-sessions.repository.js';
import { logger } from '../../lib/observability.js';
import { withTimeout } from '../../lib/retry.js';
import { getMistralClient } from '../../lib/mistral-client.js';

export const AUTO_TITLE_PROMPT_VERSION = '2026-05-06';

const TITLE_PROMPT = `Génère un titre COURT (10-50 caractères) pour cette conversation de tutorat scolaire.

RÈGLES:
- Entre 10 et 50 caractères obligatoirement
- Pas de guillemets ni ponctuation finale
- Titre COMPLET, jamais tronqué (ex: "Aide" seul est interdit)
- Décris le SUJET principal (ex: "Équations du 2nd degré", "Conjugaison imparfait", "Guerre de 14-18")
- Si c'est un devoir, mentionne-le (ex: "Devoir maths - Pythagore")
- Si le sujet est vague, utilise la matière (ex: "Révision cours de maths")
- Langue: français

MESSAGE DE L'ÉLÈVE:
{userMessage}

RÉPONSE DU TUTEUR (début):
{assistantPreview}

Réponds UNIQUEMENT avec le titre, rien d'autre.`;

class AutoTitleService {
  private readonly client: Mistral;
  private readonly model: string;

  constructor() {
    this.client = getMistralClient();
    this.model = appConfig.ai.mistral?.auxModel ?? 'mistral-small-latest';
  }

  /**
   * Generate and store a title for a session after the first exchange.
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
      if (session.topic) return;

      const assistantPreview = assistantResponse.slice(0, 300);

      const prompt = TITLE_PROMPT
        .replace('{userMessage}', userMessage.slice(0, 500))
        .replace('{assistantPreview}', assistantPreview);

      const response = await withTimeout(
        this.client.chat.complete({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          maxTokens: 64,
          // 64-token title generation — no thinking chunk needed.
          reasoningEffort: 'none',
        }),
        20_000,
        'mistral:auto-title',
      );

      const raw = response.choices?.[0]?.message?.content;
      const text = typeof raw === 'string' ? raw.trim() : '';
      if (text.length === 0) return;

      let title = text.replace(/^["'«]|["'»]$/g, '').trim();
      if (title.length > 50) {
        title = `${title.slice(0, 47)}...`;
      }

      if (title.length < 8) {
        logger.warn('Auto-title too short, skipping', {
          sessionId,
          title,
          operation: 'auto-title:rejected',
        });
        return;
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
