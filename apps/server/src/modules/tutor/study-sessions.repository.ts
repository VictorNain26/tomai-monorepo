/**
 * Study Sessions Repository - Clean implementation
 * Pattern Drizzle ORM officiel : omettre les champs avec defaults du schema
 */

import { and, eq, desc, count, sql } from 'drizzle-orm';
import { getTableColumns } from 'drizzle-orm';
import { db } from '../../db/connection';
import { studySessions, messages, type StudySession } from './session.schema.js';
import type { SubjectFamily } from '../../lib/subjects.js';

/**
 * Input type pour création session
 * SEULEMENT les champs REQUIS sans default dans schema
 */
export interface CreateStudySessionInput {
  userId: string;
  subject: SubjectFamily;
  topic?: string; // Optionnel mais pas de default
}

/**
 * Input type pour mise à jour session
 */
interface UpdateStudySessionInput {
  topic?: string;
  status?: 'draft' | 'active' | 'paused' | 'completed' | 'abandoned' | 'timeout' | 'error';
  endedAt?: Date;
}

class StudySessionsRepository {
  /**
   * Create new study session
   * Pattern officiel Drizzle : omettre les champs avec defaults
   */
  async create(input: CreateStudySessionInput): Promise<StudySession> {
    // Drizzle applique automatiquement les defaults du schema
    // pour les champs omis (id, status, startedAt, createdAt, updatedAt, etc.)
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

  async findByUserIdWithStats(userId: string, limit: number): Promise<(StudySession & { messageCount: number })[]> {
    return await db
      .select({
        ...getTableColumns(studySessions),
        messageCount: count(messages.id),
      })
      .from(studySessions)
      .leftJoin(messages, eq(messages.sessionId, studySessions.id))
      .where(eq(studySessions.userId, userId))
      .groupBy(studySessions.id)
      .orderBy(desc(studySessions.startedAt))
      .limit(limit);
  }

  /**
   * Find sessions for conversation list with last message preview.
   * Returns sessions ordered by most recent activity.
   * Uses correlated subqueries (no JOIN/GROUP BY) for reliability.
   */
  async findByUserIdWithLastMessage(
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<(StudySession & {
    messageCount: number;
    lastMessageContent: string | null;
    lastMessageRole: string | null;
    lastMessageAt: Date | null;
  })[]> {
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

  /** The summary replaced only if it still ends where the caller read it: whether it was. */
  async replaceSummary(id: string, readCutoff: string | null, summary: { conversationSummary: string; summaryUpToMessageId: string }): Promise<boolean> {
    const rows = await db
      .update(studySessions)
      .set({ ...summary, updatedAt: sql`NOW()` })
      .where(and(eq(studySessions.id, id), sql`${studySessions.summaryUpToMessageId} is not distinct from ${readCutoff}`))
      .returning({ id: studySessions.id });
    return rows.length > 0;
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

  async updateSubject(id: string, subject: SubjectFamily): Promise<StudySession | undefined> {
    const [session] = await db
      .update(studySessions)
      .set({ subject, updatedAt: sql`NOW()` })
      .where(eq(studySessions.id, id))
      .returning();

    return session;
  }

  async getSessionStats(userId: string): Promise<{
    totalSessions: number;
    subjectBreakdown: Record<string, number>;
    lastSessionDate: Date | null;
    studyDays: number;
  }> {
    // Aggregated in SQL, the totals and the per-subject counts at once.
    const [[aggregate], perSubject] = await Promise.all([
      db
        .select({
          totalSessions: sql<number>`COUNT(*)::int`,
          lastSessionDate: sql<Date | null>`MAX(${studySessions.startedAt})`.mapWith(studySessions.startedAt),
          studyDays: sql<number>`COUNT(DISTINCT DATE(${studySessions.startedAt}))::int`,
        })
        .from(studySessions)
        .where(eq(studySessions.userId, userId)),
      db
        .select({
          subject: studySessions.subject,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(studySessions)
        .where(eq(studySessions.userId, userId))
        .groupBy(studySessions.subject),
    ]);

    const subjectBreakdown = perSubject.reduce<Record<string, number>>((acc, row) => {
      acc[row.subject] = row.count;
      return acc;
    }, {});

    return {
      totalSessions: aggregate?.totalSessions ?? 0,
      subjectBreakdown,
      lastSessionDate: aggregate?.lastSessionDate ?? null,
      studyDays: aggregate?.studyDays ?? 0,
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
