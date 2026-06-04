export { usersRepository, UsersRepository } from './users.repository';
export { studySessionsRepository, StudySessionsRepository, type CreateStudySessionInput, type UpdateStudySessionInput } from './study-sessions.repository';
export { messagesRepository, MessagesRepository } from './messages.repository';
export { progressRepository, ProgressRepository } from './progress.repository';
export { filesRepository, FilesRepository, type File, type NewFile } from './files.repository';
export { sessionFilesRepository, SessionFilesRepository } from './session-files.repository';
export { retrievalAuditRepository, RetrievalAuditRepository, type LogRetrievalInput } from './retrieval-audit.repository';
export { pushTokensRepository, PushTokensRepository, type UpsertPushTokenInput } from './push-tokens.repository';
export { waitlistRepository, WaitlistRepository } from './waitlist.repository';

// Export database connection and schema for advanced queries
export { db, sql } from '../connection';
export * from '../schema';