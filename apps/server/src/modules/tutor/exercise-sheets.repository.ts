import { desc, eq, sql } from 'drizzle-orm';
import type { Hint } from './hint-ladder.js';
import { db } from '../../db/connection';
import { exerciseSheets } from './exercise-sheet.schema.js';

type NewExerciseSheet = typeof exerciseSheets.$inferInsert;
type StoredExerciseSheet = typeof exerciseSheets.$inferSelect;

class ExerciseSheetsRepository {
  async create(values: NewExerciseSheet): Promise<string | null> {
    const [row] = await db.insert(exerciseSheets).values(values).returning({ id: exerciseSheets.id });
    return row?.id ?? null;
  }

  /**
   * What a turn the student saw changes, in one statement computed by postgres: two turns of the
   * same session at once each count. `solved` ends the exercise, `false` reopens it, `undefined`
   * leaves it as it is.
   */
  async recordTurn(
    id: string,
    turn: { levelChange: number; top: number; stepDone: boolean; solved: boolean | undefined; hint: Hint },
  ): Promise<void> {
    await db
      .update(exerciseSheets)
      .set({
        hintLevel: sql`least(greatest(${exerciseSheets.hintLevel} + ${turn.levelChange}, 0), ${turn.top})`,
        ...(turn.stepDone && { stepsDone: sql`${exerciseSheets.stepsDone} + 1` }),
        ...(turn.solved !== undefined && { solvedAt: turn.solved ? new Date() : null }),
        hints: sql`${exerciseSheets.hints} || ${JSON.stringify([turn.hint])}::jsonb`,
      })
      .where(eq(exerciseSheets.id, id));
  }

  /** The session's last exercise, solved or not. */
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
