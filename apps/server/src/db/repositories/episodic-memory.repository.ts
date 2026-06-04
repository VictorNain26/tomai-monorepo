import { and, desc, eq, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { db } from '../connection';
import { sessionEpisodes, type NewSessionEpisode } from '../schema';

type EpisodeRow = {
  sessionId: string;
  subject: string;
  summaryText: string;
  conceptsCovered: unknown;
  createdAt: Date;
  similarity: number;
};

export class EpisodicMemoryRepository {
  async insertEpisode(data: NewSessionEpisode): Promise<void> {
    await db.insert(sessionEpisodes).values(data);
  }

  async findRelevantEpisodes(
    userId: string,
    queryEmbeddingVector: string,
    limit: number,
  ): Promise<EpisodeRow[]> {
    const similarityExpr: SQL<number> = sql<number>`1 - (${sessionEpisodes.summaryEmbedding} <=> ${queryEmbeddingVector}::vector)`;

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
          sql`${sessionEpisodes.ttlUntil} IS NULL OR ${sessionEpisodes.ttlUntil} > NOW()`,
        ),
      )
      .orderBy(desc(similarityExpr))
      .limit(limit);
  }
}

export const episodicMemoryRepository = new EpisodicMemoryRepository();
