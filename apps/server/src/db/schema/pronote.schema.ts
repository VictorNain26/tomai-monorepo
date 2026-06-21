import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  foreignKey,
  integer,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { user } from './auth.schema';

/**
 * Pronote credentials sync table
 *
 * Stores encrypted token + metadata for two consumers:
 * - Mobile (device-first): decrypts and uses the token directly for student auth
 * - Server-side provider (PawnoteServerAdapter): decrypts the token in-memory
 *   to call Pronote server-side for parent/web reads (loginToken flow)
 *
 * Security:
 * - Token encrypted AES-256-GCM before storage
 * - Metadata (instanceUrl, username, deviceUuid) encrypted separately
 * - Decryption is always ephemeral (never stored decrypted)
 */
export const pronoteCredentials = pgTable(
  'pronote_credentials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    encryptedToken: text('encrypted_token').notNull(),
    encryptedMetadata: text('encrypted_metadata').notNull(),
    establishmentUrl: varchar('establishment_url', { length: 255 }).notNull(),
    establishmentName: varchar('establishment_name', { length: 255 }),
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
    userEstablishmentUnique: unique('pronote_credentials_user_establishment_unique').on(
      table.userId,
      table.establishmentUrl,
    ),
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

export const pronoteChildResources = pgTable(
  'pronote_child_resources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    parentUserId: varchar('parent_user_id', { length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    childUserId: varchar('child_user_id', { length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    credentialId: uuid('credential_id'),
    resourceId: integer('resource_id').notNull(),
    className: varchar('class_name', { length: 255 }),
    establishmentName: varchar('establishment_name', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    parentChildUnique: unique('pronote_child_resources_parent_child_unique').on(
      table.parentUserId,
      table.childUserId,
    ),
    credentialResourceUnique: unique('pronote_child_resources_credential_resource_unique').on(
      table.credentialId,
      table.resourceId,
    ),
    credentialFk: foreignKey({
      columns: [table.credentialId],
      foreignColumns: [pronoteCredentials.id],
      name: 'pronote_child_resources_credential_id_fkey',
    }).onDelete('cascade'),
  })
);

export type PronoteChildResource = typeof pronoteChildResources.$inferSelect;
export type NewPronoteChildResource = typeof pronoteChildResources.$inferInsert;
