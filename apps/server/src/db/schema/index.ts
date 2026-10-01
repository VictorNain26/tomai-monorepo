import { relations } from 'drizzle-orm';
import { user, session, account, parentChild } from './auth.schema';
import { studySessions, messages, costTracking, progress } from './learning.schema';
import { learningDecks, studentCognitiveProfiles } from './learning-tools.schema';
import { files, sessionFiles } from '../../modules/documents/files.schema';

// =============================================
// CROSS-DOMAIN RELATIONS
// =============================================

export const userRelations = relations(user, ({ many, one }) => ({
  // Parent-child junction links
  asParentLinks: many(parentChild, { relationName: 'pc_parent' }),
  asChildLinks: many(parentChild, { relationName: 'pc_child' }),

  // Auth relationships
  sessions: many(session),
  accounts: many(account),

  // Learning relationships
  studySessions: many(studySessions),
  progress: many(progress),
  costTracking: many(costTracking),

  // File uploads (Scaleway Object Storage)
  files: many(files),

  // Learning Tools (Flashcards, QCM, Vrai/Faux)
  learningDecks: many(learningDecks),

  // Cognitive Profile (agent-updated)
  cognitiveProfile: one(studentCognitiveProfiles, {
    fields: [user.id],
    references: [studentCognitiveProfiles.userId],
  }),
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
import type { User, Session, Account } from './auth.schema';
import type { StudySession, Progress } from './learning.schema';

export type UserWithRelations = User & {
  sessions?: Session[];
  accounts?: Account[];
  studySessions?: StudySession[];
  progress?: Progress[];
};

// =============================================
// RE-EXPORTS
// =============================================
export * from './auth.schema';
export * from './learning.schema';
export * from './billing.schema';
export * from '../../modules/documents/files.schema';
export * from './learning-tools.schema';
