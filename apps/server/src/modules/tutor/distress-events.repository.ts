import { eq } from 'drizzle-orm';
import { db } from '../../db/connection';
import { distressEvents } from './distress.schema.js';

type NewDistressEvent = typeof distressEvents.$inferInsert;

class DistressEventsRepository {
  async create(values: NewDistressEvent): Promise<void> {
    await db.insert(distressEvents).values(values);
  }

  async existsForSession(sessionId: string): Promise<boolean> {
    const [row] = await db.select({ id: distressEvents.id }).from(distressEvents).where(eq(distressEvents.sessionId, sessionId)).limit(1);
    return row !== undefined;
  }
}

export const distressEventsRepository = new DistressEventsRepository();
