import { eq, asc, count } from 'drizzle-orm';
import { db } from '../connection';
import { messages, type Message, type NewMessage } from '../schema';

class MessagesRepository {
  async create(messageData: NewMessage): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values(messageData)
      .returning();

    if (!message) {
      throw new Error('Failed to create message');
    }

    return message;
  }

  async findBySessionId(sessionId: string): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(asc(messages.createdAt));
  }

  /**
   * Lightweight count for threshold checks (used by summarization).
   * Avoids loading every message when only the total matters.
   */
  async countBySessionId(sessionId: string): Promise<number> {
    const [row] = await db
      .select({ value: count() })
      .from(messages)
      .where(eq(messages.sessionId, sessionId));
    return row?.value ?? 0;
  }

  async findById(id: string): Promise<Message | undefined> {
    const [message] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, id))
      .limit(1);

    return message;
  }

  async update(id: string, messageData: Partial<NewMessage>): Promise<Message | undefined> {
    const [message] = await db
      .update(messages)
      .set(messageData)
      .where(eq(messages.id, id))
      .returning();

    return message;
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await db
      .delete(messages)
      .where(eq(messages.id, id))
      .returning();

    return result.length > 0;
  }
}

export const messagesRepository = new MessagesRepository();
