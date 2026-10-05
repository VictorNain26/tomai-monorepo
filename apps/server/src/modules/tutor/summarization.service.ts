/**
 * Summarization Service — Résumé conversationnel incrémental
 *
 * - Résume les anciens messages pour garder le contexte pédagogique
 * - Incrémental : l'ancien résumé et les seuls messages qu'il ne couvre pas, jamais toute la
 *   conversation
 * - Asynchrone (fire-and-forget) pour ne pas bloquer le streaming
 *
 * Tâche templatée, modèle de chat par défaut.
 * Prompt cache actif (system prompt stable invariant inter-sessions).
 */

import { generateText } from '../../platform/ai/mistral-client.js';
import { studySessionsRepository } from './study-sessions.repository.js';
import { messagesRepository } from './messages.repository.js';
import { logger } from '../../platform/observability/logger.js';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Nombre de messages récents gardés verbatim (5 échanges), jamais résumés. */
const RECENT_WINDOW_SIZE = 10;

/** Messages résumés d'un coup : le premier résumé à 20 messages, puis tous les 10 au-delà de la fenêtre. */
const BATCH_SIZE = 10;

/** At most this many messages wait outside the summary when a batch is due; the chat's history window holds them. */
export const SUMMARY_BACKLOG = RECENT_WINDOW_SIZE + BATCH_SIZE;

/** Longueur max du résumé généré (en caractères) */
const MAX_SUMMARY_LENGTH = 6000;

// ═══════════════════════════════════════════════════════════════════════════
// PROMPT
// ═══════════════════════════════════════════════════════════════════════════

const SUMMARIZATION_PROMPT = `Tu es un assistant spécialisé dans le résumé de conversations pédagogiques de tutorat.

Tu reçois, s'il existe, le résumé précédent de la séance, puis les nouveaux échanges. Produis un
résumé unique, à jour et autonome, compréhensible sans autre contexte : intègre les nouveaux
échanges au résumé précédent, déplace vers les acquis une difficulté que l'élève a surmontée,
garde ce qui reste pertinent.

## SECTIONS OBLIGATOIRES

1. **Matière/Chapitre** : Sujet étudié et chapitre spécifique
2. **Acquis** : Ce que l'élève a compris et maîtrise
3. **Difficultés** : Confusions, blocages, incompréhensions identifiés
4. **Erreurs de raisonnement** : Erreurs spécifiques commises par l'élève
5. **Outils utilisés** : Flashcards créées, programmes consultés
6. **Méthode socratique** : Questions qui ont été efficaces vs bloquantes
7. **Prochaine étape** : Ce qu'il faudrait aborder ensuite

## RÈGLES
- Concis : 1500 mots au plus
- Sois factuel, pas de commentaire sur la qualité du tutorat
- Conserve les termes techniques exacts utilisés par l'élève
- Note les numéros d'exercices ou pages de manuels mentionnés
- Si une section est vide, écris "Aucun" (ne pas omettre la section)`;

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════

const SUMMARIZATION_PROMPT_VERSION = '2026-10-05.2';

// Prompt cache : bumper la version pour invalider après modif prompts.
const SUMMARIZATION_CACHE_KEY = `summarization-${SUMMARIZATION_PROMPT_VERSION}`;

class SummarizationService {

  /**
   * Résume ce que le résumé précédent ne couvre pas encore, hors de la fenêtre récente, dès
   * qu'un lot entier s'y trouve. Appelé en fire-and-forget après chaque réponse ; ne throw
   * jamais — tout est catché et loggé.
   */
  async summarizeIfNeeded(sessionId: string): Promise<void> {
    try {
      const session = await studySessionsRepository.findById(sessionId);
      if (!session) return;
      const cutoff = session.conversationSummary ? session.summaryUpToMessageId : null;

      // Counted in the database: the session's messages load only once a batch is due.
      const pending = await messagesRepository.countAfter(sessionId, cutoff);
      if (pending < SUMMARY_BACKLOG) return;

      const messagesToSummarize = (await messagesRepository.findAfter(sessionId, cutoff)).slice(0, -RECENT_WINDOW_SIZE);
      const lastSummarizedMessage = messagesToSummarize.at(-1);
      if (!lastSummarizedMessage) return;

      const messagesText = messagesToSummarize.map(m => `[${m.role}]: ${m.content}`).join('\n\n');
      const summary = await this.generateSummary(messagesText, session.conversationSummary);
      if (!summary) return;

      // Two runs started by turns close together: the one that read an older cutoff writes nothing.
      const stored = await studySessionsRepository.replaceSummary(sessionId, session.summaryUpToMessageId, { conversationSummary: summary, summaryUpToMessageId: lastSummarizedMessage.id });
      if (!stored) return;

      logger.info('Conversation summarized', {
        sessionId,
        summarizedMessages: messagesToSummarize.length,
        summarizedUpTo: lastSummarizedMessage.id,
        summaryLength: summary.length,
        isIncremental: Boolean(session.conversationSummary),
        operation: 'summarization:complete',
      });
    } catch (err) {
      logger.error('Summarization failed', {
        err: err,
        sessionId,
        operation: 'summarization:error',
        severity: 'medium' as const,
      });
    }
  }

  /**
   * Le résumé précédent et les seuls nouveaux échanges. Ordre messages = system prompt
   * (stable, caché) → contenu variable.
   */
  private async generateSummary(
    messagesText: string,
    previousSummary?: string | null
  ): Promise<string | null> {
    const userContent = previousSummary
      ? `## RÉSUMÉ PRÉCÉDENT\n${previousSummary}\n\n## NOUVEAUX ÉCHANGES\n${messagesText}`
      : `## NOUVEAUX ÉCHANGES\n${messagesText}`;

    const text = await generateText({
      functionId: 'summarization',
      messages: [
        { role: 'system', content: SUMMARIZATION_PROMPT },
        { role: 'user', content: userContent },
      ],
      temperature: 0.3,
      maxTokens: 2048,
      promptCacheKey: SUMMARIZATION_CACHE_KEY,
      timeoutMs: 45_000,
    });

    const trimmed = text.trim();
    if (!trimmed) return null;

    // Tronquer si trop long (garde-fou côté client, le modèle respecte max_tokens)
    return trimmed.length > MAX_SUMMARY_LENGTH ? trimmed.slice(0, MAX_SUMMARY_LENGTH) : trimmed;
  }
}

export const summarizationService = new SummarizationService();
