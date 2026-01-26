/**
 * Database Module Exports
 *
 * Centralized exports for offline-first SQLite database.
 */

// Client and initialization
export { db, initializeDatabase, clearDatabase, getDatabaseStats } from './client';

// Schema and types
export * from './schema';

// Sync operations
export {
  queueAction,
  getPendingActions,
  getPendingActionsCount,
  removePendingAction,
  syncPendingActions,
  getLastSyncTime,
  updateLastSyncTime,
  getConflicts,
  resolveConflict,
} from './sync';
