/**
 * Summarization Service — Résumé conversationnel incrémental
 *
 * Pattern SummaryBuffer (Best Practice 2026) :
 * - Résume les anciens messages pour garder le contexte pédagogique
 * - Incrémental : fusionne l'ancien résumé avec les nouveaux échanges
 * - Asynchrone (fire-and-forget) pour ne pas bloquer le streaming
 *
 * Modèle : `mistral-small-latest`. Tâche templatée, qualité
 * suffisante, ~3× moins cher que medium. Escalade vers medium si qualité
 * insuffisante mesurée en prod.
 * Prompt cache actif (system prompt stable invariant inter-sessions).
 */

import { generateText } from '../../lib/ai/mistral-client.js';
import { studySessionsRepository } from '../../db/repositories/study-sessions.repository.js';
import { messagesRepository } from '../../db/repositories/messages.repository.js';
import { logger } from '../../lib/observability.js';
import { env } from '../../config/env.js';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Premier résumé après 20 messages (10 échanges user+assistant) */
const SUMMARIZE_THRESHOLD = 20;

/** Nombre de messages récents gardés verbatim (5 échanges) */
const RECENT_WINDOW_SIZE = 10;

/** Re-résumer après 10 nouveaux messages depuis le dernier résumé */
const INCREMENTAL_THRESHOLD = 10;

/** Longueur max du résumé généré (en caractères) */
const MAX_SUMMARY_LENGTH = 6000;

// ═══════════════════════════════════════════════════════════════════════════
// PROMPTS
// ═══════════════════════════════════════════════════════════════════════════

const SUMMARIZATION_PROMPT = `Tu es un assistant spécialisé dans le résumé de conversations pédagogiques de tutorat.

Résume la conversation ci-dessous en extrayant OBLIGATOIREMENT les 7 sections suivantes.
Le résumé doit être concis (max 1500 mots) et structuré en sections.

## SECTIONS OBLIGATOIRES

1. **Matière/Chapitre** : Sujet étudié et chapitre spécifique
2. **Acquis** : Ce que l'élève a compris et maîtrise
3. **Difficultés** : Confusions, blocages, incompréhensions identifiés
4. **Erreurs de raisonnement** : Erreurs spécifiques commises par l'élève
5. **Outils utilisés** : Flashcards créées, recherches Pronote, programmes consultés
6. **Méthode socratique** : Questions qui ont été efficaces vs bloquantes
7. **Prochaine étape** : Ce qu'il faudrait aborder ensuite

## RÈGLES
- Sois factuel, pas de commentaire sur la qualité du tutorat
- Conserve les termes techniques exacts utilisés par l'élève
- Note les numéros d'exercices ou pages de manuels mentionnés
- Si une section est vide, écris "Aucun" (ne pas omettre la section)`;

const INCREMENTAL_PROMPT = `Tu es un assistant spécialisé dans le résumé de conversations pédagogiques de tutorat.

Un résumé précédent existe déjà. Tu dois le FUSIONNER avec les nouveaux échanges pour produire un résumé UNIFIÉ et à jour.

## RÉSUMÉ PRÉCÉDENT
{previousSummary}

## NOUVEAUX ÉCHANGES
{newMessages}

## INSTRUCTIONS
- Fusionne le résumé précédent avec les nouveaux échanges
- Mets à jour chaque section en intégrant les nouvelles informations
- Si l'élève a progressé sur une difficulté, déplace-la vers les acquis
- Conserve les informations encore pertinentes du résumé précédent
- Le résumé final doit être autonome (compréhensible sans contexte)
- Max 1500 mots

## SECTIONS OBLIGATOIRES
1. **Matière/Chapitre**
2. **Acquis**
3. **Difficultés**
4. **Erreurs de raisonnement**
5. **Outils utilisés**
6. **Méthode socratique**
7. **Prochaine étape**`;

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════

const SUMMARIZATION_PROMPT_VERSION = '2026-05-18';

// Prompt cache : bumper la version pour invalider après modif prompts.
const SUMMARIZATION_CACHE_KEY = `summarization-${SUMMARIZATION_PROMPT_VERSION}`;

class SummarizationService {

  /**
   * Vérifie si un résumé est nécessaire et le génère si oui.
   * Appelé en fire-and-forget après chaque réponse assistant.
   * Retry automatique (max 2 tentatives) en cas d'échec.
   * Ne throw jamais — tout est catché et loggé.
   */
  async summarizeIfNeeded(sessionId: string): Promise<void> {
    try {
      // Cheap count first: avoid loading all message bodies when nothing to summarize.
      const totalMessages = await messagesRepository.countBySessionId(sessionId);
      if (totalMessages < SUMMARIZE_THRESHOLD) return;

      const session = await studySessionsRepository.findById(sessionId);
      if (!session) return;

      const allMessages = await messagesRepository.findBySessionId(sessionId);

      // Vérifier si un résumé incrémental est nécessaire
      if (session.conversationSummary && session.summaryUpToMessageId) {
        const cutoffIndex = allMessages.findIndex(m => m.id === session.summaryUpToMessageId);
        if (cutoffIndex === -1) return;

        const newMessagesSinceSummary = totalMessages - cutoffIndex - 1;
        if (newMessagesSinceSummary < INCREMENTAL_THRESHOLD) return;
      }

      // Déterminer les messages à résumer (tous sauf la fenêtre récente)
      const messagesToSummarize = allMessages.slice(0, -RECENT_WINDOW_SIZE);
      if (messagesToSummarize.length === 0) return;

      const lastSummarizedMessage = messagesToSummarize[messagesToSummarize.length - 1];
      if (!lastSummarizedMessage) return;

      const messagesText = messagesToSummarize.map(m => `[${m.role}]: ${m.content}`).join('\n\n');

      // Retry logic: max 2 attempts with 2s backoff
      const summary = await this.generateSummaryWithRetry(
        messagesText,
        session.conversationSummary,
        sessionId,
      );

      if (!summary) return;

      // Stocker le résumé
      await studySessionsRepository.update(sessionId, {
        conversationSummary: summary,
        summaryUpToMessageId: lastSummarizedMessage.id,
      });

      logger.info('Conversation summarized', {
        sessionId,
        totalMessages,
        summarizedUpTo: lastSummarizedMessage.id,
        summaryLength: summary.length,
        isIncremental: Boolean(session.conversationSummary),
        operation: 'summarization:complete',
      });
    } catch (err) {
      logger.error('Summarization failed after all retries', {
        _error: err instanceof Error ? err.message : String(err),
        sessionId,
        operation: 'summarization:error',
        severity: 'medium' as const,
      });
    }
  }

  /**
   * Génère un résumé avec retry automatique.
   * Max 2 tentatives, backoff 2s entre chaque.
   */
  private async generateSummaryWithRetry(
    messagesText: string,
    previousSummary: string | null | undefined,
    sessionId: string,
  ): Promise<string | null> {
    const MAX_RETRIES = 2;
    const RETRY_DELAY_MS = 2000;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.generateSummary(messagesText, previousSummary);
      } catch (err) {
        logger.warn(`Summarization attempt ${attempt}/${MAX_RETRIES} failed`, {
          _error: err instanceof Error ? err.message : String(err),
          sessionId,
          attempt,
          operation: 'summarization:retry',
        });

        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }
    }

    return null;
  }

  /**
   * Génère un résumé via Mistral Small (non-streaming, temp 0.3).
   * Si un résumé précédent existe, fait un résumé incrémental.
   *
   * Ordre messages = system prompt (stable, caché) → contenu variable.
   * Maximise cache hit prompt_cache_key.
   */
  private async generateSummary(
    messagesText: string,
    previousSummary?: string | null
  ): Promise<string | null> {
    const systemPrompt = previousSummary ? INCREMENTAL_PROMPT : SUMMARIZATION_PROMPT;
    const userContent = previousSummary
      ? `## RÉSUMÉ PRÉCÉDENT\n${previousSummary}\n\n## NOUVEAUX ÉCHANGES\n${messagesText}`
      : `## CONVERSATION\n${messagesText}`;

    const text = await generateText({
      model: env.MISTRAL_MODEL_LIGHT,
      messages: [
        { role: 'system', content: systemPrompt },
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
