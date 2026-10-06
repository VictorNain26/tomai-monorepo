import { eq, inArray, like, sql } from 'drizzle-orm';
import { db } from '../../db/connection';
import { user } from './auth.schema.js';

// Types inférés du schéma
type User = typeof user.$inferSelect;
type NewUser = typeof user.$inferInsert;

class UsersRepository {
  async findByEmail(email: string): Promise<User | undefined> {
    const [foundUser] = await db.select().from(user).where(eq(user.email, email)).limit(1);

    return foundUser;
  }

  async findByUsername(username: string): Promise<User | undefined> {
    const [foundUser] = await db.select().from(user).where(eq(user.username, username)).limit(1);

    return foundUser;
  }

  async findById(id: string): Promise<User | undefined> {
    const [foundUser] = await db.select().from(user).where(eq(user.id, id)).limit(1);

    return foundUser;
  }

  async create(userData: NewUser): Promise<User> {
    const [createdUser] = await db.insert(user).values(userData).returning();

    if (!createdUser) {
      throw new Error('Failed to create user');
    }

    return createdUser;
  }

  async update(id: string, userData: Partial<NewUser>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(user)
      .set({ ...userData, updatedAt: sql`NOW()` }) // Best practice Drizzle ORM: DB-level timestamp
      .where(eq(user.id, id))
      .returning();

    return updatedUser;
  }

  async findByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];
    return db.select().from(user).where(inArray(user.id, ids));
  }

  /**
   * Supprimer un utilisateur (hard delete)
   * Les contraintes CASCADE suppriment automatiquement les données liées
   */
  async deleteById(id: string): Promise<boolean> {
    const result = await db.delete(user).where(eq(user.id, id)).returning();

    return result.length > 0;
  }

  /** Hard-deletes every user whose username starts with `prefix`, taken literally. */
  async deleteByUsernamePrefix(prefix: string): Promise<number> {
    if (prefix === '') throw new Error('deleteByUsernamePrefix needs a non-empty prefix');
    const escaped = prefix.replace(/[\\%_]/g, '\\$&');
    const result = await db
      .delete(user)
      .where(like(user.username, `${escaped}%`))
      .returning({ id: user.id });

    return result.length;
  }
}

export const usersRepository = new UsersRepository();
