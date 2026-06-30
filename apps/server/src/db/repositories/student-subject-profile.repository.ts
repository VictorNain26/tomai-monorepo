import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../connection';
import { studentSubjectProfiles, type StudentSubjectProfile } from '../schema';

const MAX_CONCEPTS = 100;
const MAX_DIFFICULTIES = 50;

function mergeDedup(existing: string[], added: string[], cap: number): string[] {
  const seen = new Set(existing.map((s) => s.toLowerCase()));
  const out = [...existing];
  for (const item of added) {
    const key = item.trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(item.trim());
    }
  }
  return out.slice(-cap);
}

export const studentSubjectProfileRepository = {
  async findByUserAndSubject(userId: string, subject: string): Promise<StudentSubjectProfile | undefined> {
    const [row] = await db
      .select()
      .from(studentSubjectProfiles)
      .where(and(eq(studentSubjectProfiles.userId, userId), eq(studentSubjectProfiles.subject, subject)))
      .limit(1);
    return row;
  },

  async findByUser(userId: string): Promise<StudentSubjectProfile[]> {
    return db
      .select()
      .from(studentSubjectProfiles)
      .where(eq(studentSubjectProfiles.userId, userId))
      .orderBy(desc(studentSubjectProfiles.updatedAt));
  },

  async upsertAggregate(input: {
    userId: string;
    subject: string;
    addedConcepts: string[];
    addedDifficulties: string[];
    outcome?: string;
    ttlDays: number;
  }): Promise<StudentSubjectProfile> {
    const existing = await this.findByUserAndSubject(input.userId, input.subject);
    const ttlUntil = sql`NOW() + (${input.ttlDays} || ' days')::interval`;

    if (!existing) {
      const [created] = await db
        .insert(studentSubjectProfiles)
        .values({
          userId: input.userId,
          subject: input.subject,
          conceptsSeen: mergeDedup([], input.addedConcepts, MAX_CONCEPTS),
          difficulties: mergeDedup([], input.addedDifficulties, MAX_DIFFICULTIES),
          sessionsCount: 1,
          lastOutcome: input.outcome ?? null,
          ttlUntil: ttlUntil as unknown as Date,
        })
        .returning();
      if (!created) throw new Error('Failed to create student subject profile');
      return created;
    }

    const [updated] = await db
      .update(studentSubjectProfiles)
      .set({
        conceptsSeen: mergeDedup(existing.conceptsSeen, input.addedConcepts, MAX_CONCEPTS),
        difficulties: mergeDedup(existing.difficulties, input.addedDifficulties, MAX_DIFFICULTIES),
        sessionsCount: existing.sessionsCount + 1,
        lastOutcome: input.outcome ?? existing.lastOutcome,
        updatedAt: sql`NOW()`,
        ttlUntil: ttlUntil as unknown as Date,
      })
      .where(eq(studentSubjectProfiles.id, existing.id))
      .returning();
    if (!updated) throw new Error('Failed to update student subject profile');
    return updated;
  },

  async updateNotes(
    userId: string,
    subject: string,
    patch: { masteryNotes?: string | null; difficulties?: string[] },
  ): Promise<StudentSubjectProfile | undefined> {
    const [updated] = await db
      .update(studentSubjectProfiles)
      .set({
        ...(patch.masteryNotes !== undefined && { masteryNotes: patch.masteryNotes }),
        ...(patch.difficulties !== undefined && { difficulties: patch.difficulties.slice(0, MAX_DIFFICULTIES) }),
        updatedAt: sql`NOW()`,
      })
      .where(and(eq(studentSubjectProfiles.userId, userId), eq(studentSubjectProfiles.subject, subject)))
      .returning();
    return updated;
  },
};
