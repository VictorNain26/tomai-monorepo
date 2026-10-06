import { relations } from 'drizzle-orm';
import { user, session, account } from '../../modules/auth/auth.schema';
import { parentChild } from '../../modules/family/family.schema';
import { studySessions, messages } from '../../modules/tutor/session.schema';
import { costTracking } from '../../modules/billing/cost-tracking.schema';
import { learningDecks } from '../../modules/learning/decks.schema';
import { files, sessionFiles } from '../../modules/documents/files.schema';

// =============================================
// CROSS-DOMAIN RELATIONS
// =============================================

export const userRelations = relations(user, ({ many }) => ({
  // Parent-child junction links
  asParentLinks: many(parentChild, { relationName: 'pc_parent' }),
  asChildLinks: many(parentChild, { relationName: 'pc_child' }),

  // Auth relationships
  sessions: many(session),
  accounts: many(account),

  // Learning relationships
  studySessions: many(studySessions),
  costTracking: many(costTracking),

  // File uploads (Scaleway Object Storage)
  files: many(files),

  // Learning Tools (Flashcards, QCM, Vrai/Faux)
  learningDecks: many(learningDecks),
}));

export const studySessionsRelations = relations(studySessions, ({ one, many }) => ({
  user: one(user, {
    fields: [studySessions.userId],
    references: [user.id]
  }),
  messages: many(messages),
  costTracking: many(costTracking),
  sessionFiles: many(sessionFiles),
}));

// =============================================
// CROSS-DOMAIN TYPES
// =============================================
import type { User, Session, Account } from '../../modules/auth/auth.schema';
import type { StudySession } from '../../modules/tutor/session.schema';

export type UserWithRelations = User & {
  sessions?: Session[];
  accounts?: Account[];
  studySessions?: StudySession[];
};

// =============================================
// RE-EXPORTS
// =============================================
export * from '../../modules/auth/auth.schema';
export * from '../../modules/family/family.schema';
export * from '../../modules/tutor/session.schema';
export * from '../../modules/tutor/exercise-sheet.schema';
export * from '../../modules/tutor/distress.schema';
export * from '../../modules/billing/cost-tracking.schema';
export * from '../../modules/billing/billing.schema';
export * from '../../modules/documents/files.schema';
export * from '../../modules/learning/decks.schema';
