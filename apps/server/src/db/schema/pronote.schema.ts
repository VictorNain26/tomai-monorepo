import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, pgEnum, index, foreignKey, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth.schema';

// =============================================
// ENUMS
// =============================================

/**
 * Enum pour le statut de connexion Pronote
 */
export const pronoteConnectionStatusEnum = pgEnum('pronote_connection_status', [
  'active',      // Connexion active et fonctionnelle
  'expired',     // Token expiré, nécessite reconnexion
  'error',       // Erreur lors du refresh
  'disconnected' // Déconnecté manuellement
]);

// =============================================
// TABLES
// =============================================

/**
 * Table pronote_connections - Connexions Pronote des PARENTS
 *
 * Architecture parent-based (2025):
 * - Un parent se connecte avec son compte Pronote parent
 * - Le compte parent contient tous les enfants (resources[])
 * - Les mappings enfant Pronote → enfant TomAI sont dans pronote_child_mappings
 *
 * Sécurité:
 * - Token chiffré AES-256-GCM (jamais en clair)
 * - Clé de chiffrement dans PRONOTE_ENCRYPTION_KEY
 * - Refresh automatique toutes les 5 minutes
 */
export const pronoteConnections = pgTable('pronote_connections', {
  id: uuid('id').primaryKey().defaultRandom(),

  // ===== RELATIONS =====
  parentId: varchar('parent_id', { length: 255 }).notNull().unique(), // Le parent TomAI

  // ===== ÉTABLISSEMENT (stocké directement, pas de FK) =====
  // Nom de l'établissement récupéré depuis l'API Index Education lors de la connexion
  establishmentName: varchar('establishment_name', { length: 300 }).notNull(),

  // ===== PRONOTE AUTH DATA (chiffré) =====
  encryptedToken: text('encrypted_token').notNull(),
  instanceUrl: varchar('instance_url', { length: 400 }).notNull(),
  pronoteUsername: varchar('pronote_username', { length: 100 }).notNull(),
  deviceUuid: varchar('device_uuid', { length: 36 }).notNull(),
  // Type de compte Pronote: PARENT = 7 (Pawnote AccountKind.PARENT)
  accountKind: integer('account_kind').notNull().default(7),

  // ===== PRONOTE RESOURCES (enfants du compte parent) =====
  // Array des enfants disponibles dans le compte Pronote parent
  // Structure: [{ name: string, id: string, className: string }]
  pronoteResources: jsonb('pronote_resources').default(sql`'[]'::jsonb`),

  // ===== STATUS =====
  status: pronoteConnectionStatusEnum('status').notNull().default('active'),
  lastError: text('last_error'),

  // ===== TIMING =====
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }).notNull(),
  lastRefreshAt: timestamp('last_refresh_at', { withTimezone: true }).notNull().defaultNow(),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),

  // ===== AUDIT =====
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  parentIdFk: foreignKey({
    columns: [table.parentId],
    foreignColumns: [user.id],
    name: 'pronote_connections_parent_id_fkey'
  }).onDelete('cascade'),

  statusIdx: index('idx_pronote_connections_status').on(table.status),
  tokenExpiresIdx: index('idx_pronote_connections_expires').on(table.tokenExpiresAt),
}));

/**
 * Table pronote_child_mappings - Mapping enfant Pronote → enfant TomAI
 *
 * Lie un enfant du compte Pronote parent (par son index dans resources[])
 * à un enfant TomAI (par son userId).
 *
 * Permet de:
 * - Mapper plusieurs enfants Pronote à plusieurs enfants TomAI
 * - Utiliser use(session, resourceIndex) pour accéder aux données de chaque enfant
 * - Synchroniser les devoirs, notes, EDT par enfant
 */
export const pronoteChildMappings = pgTable('pronote_child_mappings', {
  id: uuid('id').primaryKey().defaultRandom(),

  // ===== RELATIONS =====
  connectionId: uuid('connection_id').notNull(), // La connexion parent Pronote
  childId: varchar('child_id', { length: 255 }).notNull(), // L'enfant TomAI

  // ===== PRONOTE RESOURCE DATA =====
  // Index dans le tableau resources[] du compte parent Pronote
  resourceIndex: integer('resource_index').notNull(),
  // Nom de l'enfant dans Pronote (pour affichage/debug)
  pronoteChildName: varchar('pronote_child_name', { length: 200 }).notNull(),
  // Classe de l'enfant dans Pronote
  pronoteClassName: varchar('pronote_class_name', { length: 100 }),

  // ===== SYNC METADATA =====
  lastHomeworkSync: timestamp('last_homework_sync', { withTimezone: true }),
  lastGradesSync: timestamp('last_grades_sync', { withTimezone: true }),
  lastTimetableSync: timestamp('last_timetable_sync', { withTimezone: true }),

  // ===== AUDIT =====
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  connectionIdFk: foreignKey({
    columns: [table.connectionId],
    foreignColumns: [pronoteConnections.id],
    name: 'pronote_child_mappings_connection_id_fkey'
  }).onDelete('cascade'),

  childIdFk: foreignKey({
    columns: [table.childId],
    foreignColumns: [user.id],
    name: 'pronote_child_mappings_child_id_fkey'
  }).onDelete('cascade'),

  // Un enfant TomAI ne peut être mappé qu'une seule fois par connexion
  connectionChildUnique: unique('pronote_child_mappings_connection_child_unique')
    .on(table.connectionId, table.childId),

  // Index pour queries fréquentes
  connectionIdx: index('idx_pronote_child_mappings_connection').on(table.connectionId),
  childIdx: index('idx_pronote_child_mappings_child').on(table.childId),
}));

// =============================================
// TYPES
// =============================================
export type PronoteConnectionStatus = typeof pronoteConnectionStatusEnum.enumValues[number];
export type PronoteConnection = typeof pronoteConnections.$inferSelect;
export type NewPronoteConnection = typeof pronoteConnections.$inferInsert;
export type PronoteChildMapping = typeof pronoteChildMappings.$inferSelect;
export type NewPronoteChildMapping = typeof pronoteChildMappings.$inferInsert;

// Pronote resource from parent account (stored in pronoteResources JSONB)
export interface PronoteResource {
  name: string;
  id: string;
  className?: string;
}

export type PronoteConnectionWithRelations = PronoteConnection & {
  parent?: typeof user.$inferSelect;
  childMappings?: PronoteChildMapping[];
};

export type PronoteChildMappingWithRelations = PronoteChildMapping & {
  connection?: PronoteConnection;
  child?: typeof user.$inferSelect;
};
