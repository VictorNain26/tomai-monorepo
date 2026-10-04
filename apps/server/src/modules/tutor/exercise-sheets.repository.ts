import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/connection';
import { exerciseSheets } from './exercise-sheet.schema.js';

type NewExerciseSheet = typeof exerciseSheets.$inferInsert;
type StoredExerciseSheet = typeof exerciseSheets.$inferSelect;

class ExerciseSheetsRepository {
  async create(values: NewExerciseSheet): Promise<void> {
    await db.insert(exerciseSheets).values(values);
  }

  /** The session's last sheet: the exercise in progress. */
  async findLatest(sessionId: string): Promise<StoredExerciseSheet | null> {
    const [row] = await db
      .select()
      .from(exerciseSheets)
      .where(eq(exerciseSheets.sessionId, sessionId))
      .orderBy(desc(exerciseSheets.createdAt))
      .limit(1);
    return row ?? null;
  }
}

export const exerciseSheetsRepository = new ExerciseSheetsRepository();
