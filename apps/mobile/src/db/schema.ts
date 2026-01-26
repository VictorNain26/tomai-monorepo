/**
 * Local SQLite Schema for Offline Support
 *
 * This schema mirrors a subset of the backend PostgreSQL schema
 * for offline-first functionality.
 *
 * Best Practice 2026: expo-sqlite + Drizzle ORM for type-safe local storage.
 * @see https://orm.drizzle.team/docs/connect-expo-sqlite
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// ============================================================================
// CHAT MESSAGES (Offline cache)
// ============================================================================

/**
 * Local cache of chat messages for offline viewing and optimistic updates.
 * Syncs with backend /api/chat/session/:id/history
 */
export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  role: text('role').notNull().$type<'user' | 'assistant'>(),
  content: text('content').notNull(),
  timestamp: text('timestamp').notNull(), // ISO string
  aiModel: text('ai_model'),
  attachedFileJson: text('attached_file_json'), // JSON stringified AttachedFileInfo
  syncStatus: text('sync_status').notNull().default('synced').$type<'pending' | 'synced' | 'conflict'>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ============================================================================
// CHAT SESSIONS (Offline cache)
// ============================================================================

/**
 * Local cache of chat sessions for offline viewing.
 */
export const chatSessions = sqliteTable('chat_sessions', {
  id: text('id').primaryKey(),
  subject: text('subject').notNull(),
  status: text('status').notNull().default('active'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ============================================================================
// LEARNING DECKS (Offline cache)
// ============================================================================

/**
 * Local cache of learning decks for offline studying.
 * Syncs with backend /api/learning/decks
 */
export const learningDecks = sqliteTable('learning_decks', {
  id: text('id').primaryKey(),
  subject: text('subject').notNull(),
  topic: text('topic'),
  title: text('title'),
  cardsJson: text('cards_json').notNull(), // JSON stringified LearningCard[]
  cardsCount: integer('cards_count').notNull().default(0),
  syncStatus: text('sync_status').notNull().default('synced').$type<'pending' | 'synced' | 'conflict'>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ============================================================================
// FSRS STATE (Spaced Repetition)
// ============================================================================

/**
 * Local FSRS state for spaced repetition algorithm.
 * Stores review state for each card.
 */
export const fsrsState = sqliteTable('fsrs_state', {
  id: text('id').primaryKey(),
  cardId: text('card_id').notNull(),
  deckId: text('deck_id').notNull(),
  stateJson: text('state_json').notNull(), // FSRS Card state
  dueDate: integer('due_date', { mode: 'timestamp' }),
  lastReviewedAt: integer('last_reviewed_at', { mode: 'timestamp' }),
  syncStatus: text('sync_status').notNull().default('synced').$type<'pending' | 'synced' | 'conflict'>(),
});

// ============================================================================
// PENDING ACTIONS (Offline queue)
// ============================================================================

/**
 * Queue of actions to sync when back online.
 * Used for optimistic updates.
 */
export const pendingActions = sqliteTable('pending_actions', {
  id: text('id').primaryKey(),
  type: text('type').notNull().$type<
    | 'send_message'
    | 'create_deck'
    | 'delete_deck'
    | 'update_fsrs'
    | 'create_session'
  >(),
  payload: text('payload').notNull(), // JSON stringified action data
  retryCount: integer('retry_count').notNull().default(0),
  maxRetries: integer('max_retries').notNull().default(3),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  lastAttemptAt: integer('last_attempt_at', { mode: 'timestamp' }),
  error: text('error'),
});

// ============================================================================
// SYNC METADATA
// ============================================================================

/**
 * Track last sync timestamps for each resource type.
 */
export const syncMetadata = sqliteTable('sync_metadata', {
  resourceType: text('resource_type').primaryKey().$type<
    'chat_messages' | 'chat_sessions' | 'learning_decks' | 'fsrs_state'
  >(),
  lastSyncAt: integer('last_sync_at', { mode: 'timestamp' }),
  lastSyncVersion: text('last_sync_version'),
});

// ============================================================================
// USER PREFERENCES (Local only)
// ============================================================================

/**
 * Local user preferences that don't need to sync.
 */
export const userPreferences = sqliteTable('user_preferences', {
  key: text('key').primaryKey(),
  value: text('value').notNull(), // JSON stringified
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;

export type ChatSession = typeof chatSessions.$inferSelect;
export type NewChatSession = typeof chatSessions.$inferInsert;

export type LearningDeck = typeof learningDecks.$inferSelect;
export type NewLearningDeck = typeof learningDecks.$inferInsert;

export type FsrsState = typeof fsrsState.$inferSelect;
export type NewFsrsState = typeof fsrsState.$inferInsert;

export type PendingAction = typeof pendingActions.$inferSelect;
export type NewPendingAction = typeof pendingActions.$inferInsert;

export type SyncMetadata = typeof syncMetadata.$inferSelect;
export type NewSyncMetadata = typeof syncMetadata.$inferInsert;

export type UserPreference = typeof userPreferences.$inferSelect;
export type NewUserPreference = typeof userPreferences.$inferInsert;
