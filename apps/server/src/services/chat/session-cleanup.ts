/**
 * Session cleanup helpers
 *
 * Extracted from ChatSessionService to keep the main service under the 400-line limit.
 * Handles the cascade deletion of a study session and all its attached resources
 * (Scaleway files, DB file records, messages).
 */

import { eq } from 'drizzle-orm';
import { studySessionsRepository, messagesRepository } from '../../db/repositories';
import { filesRepository, deleteFile as deleteScalewayFile } from '../../modules/documents/index.js';
import { db } from '../../db/connection';
import { messages } from '../../db/schema';
import { logger } from '../../platform/observability/logger';

/**
 * Delete a study session + its messages + any files attached via messages.
 * When `userId` is provided, verifies session ownership before deleting (IDOR protection).
 */
export async function deleteSessionCascade(sessionId: string, userId?: string): Promise<void> {
  try {
    if (userId) {
      const session = await studySessionsRepository.findById(sessionId);
      if (!session || session.userId !== userId) {
        throw new Error('Session not found or access denied');
      }
    }

    const sessionMessages = await messagesRepository.findBySessionId(sessionId);

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
        sessionId,
        fileCount: fileIds.length,
      });

      for (const fileId of fileIds) {
        const file = await filesRepository.findById(fileId);
        if (!file) continue;
        // A failed S3 delete keeps the row: it still lists the file in the
        // student's classeur and lets the account purge reach the object.
        if (await deleteScalewayFile(file.storageKey)) {
          await filesRepository.hardDelete(fileId);
        } else {
          logger.warn('File kept after a failed storage delete', {
            operation: 'chat:session:delete:files',
            sessionId,
            fileId,
          });
        }
      }
    }

    await db.delete(messages).where(eq(messages.sessionId, sessionId));
    await studySessionsRepository.deleteById(sessionId);

    logger.info('Session deleted successfully', {
      operation: 'chat:session:delete',
      sessionId,
      filesDeleted: fileIds.length,
    });
  } catch (_error) {
    logger.error('Error deleting session', {
      operation: 'chat:session:delete',
      err: _error,
      sessionId,
      severity: 'medium' as const,
    });
    throw new Error('Failed to delete session', { cause: _error });
  }
}
