import { pgTable, uuid, varchar, timestamp, jsonb, index, foreignKey } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { user } from '../auth/auth.schema';

/**
 * Table student_cognitive_profiles - Profil cognitif persistant
 *
 * Mis à jour par l'agent IA au fil des conversations.
 * Utilisé pour personnaliser les réponses pédagogiques.
 */
export const studentCognitiveProfiles = pgTable('student_cognitive_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull().unique(),

  // Profil cognitif (mis à jour par l'agent)
  strengths: jsonb('strengths').default(sql`'[]'::jsonb`),
  weaknesses: jsonb('weaknesses').default(sql`'[]'::jsonb`),
  preferredStyle: varchar('preferred_style', { length: 50 }),

  // Historique des observations (append-only, max 50 entries)
  observations: jsonb('observations').default(sql`'[]'::jsonb`),

  // Timestamps
  lastUpdatedByAgent: timestamp('last_updated_by_agent', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'student_cognitive_profiles_user_id_fkey'
  }).onDelete('cascade'),

  index('idx_student_cognitive_profiles_user_id').on(table.userId),
]);

// =============================================
// RELATIONS
// =============================================

export const studentCognitiveProfilesRelations = relations(studentCognitiveProfiles, ({ one }) => ({
  user: one(user, {
    fields: [studentCognitiveProfiles.userId],
    references: [user.id]
  }),
}));

// =============================================
// TYPES
// =============================================
// Cognitive Profile Types
export type StudentCognitiveProfile = typeof studentCognitiveProfiles.$inferSelect;
export type NewStudentCognitiveProfile = typeof studentCognitiveProfiles.$inferInsert;

export interface CognitiveObservation {
  date: string;
  observation: string;
  subject?: string | undefined;
}
