/**
 * Session Files Repository - Pivot table sessions ↔ files
 * Gère l'attachement de fichiers du classeur aux sessions de chat
 */

import { eq, and, asc, count } from 'drizzle-orm';
import { db } from '../../db/connection.js';
import { sessionFiles, files } from './files.schema.js';

class SessionFilesRepository {
  /**
   * Attacher un fichier à une session (idempotent)
   */
  async attach(sessionId: string, fileId: string): Promise<void> {
    await db.insert(sessionFiles).values({ sessionId, fileId }).onConflictDoNothing();
  }

  /**
   * Détacher un fichier d'une session
   */
  async detach(sessionId: string, fileId: string): Promise<boolean> {
    const result = await db
      .delete(sessionFiles)
      .where(and(eq(sessionFiles.sessionId, sessionId), eq(sessionFiles.fileId, fileId)))
      .returning();

    return result.length > 0;
  }

  /**
   * Lister les fichiers attachés à une session (avec infos fichier)
   */
  async findBySession(sessionId: string) {
    const rows = await db
      .select({
        id: sessionFiles.id,
        sessionId: sessionFiles.sessionId,
        fileId: sessionFiles.fileId,
        attachedAt: sessionFiles.attachedAt,
        fileName: files.fileName,
        mimeType: files.mimeType,
        sizeBytes: files.sizeBytes,
        status: files.status,
        createdAt: files.createdAt,
        educationalContext: files.educationalContext,
      })
      .from(sessionFiles)
      .innerJoin(files, eq(sessionFiles.fileId, files.id))
      .where(and(eq(sessionFiles.sessionId, sessionId), eq(files.status, 'ready')));

    return rows;
  }

  /** The session's files with their educational context, in the order they were attached: the prompt keeps them stable. */
  async findBySessionWithContext(sessionId: string) {
    const rows = await db
      .select({
        fileId: files.id,
        fileName: files.fileName,
        mimeType: files.mimeType,
        storageKey: files.storageKey,
        educationalContext: files.educationalContext,
      })
      .from(sessionFiles)
      .innerJoin(files, eq(sessionFiles.fileId, files.id))
      .where(and(eq(sessionFiles.sessionId, sessionId), eq(files.status, 'ready')))
      .orderBy(asc(sessionFiles.attachedAt), asc(sessionFiles.id));

    return rows;
  }

  /**
   * Compter les fichiers attachés à une session
   */
  async countBySession(sessionId: string): Promise<number> {
    const [row] = await db.select({ value: count() }).from(sessionFiles).where(eq(sessionFiles.sessionId, sessionId));

    return row?.value ?? 0;
  }
}

export const sessionFilesRepository = new SessionFilesRepository();
