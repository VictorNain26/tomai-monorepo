/**
 * Study Sessions Repository - Clean implementation
 * Pattern Drizzle ORM officiel : omettre les champs avec defaults du schema
 */

import { eq, desc, count, sql } from 'drizzle-orm';
import { getTableColumns } from 'drizzle-orm';
import { db } from '../connection';
import { studySessions, messages, type StudySession } from '../schema';

/**
 * Input type pour création session
 * SEULEMENT les champs REQUIS sans default dans schema
 */
export interface CreateStudySessionInput {
  userId: string;
  subject: string;
  topic?: string; // Optionnel mais pas de default
}

/**
 * Input type pour mise à jour session
 */
interface UpdateStudySessionInput {
  topic?: string;
  status?: 'draft' | 'active' | 'paused' | 'completed' | 'abandoned' | 'timeout' | 'error';
  endedAt?: Date;
  durationMinutes?: number;
  frustrationAvg?: string;
  frustrationMin?: string;
  frustrationMax?: string;
  questionLevelsAvg?: string;
  conceptsCovered?: string[];
  socraticEffectiveness?: string;
  studentEngagement?: string;
  questionsAsked?: number;
  questionsAnswered?: number;
  hintsGiven?: number;
  aiModelUsed?: string;
  totalTokensUsed?: number;
  apiCostCents?: number;
  averageResponseTimeMs?: number;
  deviceType?: string;
  userSatisfaction?: number;
  sessionRating?: number;
  sessionMetadata?: Record<string, unknown>;
  conversationSummary?: string;
  summaryUpToMessageId?: string;
}

class StudySessionsRepository {
  /**
   * Create new study session
   * Pattern officiel Drizzle : omettre les champs avec defaults
   */
  async create(input: CreateStudySessionInput): Promise<StudySession> {
    // Drizzle applique automatiquement les defaults du schema
    // pour les champs omis (id, status, startedAt, aiModelUsed, createdAt, updatedAt, etc.)
    const [session] = await db
      .insert(studySessions)
      .values({
        userId: input.userId,
        subject: input.subject,
        ...(input.topic && { topic: input.topic })
      })
      .returning();

    if (!session) {
      throw new Error('Failed to create study session');
    }

    return session;
  }

  async findById(id: string): Promise<StudySession | undefined> {
    const [session] = await db
      .select()
      .from(studySessions)
      .where(eq(studySessions.id, id))
      .limit(1);

    return session;
  }

  async findByUserId(userId: string, limit = 20): Promise<StudySession[]> {
    return await db
      .select()
      .from(studySessions)
      .where(eq(studySessions.userId, userId))
      .orderBy(desc(studySessions.startedAt))
      .limit(limit);
  }

  /**
   * Find the most recent active session for a user (any subject)
   * Pattern: Session unique par élève (chat multi-matière)
   */
  async findActiveByUser(userId: string): Promise<StudySession | undefined> {
    const [session] = await db
      .select()
      .from(studySessions)
      .where(
        sql`${studySessions.userId} = ${userId}
            AND ${studySessions.status} = 'active'`
      )
      .orderBy(desc(studySessions.startedAt))
      .limit(1);

    return session;
  }

  async findByUserIdWithStats(userId: string): Promise<Array<StudySession & { messageCount: number }>> {
    return await db
      .select({
        ...getTableColumns(studySessions),
        messageCount: count(messages.id),
      })
      .from(studySessions)
      .leftJoin(messages, eq(messages.sessionId, studySessions.id))
      .where(eq(studySessions.userId, userId))
      .groupBy(studySessions.id)
      .orderBy(desc(studySessions.startedAt));
  }

  /**
   * Find sessions for conversation list with last message preview.
   * Returns sessions ordered by most recent activity.
   * Uses correlated subqueries (no JOIN/GROUP BY) for reliability.
   */
  async findByUserIdWithLastMessage(
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<Array<StudySession & {
    messageCount: number;
    lastMessageContent: string | null;
    lastMessageRole: string | null;
    lastMessageAt: Date | null;
  }>> {
    const { limit = 20, offset = 0 } = options;

    return await db
      .select({
        ...getTableColumns(studySessions),
        messageCount: sql<number>`(
          SELECT count(*)::int FROM messages WHERE session_id = ${studySessions.id}
        )`,
        lastMessageContent: sql<string | null>`(
          SELECT content FROM messages WHERE session_id = ${studySessions.id}
          ORDER BY created_at DESC LIMIT 1
        )`,
        lastMessageRole: sql<string | null>`(
          SELECT role FROM messages WHERE session_id = ${studySessions.id}
          ORDER BY created_at DESC LIMIT 1
        )`,
        lastMessageAt: sql<Date | null>`(
          SELECT created_at FROM messages WHERE session_id = ${studySessions.id}
          ORDER BY created_at DESC LIMIT 1
        )`,
      })
      .from(studySessions)
      .where(eq(studySessions.userId, userId))
      .orderBy(sql`COALESCE((
        SELECT created_at FROM messages WHERE session_id = ${studySessions.id}
        ORDER BY created_at DESC LIMIT 1
      ), ${studySessions.startedAt}) DESC`)
      .limit(limit)
      .offset(offset);
  }

  async update(id: string, input: UpdateStudySessionInput): Promise<StudySession | undefined> {
    const [session] = await db
      .update(studySessions)
      .set({
        ...input,
        updatedAt: sql`NOW()` // Best practice Drizzle ORM: DB-level timestamp
      })
      .where(eq(studySessions.id, id))
      .returning();

    return session;
  }

  async getSessionStats(userId: string): Promise<{
    totalSessions: number;
    totalMinutes: number;
    averageFrustration: number;
    subjectBreakdown: Record<string, number>;
  }> {
    // Aggregated in SQL: single scan of study_sessions filtered by userId.
    // Previous implementation loaded up to 1000 full rows to compute sums/averages in JS.
    const [aggregate] = await db
      .select({
        totalSessions: sql<number>`COUNT(*)::int`,
        totalMinutes: sql<number>`COALESCE(SUM(${studySessions.durationMinutes}), 0)::int`,
        averageFrustration: sql<number>`COALESCE(AVG(${studySessions.frustrationAvg}), 0)::float`,
      })
      .from(studySessions)
      .where(eq(studySessions.userId, userId));

    const perSubject = await db
      .select({
        subject: studySessions.subject,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(studySessions)
      .where(eq(studySessions.userId, userId))
      .groupBy(studySessions.subject);

    const subjectBreakdown = perSubject.reduce((acc, row) => {
      acc[row.subject] = row.count;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalSessions: aggregate?.totalSessions ?? 0,
      totalMinutes: aggregate?.totalMinutes ?? 0,
      averageFrustration: Math.round((aggregate?.averageFrustration ?? 0) * 10) / 10,
      subjectBreakdown,
    };
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await db
      .delete(studySessions)
      .where(eq(studySessions.id, id))
      .returning();

    return result.length > 0;
  }
}

export const studySessionsRepository = new StudySessionsRepository();
