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
 * - retrieveRelevant(userId, queryText, limit=3) — returns the top-k cosine
 *   neighbours. Called by chat-orchestration when opening a NEW session.
 *
 * Schema failure mode: if the session_episodes table doesn't exist (pre-
 * migration deployment), insertion logs at severity=critical so monitoring
 * catches the misdeploy. Retrieval returns [] so the chat loop keeps working
 * — but the critical log makes the operational problem visible.
 */

import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { sessionEpisodes, studySessions, messages } from '../db/schema.js';
import { getMistralClient } from '../lib/mistral-client.js';
import { mistralEmbeddingsService } from './mistral-embeddings.service.js';
import { appConfig } from '../config/app.config.js';
import { logger } from '../lib/observability.js';
import { withTimeout } from '../lib/retry.js';

export const EPISODIC_EXTRACTION_PROMPT_VERSION = '2026-05-06';

interface ExtractedEpisode {
  summary: string;
  conceptsCovered: string[];
  outcome: 'completed' | 'abandoned' | 'succeeded';
}

const EPISODE_TTL_DAYS = 90;

function buildExtractionPrompt(subject: string, messagesText: string): string {
  return `Tu extrais un résumé pédagogique structuré à partir d'une conversation élève-tuteur.

Produis un JSON avec les champs :
- "summary" : résumé narratif (200-400 mots) qui capte le sujet précis, les points travaillés, la démarche pédagogique utilisée, le niveau atteint par l'élève à la fin.
- "conceptsCovered" : liste de 2-6 concepts clés travaillés (ex: "théorème de Pythagore", "passé composé 2e groupe").
- "outcome" : "completed" si la session a atteint un point d'arrivée pédagogique, "succeeded" si l'élève a démontré la compétence, "abandoned" si la session s'est arrêtée avant résolution.

Matière : ${subject}

CONVERSATION :
${messagesText}

Réponds UNIQUEMENT en JSON strict.`;
}

// Mistral validates JSON via responseFormat: 'json_schema' (strict mode) so
// the response is guaranteed to match the schema. Defense-in-depth: we still
// validate field types in the parse below, but malformed-JSON retries are
// eliminated.
const EPISODE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'conceptsCovered', 'outcome'],
  properties: {
    summary: {
      type: 'string',
      description: 'Narrative pedagogical summary (200-400 words).',
    },
    conceptsCovered: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      maxItems: 8,
      description: 'Key concepts worked on during the session (2-6 expected).',
    },
    outcome: {
      type: 'string',
      enum: ['completed', 'abandoned', 'succeeded'],
      description: 'How the session ended pedagogically.',
    },
  },
} as const;

class EpisodicMemoryService {
  /**
   * Extract an episode from a completed session and persist it. Called as
   * fire-and-forget by session reset/archive paths.
   */
  async extractAndStore(sessionId: string, userId: string): Promise<void> {
    const startTime = Date.now();

    try {
      // Load session + its messages. If the session has <4 messages, skip —
      // too little signal to produce a useful summary.
      const session = await db.query.studySessions.findFirst({
        where: eq(studySessions.id, sessionId),
      });
      if (!session || session.userId !== userId) {
        logger.warn('Episodic extraction skipped — session not found or not owned', {
          operation: 'episodic:extract:not-found',
          sessionId,
          userId,
        });
        return;
      }

      const sessionMessages = await db.query.messages.findMany({
        where: eq(messages.sessionId, sessionId),
        orderBy: [messages.createdAt],
      });

      if (sessionMessages.length < 4) {
        logger.debug('Episodic extraction skipped — too few messages', {
          operation: 'episodic:extract:skip-small',
          sessionId,
          messageCount: sessionMessages.length,
        });
        return;
      }

      const messagesText = sessionMessages
        .map(m => `[${m.role}]: ${m.content.slice(0, 800)}`)
        .join('\n\n')
        .slice(0, 20_000);

      const prompt = buildExtractionPrompt(session.subject, messagesText);

      const response = await withTimeout(
        getMistralClient().chat.complete({
          model: appConfig.ai.mistral?.auxModel ?? 'mistral-small-latest',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          maxTokens: 1200,
          // Pure extractive summarization — no reasoning required.
          reasoningEffort: 'none',
          responseFormat: {
            type: 'json_schema',
            jsonSchema: {
              name: 'session_episode_extraction',
              description: 'Structured pedagogical summary of a tutoring session.',
              strict: true,
              schemaDefinition: EPISODE_JSON_SCHEMA,
            },
          },
        }),
        30_000,
        'mistral:episodic-extract',
      );

      const raw = response.choices?.[0]?.message?.content;
      const text = typeof raw === 'string' ? raw.trim() : '';
      if (!text) {
        throw new Error('Empty extraction response');
      }

      const parsed = JSON.parse(text) as ExtractedEpisode;
      if (!parsed.summary || !Array.isArray(parsed.conceptsCovered)) {
        throw new Error('Malformed extraction JSON');
      }

      const embedding = await mistralEmbeddingsService.embed(parsed.summary);

      const durationSeconds = session.endedAt
        ? Math.floor((session.endedAt.getTime() - session.startedAt.getTime()) / 1000)
        : null;

      const ttlUntil = new Date();
      ttlUntil.setDate(ttlUntil.getDate() + EPISODE_TTL_DAYS);

      await db.insert(sessionEpisodes).values({
        userId,
        sessionId,
        subject: session.subject,
        summaryText: parsed.summary,
        summaryEmbedding: embedding,
        conceptsCovered: parsed.conceptsCovered,
        messageCount: sessionMessages.length,
        durationSeconds,
        outcome: parsed.outcome,
        ttlUntil,
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
        _error: errorMessage,
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
   * message). Returns an empty array on error or when none exist.
   */
  async retrieveRelevant(userId: string, queryText: string, limit = 3): Promise<Array<{
    sessionId: string;
    subject: string;
    summaryText: string;
    conceptsCovered: string[];
    createdAt: Date;
    similarity: number;
  }>> {
    const trimmed = queryText.trim();
    if (trimmed.length < 10) return [];

    try {
      const queryEmbedding = await mistralEmbeddingsService.embed(trimmed);
      const vectorLiteral = `[${queryEmbedding.join(',')}]`;

      // Cosine similarity via pgvector's <=> operator (distance, 0 = identical).
      // We compute similarity = 1 - distance for readability and filter to
      // meaningfully similar episodes only.
      const similarityExpr: SQL<number> = sql<number>`1 - (${sessionEpisodes.summaryEmbedding} <=> ${vectorLiteral}::vector)`;

      const rows = await db
        .select({
          sessionId: sessionEpisodes.sessionId,
          subject: sessionEpisodes.subject,
          summaryText: sessionEpisodes.summaryText,
          conceptsCovered: sessionEpisodes.conceptsCovered,
          createdAt: sessionEpisodes.createdAt,
          similarity: similarityExpr,
        })
        .from(sessionEpisodes)
        .where(and(
          eq(sessionEpisodes.userId, userId),
          sql`${sessionEpisodes.ttlUntil} IS NULL OR ${sessionEpisodes.ttlUntil} > NOW()`,
        ))
        .orderBy(desc(similarityExpr))
        .limit(limit);

      // Only return results with meaningful similarity (>0.6 on normalized
      // embeddings) — the HNSW index returns the top-k by raw distance even
      // when none are relevant, so we threshold here.
      return rows
        .filter(r => r.similarity > 0.6)
        .map(r => ({
          sessionId: r.sessionId,
          subject: r.subject,
          summaryText: r.summaryText,
          conceptsCovered: Array.isArray(r.conceptsCovered) ? (r.conceptsCovered as string[]) : [],
          createdAt: r.createdAt,
          similarity: Number(r.similarity),
        }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const severity = errorMessage.includes('relation') && errorMessage.includes('does not exist')
        ? ('critical' as const)
        : ('medium' as const);
      logger.error('Episodic retrieval failed', {
        operation: 'episodic:retrieve:error',
        _error: errorMessage,
        userId,
        severity,
      });
      return [];
    }
  }

  /** Build a compact context block for the system prompt. */
  formatEpisodesForPrompt(episodes: Awaited<ReturnType<EpisodicMemoryService['retrieveRelevant']>>): string | null {
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
