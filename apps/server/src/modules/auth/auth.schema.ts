import { pgTable, varchar, text, timestamp, boolean, pgEnum, index, foreignKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { EDUCATION_LEVELS } from '../../lib/education-levels.js';

// =============================================
// ENUMS
// =============================================
export const schoolLevelEnum = pgEnum('school_level', EDUCATION_LEVELS);

export const userRoleEnum = pgEnum('user_role', ['student', 'parent', 'admin']);

// =============================================
// TABLES
// =============================================

/**
 * Table user - Better Auth standard + extensions TomAI
 * Configuration alignée avec Better Auth + plugin username
 */
export const user = pgTable('user', {
  // ===== BETTER AUTH CORE FIELDS (REQUIS) =====
  id: varchar('id', { length: 255 }).primaryKey(),
  name: varchar('name', { length: 255 }), // Better Auth utilise 'name' comme displayName
  email: varchar('email', { length: 320 }).unique(),
  emailVerified: boolean('email_verified').default(false),
  image: varchar('image', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

  // ===== BETTER AUTH USERNAME PLUGIN FIELDS =====
  username: varchar('username', { length: 50 }).unique(), // Identifiant unique élèves (créé par createStudentAccount)
  displayUsername: varchar('display_username', { length: 50 }).unique(), // Affichage normalisé du username

  // ===== TOMAI ADDITIONAL FIELDS (alignés avec auth.ts) =====
  firstName: varchar('first_name', { length: 100 }), // Prénom séparé du 'name'
  lastName: varchar('last_name', { length: 100 }),   // Nom séparé du 'name'
  role: userRoleEnum('role').notNull().default('parent'), // Défaut parent (comme auth.ts)
  schoolLevel: schoolLevelEnum('school_level'), // Niveau scolaire pour élèves
  dateOfBirth: varchar('date_of_birth', { length: 10 }), // Format YYYY-MM-DD string (comme auth.ts)
  isActive: boolean('is_active').notNull().default(true), // État du compte
}, (table) => [
  // Index pour performance
  index('idx_user_email').on(table.email),
  index('idx_user_username').on(table.username),
  index('idx_user_role').on(table.role),
  index('idx_user_school_level').on(table.schoolLevel),
]);

/**
 * Table session - Better Auth standard
 */
export const session = pgTable('session', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  token: varchar('token', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'session_user_id_fkey'
  }).onDelete('cascade'),

  index('idx_session_token').on(table.token),
  index('idx_session_user_id').on(table.userId),
  index('idx_session_expires_at').on(table.expiresAt),
]);

/**
 * Table account - Better Auth OAuth providers
 */
export const account = pgTable('account', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  accountId: varchar('account_id', { length: 255 }).notNull(),
  providerId: varchar('provider_id', { length: 255 }).notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'), // Required by Better Auth for Google OAuth
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: varchar('scope', { length: 255 }),
  password: varchar('password', { length: 255 }), // Pour email/password auth
  salt: varchar('salt', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'account_user_id_fkey'
  }).onDelete('cascade'),

  index('idx_account_user_id').on(table.userId),
  index('idx_account_provider_account').on(table.providerId, table.accountId),
]);

/**
 * Table verification - Better Auth tokens
 */
export const verification = pgTable('verification', {
  id: varchar('id', { length: 255 }).primaryKey(),
  identifier: varchar('identifier', { length: 255 }).notNull(),
  value: text('value').notNull(), // TEXT requis par Better Auth pour OAuth tokens (JSON > 255 chars)
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_verification_identifier').on(table.identifier),
]);

// =============================================
// RELATIONS
// =============================================

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id]
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id]
  }),
}));

// =============================================
// TYPES
// =============================================
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;
export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;

export type UserRole = typeof userRoleEnum.enumValues[number];
export type SchoolLevel = typeof schoolLevelEnum.enumValues[number];

// AI Model: string type (pas d'ENUM = flexibilité pour nouveaux modèles)
export type AIModel = string;

// Note: UserWithRelations is defined in index.ts (cross-domain type)
