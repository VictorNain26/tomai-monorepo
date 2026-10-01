import { pgTable, uuid, varchar, timestamp, index, foreignKey, unique } from 'drizzle-orm/pg-core';
import { user } from '../auth/auth.schema';

/**
 * Table parent_child — jonction N-N parent↔enfant
 * Remplace l'ancienne colonne user.parentId (supprimée Task 8).
 */
export const parentChild = pgTable('parent_child', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentUserId: varchar('parent_user_id', { length: 255 }).notNull(),
  childUserId: varchar('child_user_id', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('parent_child_pair_unique').on(table.parentUserId, table.childUserId),
  index('idx_parent_child_parent').on(table.parentUserId),
  index('idx_parent_child_child').on(table.childUserId),
  foreignKey({
    columns: [table.parentUserId],
    foreignColumns: [user.id],
    name: 'parent_child_parent_user_id_fkey',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.childUserId],
    foreignColumns: [user.id],
    name: 'parent_child_child_user_id_fkey',
  }).onDelete('cascade'),
]);

export type ParentChild = typeof parentChild.$inferSelect;
export type NewParentChild = typeof parentChild.$inferInsert;
