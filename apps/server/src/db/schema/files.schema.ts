import { pgTable, uuid, varchar, timestamp, integer, jsonb, pgEnum, index, foreignKey, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth.schema';
import { studySessions } from './learning.schema';

// =============================================
// ENUMS
// =============================================

/**
 * Enum pour le statut des fichiers
 */
export const fileStatusEnum = pgEnum('file_status', [
  'pending',    // Upload en cours (presigned URL généré)
  'uploaded',   // Fichier uploadé dans Scaleway
  'processing', // Analyse en cours (Gemini)
  'ready',      // Prêt à utiliser
  'expired',    // Gemini URI expiré (48h)
  'deleted'     // Supprimé
]);

// Type inféré de l'enum pour TypeScript
export type FileStatus = (typeof fileStatusEnum.enumValues)[number];

// =============================================
// TABLES
// =============================================

/**
 * Table files - Métadonnées fichiers uploadés
 * Stockage: Scaleway Object Storage (RGPD France)
 * Analyse: Gemini Files API (cache 48h)
 */
export const files = pgTable('files', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull(),

  // Infos fichier original
  fileName: varchar('file_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  sizeBytes: integer('size_bytes').notNull(),

  // Stockage Scaleway S3
  storageKey: varchar('storage_key', { length: 500 }).notNull(), // Clé S3 dans le bucket
  storageBucket: varchar('storage_bucket', { length: 100 }).notNull(),
  storageRegion: varchar('storage_region', { length: 20 }).notNull().default('fr-par'),

  // Gemini Files API (cache 48h pour multimodal)
  geminiFileUri: varchar('gemini_file_uri', { length: 500 }), // files/xxx format
  geminiExpiresAt: timestamp('gemini_expires_at', { withTimezone: true }),

  // Contexte éducatif (résultat d'analyse)
  educationalContext: jsonb('educational_context').default(sql`'{}'::jsonb`),
  // Structure: { analysisContext, extractedText, documentType, subject, hadRAG, classification, ragContext, metrics }

  // Statut et métadonnées
  status: fileStatusEnum('status').notNull().default('pending'),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdFk: foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'files_user_id_fkey'
  }).onDelete('cascade'), // Supprimer fichiers si user supprimé

  userIdIdx: index('idx_files_user_id').on(table.userId),
  statusIdx: index('idx_files_status').on(table.status),
  storageKeyIdx: index('idx_files_storage_key').on(table.storageKey),
  createdAtIdx: index('idx_files_created_at').on(table.createdAt),
}));

/**
 * Table session_files - Fichiers attachés à une session de chat
 *
 * Permet aux élèves de gérer quels fichiers du classeur sont
 * injectés dans le contexte AI d'une session donnée.
 */
export const sessionFiles = pgTable('session_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull(),
  fileId: uuid('file_id').notNull(),
  attachedAt: timestamp('attached_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sessionIdFk: foreignKey({
    columns: [table.sessionId],
    foreignColumns: [studySessions.id],
    name: 'session_files_session_id_fkey'
  }).onDelete('cascade'),

  fileIdFk: foreignKey({
    columns: [table.fileId],
    foreignColumns: [files.id],
    name: 'session_files_file_id_fkey'
  }).onDelete('cascade'),

  sessionFileUnique: unique('session_files_session_file_unique')
    .on(table.sessionId, table.fileId),

  sessionIdx: index('idx_session_files_session').on(table.sessionId),
  fileIdx: index('idx_session_files_file').on(table.fileId),
}));

// =============================================
// TYPES
// =============================================

// Session Files Types (Classeur)
export type SessionFile = typeof sessionFiles.$inferSelect;
export type NewSessionFile = typeof sessionFiles.$inferInsert;
