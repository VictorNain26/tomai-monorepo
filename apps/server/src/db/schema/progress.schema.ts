import { pgTable, uuid, varchar, timestamp, integer, decimal, jsonb, index, foreignKey, unique } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { user } from './auth.schema';

/**
 * Table progress - Progression pédagogique
 */
export const progress = pgTable('progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull(),

  // Domaine d'apprentissage
  subject: varchar('subject', { length: 100 }).notNull(),
  concept: varchar('concept', { length: 200 }).notNull(),
  competencyDomain: varchar('competency_domain', { length: 10 }),

  // Métriques de progression
  masteryLevel: integer('mastery_level').notNull(),
  totalPracticeTime: integer('total_practice_time').notNull().default(0),
  successRate: decimal('success_rate', { precision: 5, scale: 2 }),

  // Historique de progression
  progressHistory: jsonb('progress_history').default(sql`'[]'::jsonb`),

  // Timing
  firstPracticed: timestamp('first_practiced', { withTimezone: true }).notNull().defaultNow(),
  lastPracticed: timestamp('last_practiced', { withTimezone: true }).notNull().defaultNow(),

  // Métadonnées
  progressMetadata: jsonb('progress_metadata').default(sql`'{}'::jsonb`),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdFk: foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'progress_user_id_fkey'
  }).onDelete('cascade'),

  userSubjectConceptUnique: unique('progress_user_id_subject_concept_key').on(table.userId, table.subject, table.concept),

  userIdIdx: index('idx_progress_user_id').on(table.userId),
  subjectIdx: index('idx_progress_subject').on(table.subject),
  masteryLevelIdx: index('idx_progress_mastery_level').on(table.masteryLevel),
}));

export const progressRelations = relations(progress, ({ one }) => ({
  user: one(user, {
    fields: [progress.userId],
    references: [user.id]
  }),
}));

export type Progress = typeof progress.$inferSelect;
export type NewProgress = typeof progress.$inferInsert;
