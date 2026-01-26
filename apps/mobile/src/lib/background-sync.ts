/**
 * Background Sync Service
 *
 * Handles background synchronization of pending actions when the app is
 * in the background or closed.
 *
 * Best Practice 2026: expo-background-task (replaces deprecated expo-background-fetch)
 * @see https://docs.expo.dev/versions/latest/sdk/background-task/
 */

import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { syncPendingActions, getPendingActionsCount } from '@/db';
import { isOnline } from './query-client';

// ============================================================================
// CONSTANTS
// ============================================================================

const BACKGROUND_SYNC_TASK = 'TOMIA_BACKGROUND_SYNC';

// Minimum interval between background tasks (in minutes)
// iOS/Android: minimum is 15 minutes, actual interval decided by OS
const MIN_INTERVAL_MINUTES = 15;

// ============================================================================
// TASK DEFINITION
// ============================================================================

/**
 * Define the background sync task.
 * This MUST be called at the top level (outside any component).
 * expo-background-task requires global task definition.
 */
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  console.log('[BackgroundSync] Task started');

  try {
    // Check if we're online
    if (!isOnline()) {
      console.log('[BackgroundSync] Offline, skipping sync');
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    // Check if there are pending actions
    const pendingCount = await getPendingActionsCount();
    if (pendingCount === 0) {
      console.log('[BackgroundSync] No pending actions');
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    console.log(`[BackgroundSync] Syncing ${pendingCount} pending actions...`);

    // Sync pending actions
    const result = await syncPendingActions();

    if (result.synced > 0) {
      console.log(`[BackgroundSync] Synced ${result.synced} actions`);
    }

    if (result.failed > 0) {
      console.warn(`[BackgroundSync] ${result.failed} actions failed`);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }

    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.error('[BackgroundSync] Task error:', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

// ============================================================================
// REGISTRATION
// ============================================================================

/**
 * Register the background sync task with the system.
 * Should be called once at app startup.
 */
export async function registerBackgroundSync(): Promise<boolean> {
  try {
    // Check if background tasks are available
    const status = await BackgroundTask.getStatusAsync();

    if (status === BackgroundTask.BackgroundTaskStatus.Restricted) {
      console.warn('[BackgroundSync] Background tasks restricted on this device');
      return false;
    }

    // Check if already registered
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);

    if (isRegistered) {
      console.log('[BackgroundSync] Already registered');
      return true;
    }

    // Register with BackgroundTask
    await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: MIN_INTERVAL_MINUTES,
    });

    console.log('[BackgroundSync] Registered successfully');
    return true;
  } catch (error) {
    console.error('[BackgroundSync] Registration failed:', error);
    return false;
  }
}

/**
 * Unregister the background sync task.
 */
export async function unregisterBackgroundSync(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);

    if (isRegistered) {
      await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
      console.log('[BackgroundSync] Unregistered');
    }
  } catch (error) {
    console.error('[BackgroundSync] Unregistration failed:', error);
  }
}

// ============================================================================
// STATUS
// ============================================================================

/**
 * Check if background sync is registered.
 */
export async function isBackgroundSyncRegistered(): Promise<boolean> {
  try {
    return TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
  } catch {
    return false;
  }
}

/**
 * Get background task status.
 */
export async function getBackgroundSyncStatus(): Promise<{
  status: BackgroundTask.BackgroundTaskStatus;
  statusName: string;
  isRegistered: boolean;
}> {
  const status = await BackgroundTask.getStatusAsync();
  const isRegistered = await isBackgroundSyncRegistered();

  let statusName: string;
  switch (status) {
    case BackgroundTask.BackgroundTaskStatus.Restricted:
      statusName = 'Restricted';
      break;
    case BackgroundTask.BackgroundTaskStatus.Available:
      statusName = 'Available';
      break;
    default:
      statusName = 'Unknown';
  }

  return { status, statusName, isRegistered };
}

// ============================================================================
// MANUAL SYNC
// ============================================================================

/**
 * Trigger a manual sync (foreground).
 * Use this when the user pulls to refresh or app comes to foreground.
 */
export async function triggerManualSync(): Promise<{
  success: boolean;
  synced: number;
  failed: number;
}> {
  console.log('[BackgroundSync] Manual sync triggered');

  if (!isOnline()) {
    console.log('[BackgroundSync] Offline, cannot sync');
    return { success: false, synced: 0, failed: 0 };
  }

  const result = await syncPendingActions();

  return {
    success: result.failed === 0,
    synced: result.synced,
    failed: result.failed,
  };
}

// ============================================================================
// HOOK FOR COMPONENTS
// ============================================================================

import { useEffect, useState, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';

/**
 * Hook to manage background sync and trigger sync on app foreground.
 */
export function useBackgroundSync() {
  const [isRegistered, setIsRegistered] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{
    synced: number;
    failed: number;
  } | null>(null);

  // Register on mount
  useEffect(() => {
    registerBackgroundSync().then(setIsRegistered);
  }, []);

  // Sync when app comes to foreground
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        console.log('[BackgroundSync] App came to foreground, syncing...');
        await sync();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);

  const sync = useCallback(async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    try {
      const result = await triggerManualSync();
      setLastSyncResult({ synced: result.synced, failed: result.failed });
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  return {
    isRegistered,
    isSyncing,
    lastSyncResult,
    sync,
  };
}
