import { pgTable, uuid, varchar, timestamp, boolean, index, foreignKey } from 'drizzle-orm/pg-core';
import { user } from './auth.schema';

// =============================================
// TABLES
// =============================================

/**
 * Table device_push_tokens - Expo Push Tokens pour notifications mobiles
 *
 * Stocke les tokens Expo pour envoyer des push notifications.
 * Un utilisateur peut avoir plusieurs appareils (plusieurs tokens).
 */
export const devicePushTokens = pgTable('device_push_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull(),

  // Token Expo Push
  token: varchar('token', { length: 255 }).notNull().unique(),
  platform: varchar('platform', { length: 10 }).notNull(), // 'ios' | 'android'
  deviceName: varchar('device_name', { length: 100 }),

  // État du token
  isActive: boolean('is_active').notNull().default(true),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdFk: foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'device_push_tokens_user_id_fkey'
  }).onDelete('cascade'),

  userIdIdx: index('idx_device_push_tokens_user_id').on(table.userId),
  tokenIdx: index('idx_device_push_tokens_token').on(table.token),
  activeIdx: index('idx_device_push_tokens_active').on(table.isActive),
}));

// =============================================
// TYPES
// =============================================

// Device Push Tokens Types (Expo Push Notifications)
export type DevicePushToken = typeof devicePushTokens.$inferSelect;
export type NewDevicePushToken = typeof devicePushTokens.$inferInsert;
