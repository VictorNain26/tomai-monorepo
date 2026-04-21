import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../connection';
import { progress, type Progress, type NewProgress } from '../schema';

export class ProgressRepository {
  async create(progressData: NewProgress): Promise<Progress> {
    const [progressRecord] = await db
      .insert(progress)
      .values(progressData)
      .returning();

    if (!progressRecord) {
      throw new Error('Failed to create progress record');
    }

    return progressRecord;
  }

  async findByUserId(userId: string): Promise<Progress[]> {
    return await db
      .select()
      .from(progress)
      .where(eq(progress.userId, userId))
      .orderBy(desc(progress.updatedAt));
  }

  async findByUserIdAndSubject(userId: string, subject: string): Promise<Progress[]> {
    return await db
      .select()
      .from(progress)
      .where(
        and(
          eq(progress.userId, userId),
          eq(progress.subject, subject)
        )
      )
      .orderBy(desc(progress.updatedAt));
  }

  async findByUserSubjectConcept(userId: string, subject: string, concept: string): Promise<Progress | undefined> {
    const [progressRecord] = await db
      .select()
      .from(progress)
      .where(
        and(
          eq(progress.userId, userId),
          eq(progress.subject, subject),
          eq(progress.concept, concept)
        )
      )
      .limit(1);

    return progressRecord;
  }

  async upsertProgress(
    userId: string,
    subject: string,
    concept: string,
    masteryLevel: number,
    practiceTimeMinutes?: number,
    successRate?: number
  ): Promise<Progress> {
    const deltaMinutes = practiceTimeMinutes ?? 0;
    const successRateStr = successRate?.toString();

    const [row] = await db
      .insert(progress)
      .values({
        userId,
        subject,
        concept,
        masteryLevel,
        totalPracticeTime: deltaMinutes,
        successRate: successRateStr ?? '0',
      })
      .onConflictDoUpdate({
        target: [progress.userId, progress.subject, progress.concept],
        set: {
          masteryLevel,
          totalPracticeTime: sql`COALESCE(${progress.totalPracticeTime}, 0) + ${deltaMinutes}`,
          successRate: successRateStr
            ? sql`${successRateStr}`
            : sql`${progress.successRate}`,
          lastPracticed: sql`NOW()`,
          updatedAt: sql`NOW()`,
        },
      })
      .returning();

    if (!row) {
      throw new Error('Failed to upsert progress record');
    }
    return row;
  }

  async getProgressSummary(userId: string): Promise<{
    totalConcepts: number;
    masteredConcepts: number; // mastery level >= 4
    averageMastery: number;
    subjectProgress: Array<{
      subject: string;
      conceptCount: number;
      averageMastery: number;
      totalPracticeTime: number;
    }>;
  }> {
    const userProgress = await this.findByUserId(userId);

    const totalConcepts = userProgress.length;
    const masteredConcepts = userProgress.filter(p => p.masteryLevel >= 4).length;
    const averageMastery = totalConcepts > 0
      ? userProgress.reduce((sum, p) => sum + p.masteryLevel, 0) / totalConcepts
      : 0;

    // Group by subject
    const subjectMap = new Map<string, Progress[]>();
    userProgress.forEach(p => {
      if (!subjectMap.has(p.subject)) {
        subjectMap.set(p.subject, []);
      }
      subjectMap.get(p.subject)!.push(p);
    });

    const subjectProgress = Array.from(subjectMap.entries()).map(([subject, concepts]) => ({
      subject,
      conceptCount: concepts.length,
      averageMastery: concepts.reduce((sum, p) => sum + p.masteryLevel, 0) / concepts.length,
      totalPracticeTime: concepts.reduce((sum, p) => sum + (p.totalPracticeTime ?? 0), 0),
    }));

    return {
      totalConcepts,
      masteredConcepts,
      averageMastery: Math.round(averageMastery * 10) / 10,
      subjectProgress,
    };
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await db
      .delete(progress)
      .where(eq(progress.id, id))
      .returning();

    return result.length > 0;
  }
}

export const progressRepository = new ProgressRepository();
