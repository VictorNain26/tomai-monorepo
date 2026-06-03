/**
 * Session cleanup helpers
 *
 * Extracted from ChatSessionService to keep the main service under the 400-line limit.
 * Handles the cascade deletion of a study session and all its attached resources
 * (Scaleway files, DB file records, messages).
 */

import { eq } from 'drizzle-orm';
import { studySessionsRepository, messagesRepository, filesRepository } from '../../db/repositories';
import { db } from '../../db/connection';
import { messages } from '../../db/schema';
import { safeUUID } from '../../utils/uuid';
import { logger } from '../../lib/observability';
import { deleteFile as deleteScalewayFile } from '../storage/scaleway-storage.service.js';

/**
 * Delete a study session + its messages + any files attached via messages.
 * When `userId` is provided, verifies session ownership before deleting (IDOR protection).
 */
export async function deleteSessionCascade(sessionId: string, userId?: string): Promise<void> {
  try {
    const validSessionId = safeUUID(sessionId);
    if (!validSessionId) {
      throw new Error(`Invalid session UUID: "${sessionId}"`);
    }

    if (userId) {
      const session = await studySessionsRepository.findById(validSessionId);
      if (!session || session.userId !== userId) {
        throw new Error('Session not found or access denied');
      }
    }

    const sessionMessages = await messagesRepository.findBySessionId(validSessionId);

    const fileIds: string[] = [];
    for (const msg of sessionMessages) {
      if (msg.attachedFile && typeof msg.attachedFile === 'object' && 'fileId' in msg.attachedFile) {
        const fileId = (msg.attachedFile as { fileId?: string }).fileId;
        if (fileId) fileIds.push(fileId);
      }
    }

    if (fileIds.length > 0) {
      logger.info('Deleting files associated with session', {
        operation: 'chat:session:delete:files',
        sessionId: validSessionId,
        fileCount: fileIds.length,
      });

      for (const fileId of fileIds) {
        const file = await filesRepository.findById(fileId);
        if (file) {
          await deleteScalewayFile(file.storageKey);
          await filesRepository.hardDelete(fileId);
        }
      }
    }

    await db.delete(messages).where(eq(messages.sessionId, validSessionId));
    await studySessionsRepository.deleteById(validSessionId);

    logger.info('Session deleted successfully', {
      operation: 'chat:session:delete',
      sessionId: validSessionId,
      filesDeleted: fileIds.length,
    });
  } catch (_error) {
    logger.error('Error deleting session', {
      operation: 'chat:session:delete',
      _error: _error instanceof Error ? _error.message : String(_error),
      sessionId,
      severity: 'medium' as const,
    });
    throw new Error('Failed to delete session', { cause: _error });
  }
}
