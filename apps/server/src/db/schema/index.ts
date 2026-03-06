import type { User, Session, Account } from './auth.schema';
import type { StudySession, Progress } from './learning.schema';

// =============================================
// CROSS-DOMAIN TYPES
// =============================================

export type UserWithRelations = User & {
  parent?: User | null;
  children?: User[];
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
export * from './pronote.schema';
export * from './billing.schema';
export * from './files.schema';
export * from './learning-tools.schema';
export * from './notifications.schema';
