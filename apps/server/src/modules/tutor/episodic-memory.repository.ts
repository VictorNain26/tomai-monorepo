import { and, desc, eq, gte, isNull, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { db } from '../../db/connection';
import { sessionEpisodes, type NewSessionEpisode } from './session.schema.js';

interface EpisodeRow {
  sessionId: string;
  subject: string;
  summaryText: string;
  conceptsCovered: unknown;
  createdAt: Date;
  similarity: number;
}

class EpisodicMemoryRepository {
  async insertEpisode(data: NewSessionEpisode): Promise<void> {
    await db.insert(sessionEpisodes).values(data);
  }

  async findRelevantEpisodes(
    userId: string,
    queryEmbeddingVector: string,
    limit: number,
  ): Promise<EpisodeRow[]> {
    const similarityExpr: SQL<number> = sql<number>`1 - (${sessionEpisodes.summaryEmbedding} <=> ${queryEmbeddingVector}::vector)`.mapWith(Number);

    return db
      .select({
        sessionId: sessionEpisodes.sessionId,
        subject: sessionEpisodes.subject,
        summaryText: sessionEpisodes.summaryText,
        conceptsCovered: sessionEpisodes.conceptsCovered,
        createdAt: sessionEpisodes.createdAt,
        similarity: similarityExpr,
      })
      .from(sessionEpisodes)
      .where(
        and(
          eq(sessionEpisodes.userId, userId),
          // The app clock, as the TTL and the purge (`lt(ttlUntil, now)`) use: an episode is
          // either read or purged, never both nor neither.
          or(isNull(sessionEpisodes.ttlUntil), gte(sessionEpisodes.ttlUntil, new Date())),
        ),
      )
      // An exact scan of the student's own episodes, a few per month: an approximate vector
      // index would pick the nearest episodes of all students, then filter the student out.
      .orderBy(desc(similarityExpr))
      .limit(limit);
  }
}

export const episodicMemoryRepository = new EpisodicMemoryRepository();
