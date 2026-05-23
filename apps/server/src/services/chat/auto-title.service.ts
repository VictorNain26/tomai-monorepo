/**
 * Auto-Title Service — Generate conversation titles after first exchange.
 *
 * Called fire-and-forget après la première réponse assistant.
 *
 * Modèle : `ministral-3-3b` (cf ADR-0001). Output ~15 tokens, latence min,
 * coût ≈ $0.0000015/req. Bien suffisant pour un titre de 50 chars.
 * Prompt cache actif pour le préfixe d'instruction stable.
 */

import { generateText } from '../../lib/ai/mistral-client.js';
import { studySessionsRepository } from '../../db/repositories/study-sessions.repository.js';
import { logger } from '../../lib/observability.js';

export const AUTO_TITLE_PROMPT_VERSION = '2026-05-18';

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

// Clé stable pour prompt cache Mistral (-90 % sur cached tokens). À bumper
// quand le TITLE_PROMPT change pour forcer un nouveau cache.
const TITLE_PROMPT_CACHE_KEY = `auto-title-${AUTO_TITLE_PROMPT_VERSION}`;

class AutoTitleService {
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
      if (session.topic) return; // Skip si déjà titré

      const assistantPreview = assistantResponse.slice(0, 300);
      const prompt = TITLE_PROMPT
        .replace('{userMessage}', userMessage.slice(0, 500))
        .replace('{assistantPreview}', assistantPreview);

      const raw = await generateText({
        model: 'ministral-3b-latest',  // ADR-0001 : tâche triviale, modèle minimal
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 64,
        promptCacheKey: TITLE_PROMPT_CACHE_KEY,
        timeoutMs: 20_000,
      });

      let title = raw.trim();
      if (!title) return;

      // Cleanup : retirer guillemets éventuels, tronquer
      title = title.replace(/^["'«]|["'»]$/g, '').trim();
      if (title.length > 50) {
        title = title.slice(0, 47) + '...';
      }

      // Rejeter titres trop courts (génération incomplète)
      if (title.length < 8) {
        logger.warn('Auto-title too short, skipping', {
          sessionId, title, operation: 'auto-title:rejected',
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
