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
export interface UpdateStudySessionInput {
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
  aiModelUsed?: 'gemini_3_flash';
  totalTokensUsed?: number;
  apiCostCents?: number;
  averageResponseTimeMs?: number;
  deviceType?: string;
  userSatisfaction?: number;
  sessionRating?: number;
  sessionMetadata?: Record<string, unknown>;
}

export class StudySessionsRepository {
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

  async endSession(id: string, durationMinutes: number, frustrationAvg?: number): Promise<StudySession | undefined> {
    const [session] = await db
      .update(studySessions)
      .set({
        status: 'completed',
        endedAt: sql`NOW()`, // Best practice Drizzle ORM: DB-level timestamp
        durationMinutes,
        ...(frustrationAvg !== undefined && { frustrationAvg: frustrationAvg.toString() }),
        updatedAt: sql`NOW()`, // Best practice Drizzle ORM: DB-level timestamp
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
    const sessions = await this.findByUserId(userId, 1000);

    const totalSessions = sessions.length;
    const totalMinutes = sessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);
    const avgFrustration = sessions
      .filter(s => s.frustrationAvg)
      .reduce((sum, s, _, arr) => sum + (parseFloat(s.frustrationAvg!) / arr.length), 0);

    const subjectBreakdown = sessions.reduce((acc, s) => {
      acc[s.subject] = (acc[s.subject] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalSessions,
      totalMinutes,
      averageFrustration: Math.round(avgFrustration * 10) / 10,
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
