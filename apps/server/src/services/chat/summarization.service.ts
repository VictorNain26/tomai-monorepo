/**
 * Summarization Service — Résumé conversationnel incrémental
 *
 * Pattern SummaryBuffer (Best Practice 2026):
 * - Résume les anciens messages pour garder le contexte pédagogique
 * - Incrémental: fusionne l'ancien résumé avec les nouveaux échanges
 * - Asynchrone (fire-and-forget) pour ne pas bloquer le streaming
 * - Gemini Flash non-streaming, temperature 0.3 pour cohérence
 */

import { GoogleGenAI } from '@google/genai';
import { appConfig } from '../../config/app.config.js';
import { studySessionsRepository } from '../../db/repositories/study-sessions.repository.js';
import { messagesRepository } from '../../db/repositories/messages.repository.js';
import { logger } from '../../lib/observability.js';

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

class SummarizationService {
  private readonly ai: GoogleGenAI;
  private readonly model: string;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: appConfig.ai.gemini.apiKey ?? '' });
    this.model = appConfig.ai.gemini.model;
  }

  /**
   * Vérifie si un résumé est nécessaire et le génère si oui.
   * Appelé en fire-and-forget après chaque réponse assistant.
   * Retry automatique (max 2 tentatives) en cas d'échec.
   * Ne throw jamais — tout est catché et loggé.
   */
  async summarizeIfNeeded(sessionId: string): Promise<void> {
    try {
      const session = await studySessionsRepository.findById(sessionId);
      if (!session) return;

      const allMessages = await messagesRepository.findBySessionId(sessionId);
      const totalMessages = allMessages.length;

      // Pas assez de messages pour résumer
      if (totalMessages < SUMMARIZE_THRESHOLD) return;

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
   * Génère un résumé via Gemini Flash (non-streaming, temp 0.3).
   * Si un résumé précédent existe, fait un résumé incrémental.
   */
  private async generateSummary(
    messagesText: string,
    previousSummary?: string | null
  ): Promise<string | null> {
    let prompt: string;

    if (previousSummary) {
      prompt = INCREMENTAL_PROMPT
        .replace('{previousSummary}', previousSummary)
        .replace('{newMessages}', messagesText);
    } else {
      prompt = `${SUMMARIZATION_PROMPT}\n\n## CONVERSATION\n${messagesText}`;
    }

    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    });

    const text = response.text?.trim();
    if (!text) return null;

    // Tronquer si trop long
    if (text.length > MAX_SUMMARY_LENGTH) {
      return text.slice(0, MAX_SUMMARY_LENGTH);
    }

    return text;
  }
}

export const summarizationService = new SummarizationService();
