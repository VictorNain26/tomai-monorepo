/**
 * Episodic Memory Service — long-term session recall via pgvector.
 *
 * Stores a compact summary + its Mistral embedding for each completed
 * session. When a student opens a new session, top-k semantically similar
 * past episodes are injected into the system prompt so the tutor can pick
 * up where it left off ("la dernière fois on a travaillé sur…") without
 * loading the full historical conversation.
 *
 * Triggers:
 * - extractAndStore: fire-and-forget from chat-session.resetSession and
 *   chat-session.deleteSessionCascade (the latter skipped when user-initiated
 *   deletion, respecting GDPR right-to-erasure — callers pass persist=false).
 *
 * Retrieval:
 * - recallForSession — the top-k cosine neighbours of the session's first messages, searched
 *   until one matches, then kept on the session for every turn.
 *
 * Schema failure mode: if the session_episodes table doesn't exist (pre-
 * migration deployment), insertion logs at severity=critical so monitoring
 * catches the misdeploy. Retrieval returns [] so the chat loop keeps working
 * — but the critical log makes the operational problem visible.
 */

import { z } from 'zod';
import { generateStructured } from '../../platform/ai/mistral-client.js';
import { studySessionsRepository } from './study-sessions.repository.js';
import { messagesRepository } from './messages.repository.js';
import { episodicMemoryRepository } from './episodic-memory.repository.js';
import { mistralEmbeddingsService } from './mistral-embeddings.service.js';
import { subjectProfileService } from './subject-profile.service.js';
import { logger } from '../../platform/observability/logger.js';
import { env } from '../../platform/config/env.js';

const EPISODIC_EXTRACTION_PROMPT_VERSION = '2026-10-05.2';

// Prompt cache stable — bump version pour invalider
const EPISODIC_CACHE_KEY = `episodic-extract-${EPISODIC_EXTRACTION_PROMPT_VERSION}`;

const EpisodeSchema = z.object({
  summary: z.string().min(1),
  conceptsCovered: z.array(z.string().min(1)).max(6),
  outcome: z.enum(['completed', 'abandoned', 'succeeded']),
});

const EPISODE_TTL_DAYS = 90;

/** A shorter message (« Bonjour ») says nothing to search the past sessions with. */
const MIN_RECALL_QUERY_CHARS = 10;

/** The first messages of a session searched for its past sessions, until one matches. */
const RECALL_TURNS = 3;

function buildExtractionPrompt(subject: string, sessionText: string): string {
  return `Tu extrais un résumé pédagogique structuré d'une séance élève-tuteur, à partir de son résumé, s'il existe, et des échanges qu'il ne couvre pas encore.

Produis un JSON avec les champs :
- "summary" : résumé narratif (200-400 mots) qui capte le sujet précis, les points travaillés, la démarche pédagogique utilisée, le niveau atteint par l'élève à la fin.
- "conceptsCovered" : liste de 2-6 concepts clés travaillés (ex: "théorème de Pythagore", "passé composé 2e groupe").
- "outcome" : "completed" si la session a atteint un point d'arrivée pédagogique, "succeeded" si l'élève a démontré la compétence, "abandoned" si la session s'est arrêtée avant résolution.

Matière : ${subject}

${sessionText}

Réponds UNIQUEMENT en JSON strict.`;
}

class EpisodicMemoryService {
  /**
   * Extract an episode from a completed session and persist it. Called as
   * fire-and-forget by session reset/archive paths.
   */
  async extractAndStore(sessionId: string, userId: string): Promise<void> {
    const startTime = Date.now();

    try {
      const session = await studySessionsRepository.findById(sessionId);
      if (session?.userId !== userId) {
        logger.warn('Episodic extraction skipped — session not found or not owned', {
          operation: 'episodic:extract:not-found',
          sessionId,
          userId,
        });
        return;
      }

      // The session's summary covers its start: only the messages after it are read again.
      const summary = session.conversationSummary;
      const [tail, messageCount] = await Promise.all([
        messagesRepository.findAfter(sessionId, summary ? session.summaryUpToMessageId : null),
        messagesRepository.countBySessionId(sessionId),
      ]);
      if (!summary && tail.length < 4) {
        logger.debug('Episodic extraction skipped — too few messages', {
          operation: 'episodic:extract:skip-small',
          sessionId,
          messageCount: tail.length,
        });
        return;
      }

      const tailText = tail
        .map(m => `[${m.role}]: ${m.content.slice(0, 800)}`)
        .join('\n\n')
        .slice(0, 20_000);
      const sessionText = [summary ? `RÉSUMÉ DE LA SÉANCE :\n${summary}` : null, `ÉCHANGES :\n${tailText}`]
        .filter(Boolean)
        .join('\n\n');

      const { object: parsed } = await generateStructured({
        functionId: 'episodic-extraction',
        model: env.MISTRAL_MODEL,
        messages: [
          {
            role: 'user',
            content: buildExtractionPrompt(session.subject, sessionText),
          },
        ],
        temperature: 0.2,
        maxTokens: 1200,
        schema: EpisodeSchema,
        schemaName: 'episode_extraction',
        promptCacheKey: EPISODIC_CACHE_KEY,
        timeoutMs: 30_000,
      });

      const embedding = await mistralEmbeddingsService.embed(parsed.summary);

      const durationSeconds = session.endedAt
        ? Math.floor((session.endedAt.getTime() - session.startedAt.getTime()) / 1000)
        : null;

      const ttlUntil = new Date();
      ttlUntil.setDate(ttlUntil.getDate() + EPISODE_TTL_DAYS);

      await episodicMemoryRepository.insertEpisode({
        userId,
        sessionId,
        subject: session.subject,
        summaryText: parsed.summary,
        summaryEmbedding: embedding,
        conceptsCovered: parsed.conceptsCovered,
        messageCount,
        durationSeconds,
        outcome: parsed.outcome,
        ttlUntil,
      });

      // Lot 3 : agréger la sortie de l'épisode dans le profil mémoire matière.
      // Fire-and-forget — aggregateFromEpisode gère ses erreurs en interne (try/catch + warn).
      void subjectProfileService.aggregateFromEpisode({
        userId,
        subject: session.subject,
        conceptsCovered: parsed.conceptsCovered,
        outcome: parsed.outcome,
      });

      logger.info('Session episode stored', {
        operation: 'episodic:extract:stored',
        sessionId,
        userId,
        conceptCount: parsed.conceptsCovered.length,
        summaryLength: parsed.summary.length,
        outcome: parsed.outcome,
        durationMs: Date.now() - startTime,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      // Dedicated severity=critical on relation-missing errors so a missed
      // migration deployment surfaces loudly in monitoring instead of
      // quietly draining episodic memory.
      const severity = errorMessage.includes('relation') && errorMessage.includes('does not exist')
        ? ('critical' as const)
        : ('medium' as const);

      logger.error('Episodic extraction failed', {
        operation: 'episodic:extract:error',
        err: err,
        sessionId,
        userId,
        durationMs: Date.now() - startTime,
        severity,
      });
    }
  }

  /**
   * Retrieve the top-k past episodes for a user that are semantically
   * closest to the current query (new session opener, or first student
   * message). Null when it did not search, the message too short or the search failed (logged);
   * an empty array when nothing matched.
   */
  async retrieveRelevant(userId: string, queryText: string, limit = 3): Promise<{
    sessionId: string;
    subject: string;
    summaryText: string;
    conceptsCovered: string[];
    createdAt: Date;
    similarity: number;
  }[] | null> {
    const trimmed = queryText.trim();
    if (trimmed.length < MIN_RECALL_QUERY_CHARS) return null;

    try {
      const queryEmbedding = await mistralEmbeddingsService.embed(trimmed);
      const vectorLiteral = `[${queryEmbedding.join(',')}]`;

      const rows = await episodicMemoryRepository.findRelevantEpisodes(userId, vectorLiteral, limit);

      // Only keep results with meaningful similarity (>0.6 on normalized
      // embeddings): the query returns the student's top-k even when none
      // is relevant.
      return rows
        .filter(r => r.similarity > 0.6)
        .map(r => ({
          sessionId: r.sessionId,
          subject: r.subject,
          summaryText: r.summaryText,
          conceptsCovered: Array.isArray(r.conceptsCovered) ? (r.conceptsCovered as string[]) : [],
          createdAt: r.createdAt,
          similarity: r.similarity,
        }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const severity = errorMessage.includes('relation') && errorMessage.includes('does not exist')
        ? ('critical' as const)
        : ('medium' as const);
      logger.error('Episodic retrieval failed', {
        operation: 'episodic:retrieve:error',
        err: err,
        userId,
        severity,
      });
      return null;
    }
  }

  /**
   * The past sessions, recalled once per session (`docs/etudes/2026-10-04/refonte-agent.md`) and
   * kept on it, the same block every turn. `stored` is the session's: null before the recall,
   * '' when none matched. A greeting matches nothing: the search goes on over the first
   * messages, and only a match or the last of them settles it. A search that failed, or a
   * failed write, settles nothing: the next turn tries again.
   */
  async recallForSession(params: { sessionId: string; userId: string; content: string; stored: string | null; studentTurnsBefore: number }): Promise<string | null> {
    if (params.stored !== null) return params.stored || null;
    const found = await this.retrieveRelevant(params.userId, params.content, 3);
    if (found === null) return null;
    const block = this.formatEpisodesForPrompt(found);
    if (block === null && params.studentTurnsBefore < RECALL_TURNS - 1) return null;
    await studySessionsRepository.update(params.sessionId, { recalledEpisodes: block ?? '' }).catch((err: unknown) => {
      logger.warn('Recalled episodes not kept on the session', { operation: 'episodic:recall:store-error', err, sessionId: params.sessionId });
    });
    return block;
  }

  /** Build a compact context block for the system prompt. */
  formatEpisodesForPrompt(episodes: NonNullable<Awaited<ReturnType<EpisodicMemoryService['retrieveRelevant']>>>): string | null {
    if (episodes.length === 0) return null;

    const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
    });

    const items = episodes
      .map(e => {
        const concepts = e.conceptsCovered.length > 0
          ? ` (concepts : ${e.conceptsCovered.slice(0, 3).join(', ')})`
          : '';
        return `- ${dateFormatter.format(e.createdAt)} — ${e.subject}${concepts}\n  ${e.summaryText.slice(0, 400)}`;
      })
      .join('\n\n');

    return `<past_sessions>
Sessions passées pertinentes avec cet élève. Tu peux t'y référer ("la dernière fois on avait vu…") pour tisser la continuité, sans jamais recopier mot pour mot.

${items}
</past_sessions>`;
  }
}

export const episodicMemoryService = new EpisodicMemoryService();
