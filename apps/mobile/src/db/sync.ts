/**
 * Sync Service
 *
 * Handles synchronization between local SQLite and backend API.
 * Implements offline-first pattern with optimistic updates.
 *
 * Best Practice 2026: Queue pending actions and sync when online.
 */

import { eq } from 'drizzle-orm';
import { db } from './client';
import {
  pendingActions,
  syncMetadata,
  chatMessages,
  learningDecks,
  type PendingAction,
} from './schema';
import { getTreaty, unwrap } from '@repo/api';

// ============================================================================
// TYPES
// ============================================================================

type ActionType = PendingAction['type'];

interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

// ============================================================================
// PENDING ACTIONS QUEUE
// ============================================================================

/**
 * Add an action to the pending queue for later sync.
 */
export async function queueAction(
  type: ActionType,
  payload: Record<string, unknown>
): Promise<string> {
  const id = `action-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  await db.insert(pendingActions).values({
    id,
    type,
    payload: JSON.stringify(payload),
    retryCount: 0,
    maxRetries: 3,
    createdAt: new Date(),
  });

  console.log(`[Sync] Queued action: ${type}`);
  return id;
}

/**
 * Get all pending actions sorted by creation time.
 */
export async function getPendingActions(): Promise<PendingAction[]> {
  return db.select().from(pendingActions).orderBy(pendingActions.createdAt);
}

/**
 * Get count of pending actions.
 */
export async function getPendingActionsCount(): Promise<number> {
  const result = await db.select().from(pendingActions);
  return result.length;
}

/**
 * Remove a pending action after successful sync.
 */
export async function removePendingAction(id: string): Promise<void> {
  await db.delete(pendingActions).where(eq(pendingActions.id, id));
}

/**
 * Update retry count and error for a failed action.
 */
export async function markActionFailed(
  id: string,
  error: string
): Promise<void> {
  const action = await db.select().from(pendingActions).where(eq(pendingActions.id, id)).get();

  if (!action) return;

  const newRetryCount = action.retryCount + 1;

  if (newRetryCount >= action.maxRetries) {
    // Max retries reached - mark as permanently failed
    console.warn(`[Sync] Action ${id} failed permanently after ${newRetryCount} attempts`);
    await db.delete(pendingActions).where(eq(pendingActions.id, id));
  } else {
    await db
      .update(pendingActions)
      .set({
        retryCount: newRetryCount,
        lastAttemptAt: new Date(),
        error,
      })
      .where(eq(pendingActions.id, id));
  }
}

// ============================================================================
// SYNC OPERATIONS
// ============================================================================

/**
 * Process all pending actions and sync with backend.
 */
export async function syncPendingActions(): Promise<SyncResult> {
  const actions = await getPendingActions();

  if (actions.length === 0) {
    return { success: true, synced: 0, failed: 0, errors: [] };
  }

  console.log(`[Sync] Processing ${actions.length} pending actions...`);

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const action of actions) {
    try {
      const payload = JSON.parse(action.payload);
      await processAction(action.type, payload);

      await removePendingAction(action.id);
      synced++;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`${action.type}: ${errorMessage}`);
      await markActionFailed(action.id, errorMessage);
      failed++;
    }
  }

  console.log(`[Sync] Completed: ${synced} synced, ${failed} failed`);

  return {
    success: failed === 0,
    synced,
    failed,
    errors,
  };
}

/**
 * Process a single action based on type.
 */
async function processAction(
  type: ActionType,
  payload: Record<string, unknown>
): Promise<void> {
  switch (type) {
    case 'send_message':
      await syncSendMessage(payload);
      break;
    case 'create_deck':
      await syncCreateDeck(payload);
      break;
    case 'delete_deck':
      await syncDeleteDeck(payload);
      break;
    case 'update_fsrs':
      await syncUpdateFsrs(payload);
      break;
    case 'create_session':
      await syncCreateSession(payload);
      break;
    default:
      throw new Error(`Unknown action type: ${type}`);
  }
}

// ============================================================================
// SYNC HANDLERS
// ============================================================================

async function syncSendMessage(payload: Record<string, unknown>): Promise<void> {
  const { sessionId, content, subject, schoolLevel, firstName, fileIds } = payload;

  unwrap(
    await getTreaty().api.chat.stream.post({
      content: content as string,
      data: {
        sessionId: sessionId as string | undefined,
        subject: subject as string | undefined,
        schoolLevel: schoolLevel as string | undefined,
        firstName: firstName as string | undefined,
        fileIds: fileIds as string[] | undefined,
      },
    })
  );

  // Update local message sync status
  const localId = payload.localId as string;
  if (localId) {
    await db
      .update(chatMessages)
      .set({ syncStatus: 'synced' })
      .where(eq(chatMessages.id, localId));
  }
}

async function syncCreateDeck(payload: Record<string, unknown>): Promise<void> {
  const { subject, topic } = payload;

  const response = unwrap(
    await getTreaty().api.learning.decks.post({
      title: (topic as string) ?? 'Untitled',
      subject: subject as string,
      source: 'prompt' as const,
    })
  ) as { deck: { id: string } };

  const localId = payload.localId as string;
  if (localId && response.deck.id) {
    await db
      .update(learningDecks)
      .set({
        id: response.deck.id,
        syncStatus: 'synced',
      })
      .where(eq(learningDecks.id, localId));
  }
}

async function syncDeleteDeck(payload: Record<string, unknown>): Promise<void> {
  const { deckId } = payload;
  unwrap(await getTreaty().api.learning.decks({ id: deckId as string }).delete());
}

async function syncUpdateFsrs(payload: Record<string, unknown>): Promise<void> {
  const { cardId, state } = payload;
  unwrap(
    await getTreaty().api.learning.review.post({
      cardId: cardId as string,
      rating: (state as Record<string, unknown>).rating as number,
    })
  );
}

async function syncCreateSession(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  payload: Record<string, unknown>
): Promise<void> {
  unwrap(await getTreaty().api.chat.session.post());
}

// ============================================================================
// METADATA TRACKING
// ============================================================================

/**
 * Get last sync timestamp for a resource type.
 */
export async function getLastSyncTime(
  resourceType: 'chat_messages' | 'chat_sessions' | 'learning_decks' | 'fsrs_state'
): Promise<Date | null> {
  const result = await db
    .select()
    .from(syncMetadata)
    .where(eq(syncMetadata.resourceType, resourceType))
    .get();

  return result?.lastSyncAt ?? null;
}

/**
 * Update last sync timestamp for a resource type.
 */
export async function updateLastSyncTime(
  resourceType: 'chat_messages' | 'chat_sessions' | 'learning_decks' | 'fsrs_state'
): Promise<void> {
  await db
    .insert(syncMetadata)
    .values({
      resourceType,
      lastSyncAt: new Date(),
    })
    .onConflictDoUpdate({
      target: syncMetadata.resourceType,
      set: { lastSyncAt: new Date() },
    });
}

// ============================================================================
// CONFLICT RESOLUTION
// ============================================================================

/**
 * Get all items with sync conflicts.
 */
export async function getConflicts(): Promise<{
  messages: typeof chatMessages.$inferSelect[];
  decks: typeof learningDecks.$inferSelect[];
}> {
  const messages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.syncStatus, 'conflict'));

  const decks = await db
    .select()
    .from(learningDecks)
    .where(eq(learningDecks.syncStatus, 'conflict'));

  return { messages, decks };
}

/**
 * Resolve a conflict by choosing local or remote version.
 */
export async function resolveConflict(
  table: 'chat_messages' | 'learning_decks',
  id: string,
  resolution: 'local' | 'remote'
): Promise<void> {
  if (resolution === 'local') {
    // Keep local, mark for re-sync
    if (table === 'chat_messages') {
      await db
        .update(chatMessages)
        .set({ syncStatus: 'pending' })
        .where(eq(chatMessages.id, id));
    } else {
      await db
        .update(learningDecks)
        .set({ syncStatus: 'pending' })
        .where(eq(learningDecks.id, id));
    }
  } else {
    // Delete local, will be re-fetched
    if (table === 'chat_messages') {
      await db.delete(chatMessages).where(eq(chatMessages.id, id));
    } else {
      await db.delete(learningDecks).where(eq(learningDecks.id, id));
    }
  }
}
