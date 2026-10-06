import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/connection';
import { distressEvents } from './distress.schema.js';
import { messages, studySessions } from './session.schema.js';
import type { DistressSource } from './distress.js';

interface DistressTurnRecord {
  sessionId: string;
  userId: string;
  /** Null for a message in a session already closed. */
  event: { detectedBy: DistressSource; selfharmScore: number | null } | null;
  student: { content: string; metadata: Record<string, unknown> };
  reply: { content: string; metadata: Record<string, unknown> };
}

class DistressEventsRepository {
  /** The distress turn at once: the event and the closed session with the messages, or none of them. */
  async recordTurn(turn: DistressTurnRecord): Promise<void> {
    await db.transaction(async (tx) => {
      if (turn.event) {
        // Two distress messages sent at once: the second finds the event and records none.
        await tx
          .insert(distressEvents)
          .values({ userId: turn.userId, sessionId: turn.sessionId, ...turn.event })
          .onConflictDoNothing({ target: distressEvents.sessionId });
        await tx
          .update(studySessions)
          .set({ status: 'completed', endedAt: sql`now()`, updatedAt: sql`now()` })
          .where(eq(studySessions.id, turn.sessionId));
      }
      // now() is the transaction's start for both rows: clock_timestamp() keeps the reply after the message.
      await tx.insert(messages).values({
        sessionId: turn.sessionId,
        role: 'user',
        content: turn.student.content,
        messageMetadata: turn.student.metadata,
        createdAt: sql`clock_timestamp()`,
      });
      await tx.insert(messages).values({
        sessionId: turn.sessionId,
        role: 'assistant',
        content: turn.reply.content,
        messageMetadata: turn.reply.metadata,
        createdAt: sql`clock_timestamp()`,
      });
    });
  }

  async existsForSession(sessionId: string): Promise<boolean> {
    const [row] = await db.select({ id: distressEvents.id }).from(distressEvents).where(eq(distressEvents.sessionId, sessionId)).limit(1);
    return row !== undefined;
  }
}

export const distressEventsRepository = new DistressEventsRepository();
