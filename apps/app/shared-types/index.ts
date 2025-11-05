// Central export point for all shared types
export * from './auth.types';
export * from './child.types';
export * from './chat.types';
export * from './progress.types';
export * from './api.types';

// Re-export commonly used types for convenience
export type {
  IUser,
  UserRole,
  SchoolLevel,
} from './auth.types';

export type {
  IChild,
  ICreateChildRequest,
  IUpdateChildRequest,
  IChildResponse,
} from './child.types';

export type {
  IMessage,
  IChatMessage,
  IStudySession,
  IChatResponse,
} from './chat.types';

export type {
  IProgress,
  ISubjectProgress,
  ICostTracking,
  IDashboardStats,
} from './progress.types';

export type {
  IApiResponse,
  IApiErrorResponse,
  IApiSuccessResponse,
} from './api.types';
