import { eq, desc } from 'drizzle-orm';
import { db } from '../connection';
import { progress, type Progress } from '../schema';

class ProgressRepository {
  async findByUserId(userId: string): Promise<Progress[]> {
    return await db
      .select()
      .from(progress)
      .where(eq(progress.userId, userId))
      .orderBy(desc(progress.updatedAt));
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
}

export const progressRepository = new ProgressRepository();
