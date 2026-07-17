/**
 * SQLite Database Client
 *
 * Initializes expo-sqlite with Drizzle ORM for offline-first support.
 * Uses LAZY INITIALIZATION to avoid crash before React Native bridge is ready.
 *
 * Best Practice 2026: expo-sqlite + Drizzle ORM with WAL mode and proper migrations.
 * @see https://docs.expo.dev/versions/latest/sdk/sqlite/
 * @see https://orm.drizzle.team/docs/connect-expo-sqlite
 */

import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';
import * as schema from './schema';

// ============================================================================
// CONSTANTS
// ============================================================================

const DATABASE_NAME = 'tomia.db';
const CURRENT_DB_VERSION = 1;

// ============================================================================
// LAZY DATABASE INSTANCE
// ============================================================================

/**
 * Lazy-initialized database instances.
 * CRITICAL: Do NOT initialize at module level - causes crash before RN bridge is ready.
 */
let _expo: SQLiteDatabase | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Get the raw expo-sqlite database instance.
 * Lazy-initializes on first call.
 */
function getExpo(): SQLiteDatabase {
  if (!_expo) {
    _expo = openDatabaseSync(DATABASE_NAME, {
      enableChangeListener: true,
    });
  }
  return _expo;
}

/**
 * Get the Drizzle ORM client.
 * Lazy-initializes on first call.
 */
export function getDatabase() {
  if (!_db) {
    _db = drizzle(getExpo(), { schema });
  }
  return _db;
}

// ============================================================================
// MIGRATIONS
// ============================================================================

/**
 * Get current database version using PRAGMA user_version.
 */
function getDatabaseVersion(): number {
  const expo = getExpo();
  const result = expo.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  return result?.user_version ?? 0;
}

/**
 * Set database version using PRAGMA user_version.
 */
function setDatabaseVersion(version: number): void {
  const expo = getExpo();
  expo.execSync(`PRAGMA user_version = ${version}`);
}

/**
 * Run migrations based on current database version.
 * Uses PRAGMA user_version to track schema versions.
 */
async function runMigrations(): Promise<void> {
  const currentVersion = getDatabaseVersion();
  console.log(`[DB] Current version: ${currentVersion}, target: ${CURRENT_DB_VERSION}`);

  if (currentVersion >= CURRENT_DB_VERSION) {
    console.log('[DB] Database is up to date');
    return;
  }

  const expo = getExpo();

  // Migration from version 0 to 1 (initial schema)
  if (currentVersion < 1) {
    console.log('[DB] Running migration v0 -> v1');

    expo.execSync(`
      -- Enable WAL mode for better performance (Expo best practice)
      PRAGMA journal_mode = WAL;

      -- Chat messages table
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        ai_model TEXT,
        attached_file_json TEXT,
        sync_status TEXT NOT NULL DEFAULT 'synced',
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      );

      -- Chat sessions table
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        subject TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      );

      -- Learning decks table
      CREATE TABLE IF NOT EXISTS learning_decks (
        id TEXT PRIMARY KEY,
        subject TEXT NOT NULL,
        topic TEXT,
        title TEXT,
        cards_json TEXT NOT NULL,
        cards_count INTEGER NOT NULL DEFAULT 0,
        sync_status TEXT NOT NULL DEFAULT 'synced',
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      );

      -- FSRS state table (spaced repetition)
      CREATE TABLE IF NOT EXISTS fsrs_state (
        id TEXT PRIMARY KEY,
        card_id TEXT NOT NULL,
        deck_id TEXT NOT NULL,
        state_json TEXT NOT NULL,
        due_date INTEGER,
        last_reviewed_at INTEGER,
        sync_status TEXT NOT NULL DEFAULT 'synced'
      );

      -- Pending actions queue (for offline sync)
      CREATE TABLE IF NOT EXISTS pending_actions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        retry_count INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 3,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        last_attempt_at INTEGER,
        error TEXT
      );

      -- Sync metadata table
      CREATE TABLE IF NOT EXISTS sync_metadata (
        resource_type TEXT PRIMARY KEY,
        last_sync_at INTEGER,
        last_sync_version TEXT
      );

      -- User preferences table (local only)
      CREATE TABLE IF NOT EXISTS user_preferences (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_sync ON chat_messages(sync_status);
      CREATE INDEX IF NOT EXISTS idx_learning_decks_subject ON learning_decks(subject);
      CREATE INDEX IF NOT EXISTS idx_learning_decks_sync ON learning_decks(sync_status);
      CREATE INDEX IF NOT EXISTS idx_fsrs_state_deck ON fsrs_state(deck_id);
      CREATE INDEX IF NOT EXISTS idx_fsrs_state_due ON fsrs_state(due_date);
      CREATE INDEX IF NOT EXISTS idx_pending_actions_type ON pending_actions(type);
    `);

    setDatabaseVersion(1);
    console.log('[DB] Migration v1 completed');
  }

  // Add future migrations here:
  // if (currentVersion < 2) { ... }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize database with migrations.
 * Call this at app startup BEFORE using the database.
 */
export async function initializeDatabase(): Promise<void> {
  // Pas de SQLite offline sur web : op-sqlite/expo-sqlite WASM requiert
  // SharedArrayBuffer (headers COOP/COEP). Le cache offline est une feature
  // mobile ; sur web on no-op proprement (le web a son propre cache réseau).
  if (Platform.OS === 'web') return;

  console.log('[DB] Initializing SQLite database...');

  try {
    await runMigrations();
    console.log('[DB] Database initialized successfully');
  } catch (error) {
    console.error('[DB] Initialization failed:', error);
    throw error;
  }
}

// ============================================================================
// DATA RESET
// ============================================================================

/**
 * Wipe all user-specific local data from SQLite.
 * Call on logout to prevent a different user on the same device from reading leftover data.
 */
export async function clearLocalData(): Promise<void> {
  try {
    const db = getDatabase();
    await db.delete(schema.chatMessages);
    await db.delete(schema.chatSessions);
    await db.delete(schema.learningDecks);
    await db.delete(schema.fsrsState);
    await db.delete(schema.pendingActions);
    await db.delete(schema.syncMetadata);
    await db.delete(schema.userPreferences);
  } catch (err) {
    console.warn('[DB] clearLocalData failed:', err);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

