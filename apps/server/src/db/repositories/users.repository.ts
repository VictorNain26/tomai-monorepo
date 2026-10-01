import { eq, and, sql } from 'drizzle-orm';
import { db } from '../connection';
import { user, parentChild } from '../schema';

// Types inférés du schéma
type User = typeof user.$inferSelect;
type NewUser = typeof user.$inferInsert;

class UsersRepository {
  async findByEmail(email: string): Promise<User | undefined> {
    const [foundUser] = await db
      .select()
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    return foundUser;
  }

  async findByUsername(username: string): Promise<User | undefined> {
    const [foundUser] = await db
      .select()
      .from(user)
      .where(eq(user.username, username))
      .limit(1);

    return foundUser;
  }

  async findById(id: string): Promise<User | undefined> {
    const [foundUser] = await db
      .select()
      .from(user)
      .where(eq(user.id, id))
      .limit(1);

    return foundUser;
  }

  async create(userData: NewUser): Promise<User> {
    const [createdUser] = await db
      .insert(user)
      .values(userData)
      .returning();

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

  async findChildrenByParentId(parentId: string): Promise<User[]> {
    const rows = await db
      .select()
      .from(parentChild)
      .innerJoin(user, eq(user.id, parentChild.childUserId))
      .where(and(eq(parentChild.parentUserId, parentId), eq(user.isActive, true)));
    return rows.map((r) => r.user);
  }

  async findAllChildrenByParentId(parentId: string): Promise<User[]> {
    const rows = await db
      .select()
      .from(parentChild)
      .innerJoin(user, eq(user.id, parentChild.childUserId))
      .where(eq(parentChild.parentUserId, parentId));
    return rows.map((r) => r.user);
  }

  /**
   * Supprimer un utilisateur (hard delete)
   * Les contraintes CASCADE suppriment automatiquement les données liées
   */
  async deleteById(id: string): Promise<boolean> {
    const result = await db
      .delete(user)
      .where(eq(user.id, id))
      .returning();

    return result.length > 0;
  }
}

export const usersRepository = new UsersRepository();
