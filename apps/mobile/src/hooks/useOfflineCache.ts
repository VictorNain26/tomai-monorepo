/**
 * useOfflineCache — SQLite message caching for offline reading
 *
 * Caches chat messages and conversations locally for:
 * - Instant load (show cached while fetching from server)
 * - Offline reading (browse history without network)
 *
 * Does NOT handle offline sending (SSE streaming requires connection).
 */

import { useCallback } from 'react';
import { eq } from 'drizzle-orm';
import { getDatabase } from '@/db/client';
import { chatMessages } from '@/db/schema';
import type { ChatMessage } from './chat/types';

export function useOfflineCache() {
  /**
   * Cache messages from server into SQLite.
   * Called after successful history fetch.
   */
  const cacheMessages = useCallback(async (sessionId: string, messages: ChatMessage[]) => {
    try {
      const db = getDatabase();

      // Delete existing cached messages for this session
      await db.delete(chatMessages).where(eq(chatMessages.sessionId, sessionId));

      if (messages.length === 0) return;

      // Insert all messages
      await db.insert(chatMessages).values(
        messages.map(m => ({
          id: m.id,
          sessionId,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
          aiModel: m.aiModel ?? null,
          attachedFileJson: m.attachedFile ? JSON.stringify(m.attachedFile) : null,
          syncStatus: 'synced' as const,
          createdAt: new Date(),
        })),
      );
    } catch (err) {
      console.warn('[OfflineCache] Failed to cache messages:', err);
    }
  }, []);

  /**
   * Load cached messages from SQLite.
   * Returns null if no cache exists.
   */
  const getCachedMessages = useCallback(async (sessionId: string): Promise<ChatMessage[] | null> => {
    try {
      const db = getDatabase();
      const rows = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId))
        .orderBy(chatMessages.createdAt);

      if (rows.length === 0) return null;

      return rows.map(row => ({
        id: row.id,
        role: row.role,
        content: row.content,
        timestamp: row.timestamp,
        aiModel: row.aiModel,
        attachedFile: row.attachedFileJson ? JSON.parse(row.attachedFileJson) : null,
      }));
    } catch (err) {
      console.warn('[OfflineCache] Failed to load cached messages:', err);
      return null;
    }
  }, []);

  return {
    cacheMessages,
    getCachedMessages,
  };
}
