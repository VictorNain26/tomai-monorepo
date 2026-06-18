import { pgTable, varchar, text, timestamp, boolean, integer, jsonb, pgEnum, index, foreignKey, uuid, unique } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// =============================================
// ENUMS
// =============================================
export const schoolLevelEnum = pgEnum('school_level', [
  'cp', 'ce1', 'ce2', 'cm1', 'cm2',                    // Primaire
  'sixieme', 'cinquieme', 'quatrieme', 'troisieme',    // Collège
  'seconde', 'premiere', 'terminale'                    // Lycée
]);

export const userRoleEnum = pgEnum('user_role', ['student', 'parent', 'admin']);

// =============================================
// TABLES
// =============================================

/**
 * Table user - Better Auth standard + extensions TomAI
 * Configuration alignée avec Better Auth v1.5 + plugins admin/expo
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
  username: varchar('username', { length: 50 }).unique(), // Identifiant unique élèves (géré par parent.service)
  displayUsername: varchar('display_username', { length: 50 }).unique(), // Affichage normalisé du username

  // ===== TOMAI ADDITIONAL FIELDS (alignés avec auth.ts) =====
  firstName: varchar('first_name', { length: 100 }), // Prénom séparé du 'name'
  lastName: varchar('last_name', { length: 100 }),   // Nom séparé du 'name'
  role: userRoleEnum('role').notNull().default('parent'), // Défaut parent (comme auth.ts)
  schoolLevel: schoolLevelEnum('school_level'), // Niveau scolaire pour élèves
  dateOfBirth: varchar('date_of_birth', { length: 10 }), // Format YYYY-MM-DD string (comme auth.ts)
  parentId: varchar('parent_id', { length: 255 }), // Référence parent-enfant
  isActive: boolean('is_active').notNull().default(true), // État du compte
  loginCount: integer('login_count').default(0), // Compteur de connexions

  // ===== METADATA ET PREFERENCES =====
  preferences: jsonb('preferences').default(sql`'{"theme": "light", "language": "fr", "notifications": true, "adaptive_difficulty": true}'::jsonb`),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),

  // Subscription fields live on family_billing (RevenueCat-driven, single
  // source of truth). Previously duplicated here but never read — removed
  // to avoid accidental reads of stale data.

  // ===== BETTER AUTH ADMIN PLUGIN FIELDS =====
  banned: boolean('banned').default(false),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires', { withTimezone: true }),

  // ===== LOCALISATION =====
  countryCode: varchar('country_code', { length: 2 }).default('FR'),
  timezone: varchar('timezone', { length: 50 }).default('Europe/Paris'),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
}, (table) => ({
  // Index pour performance
  emailIdx: index('idx_user_email').on(table.email),
  usernameIdx: index('idx_user_username').on(table.username),
  parentIdIdx: index('idx_user_parent_id').on(table.parentId),
  roleIdx: index('idx_user_role').on(table.role),
  schoolLevelIdx: index('idx_user_school_level').on(table.schoolLevel),

  // Self-referencing foreign key pour parent-child
  parentIdFk: foreignKey({
    columns: [table.parentId],
    foreignColumns: [table.id],
    name: 'user_parent_id_fkey'
  }).onDelete('set null'),
}));

/**
 * Table session - Better Auth standard + Admin plugin impersonation
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
  // Better Auth Admin Plugin: impersonation tracking
  impersonatedBy: varchar('impersonated_by', { length: 255 }),
}, (table) => ({
  userIdFk: foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'session_user_id_fkey'
  }).onDelete('cascade'),

  impersonatedByFk: foreignKey({
    columns: [table.impersonatedBy],
    foreignColumns: [user.id],
    name: 'session_impersonated_by_fkey'
  }).onDelete('cascade'),

  tokenIdx: index('idx_session_token').on(table.token),
  userIdIdx: index('idx_session_user_id').on(table.userId),
  expiresAtIdx: index('idx_session_expires_at').on(table.expiresAt),
  impersonatedByIdx: index('idx_session_impersonated_by').on(table.impersonatedBy),
}));

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
}, (table) => ({
  userIdFk: foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'account_user_id_fkey'
  }).onDelete('cascade'),

  userIdIdx: index('idx_account_user_id').on(table.userId),
  providerAccountIdx: index('idx_account_provider_account').on(table.providerId, table.accountId),
}));

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
}, (table) => ({
  identifierIdx: index('idx_verification_identifier').on(table.identifier),
}));

/**
 * Table parent_restore_token - Quick Switch tokens (Parent → Child)
 *
 * Sécurité 2026:
 * - Token aléatoire stocké en base (pas de signature cryptographique côté client)
 * - Usage unique (usedAt marqué à l'utilisation)
 * - Expiration courte (24h)
 * - Audit trail complet (parentId, childId, timestamps)
 * - Révocation possible (suppression du token)
 */
export const parentRestoreToken = pgTable('parent_restore_token', {
  id: uuid('id').primaryKey().defaultRandom(),
  token: varchar('token', { length: 64 }).notNull().unique(), // 32 bytes hex = 64 chars
  parentId: varchar('parent_id', { length: 255 }).notNull(),
  childId: varchar('child_id', { length: 255 }).notNull(), // For audit trail
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }), // NULL = not used, set on restore
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tokenIdx: index('idx_parent_restore_token_token').on(table.token),
  parentIdIdx: index('idx_parent_restore_token_parent_id').on(table.parentId),
  expiresAtIdx: index('idx_parent_restore_token_expires_at').on(table.expiresAt),

  parentIdFk: foreignKey({
    columns: [table.parentId],
    foreignColumns: [user.id],
    name: 'parent_restore_token_parent_id_fkey'
  }).onDelete('cascade'),

  childIdFk: foreignKey({
    columns: [table.childId],
    foreignColumns: [user.id],
    name: 'parent_restore_token_child_id_fkey'
  }).onDelete('cascade'),
}));

/**
 * Table parent_child — jonction N-N parent↔enfant
 * Remplace la colonne user.parentId (1-1) par un lien multiple.
 * user.parentId est conservé le temps de la migration progressive.
 */
export const parentChild = pgTable('parent_child', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentUserId: varchar('parent_user_id', { length: 255 }).notNull(),
  childUserId: varchar('child_user_id', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pairUnique: unique('parent_child_pair_unique').on(table.parentUserId, table.childUserId),
  parentIdx: index('idx_parent_child_parent').on(table.parentUserId),
  childIdx: index('idx_parent_child_child').on(table.childUserId),
  parentFk: foreignKey({
    columns: [table.parentUserId],
    foreignColumns: [user.id],
    name: 'parent_child_parent_user_id_fkey',
  }).onDelete('cascade'),
  childFk: foreignKey({
    columns: [table.childUserId],
    foreignColumns: [user.id],
    name: 'parent_child_child_user_id_fkey',
  }).onDelete('cascade'),
}));

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

export type ParentChild = typeof parentChild.$inferSelect;
export type NewParentChild = typeof parentChild.$inferInsert;

// Note: UserWithRelations is defined in index.ts (cross-domain type)
