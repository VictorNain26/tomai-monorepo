import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { user } from './auth.schema';

/**
 * Pronote credentials sync table
 *
 * Device-first architecture (2026):
 * - Mobile device makes all Pronote API calls via pawnote
 * - Server stores encrypted credentials for multi-device sync only
 * - Server NEVER calls Pronote directly
 *
 * Security:
 * - Token encrypted AES-256-GCM before storage
 * - Metadata (instanceUrl, username, deviceUuid) encrypted separately
 * - Decryption happens on the requesting device
 */
export const pronoteCredentials = pgTable(
  'pronote_credentials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 }).notNull().unique(),
    encryptedToken: text('encrypted_token').notNull(),
    encryptedMetadata: text('encrypted_metadata').notNull(),
    tokenExpiresAt: timestamp('token_expires_at', {
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: 'pronote_credentials_user_id_fkey',
    }).onDelete('cascade'),
  })
);

// Relations
export const pronoteCredentialsRelations = relations(
  pronoteCredentials,
  ({ one }) => ({
    user: one(user, {
      fields: [pronoteCredentials.userId],
      references: [user.id],
    }),
  })
);

// Types
export type PronoteCredential = typeof pronoteCredentials.$inferSelect;
export type NewPronoteCredential = typeof pronoteCredentials.$inferInsert;
