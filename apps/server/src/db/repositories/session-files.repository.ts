/**
 * Session Files Repository - Pivot table sessions ↔ files
 * Gère l'attachement de fichiers du classeur aux sessions de chat
 */

import { eq, and } from 'drizzle-orm';
import { db } from '../connection.js';
import { sessionFiles, files } from '../schema.js';

export class SessionFilesRepository {
  /**
   * Attacher un fichier à une session (idempotent)
   */
  async attach(sessionId: string, fileId: string): Promise<void> {
    await db
      .insert(sessionFiles)
      .values({ sessionId, fileId })
      .onConflictDoNothing();
  }

  /**
   * Détacher un fichier d'une session
   */
  async detach(sessionId: string, fileId: string): Promise<boolean> {
    const result = await db
      .delete(sessionFiles)
      .where(
        and(
          eq(sessionFiles.sessionId, sessionId),
          eq(sessionFiles.fileId, fileId)
        )
      )
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
      .where(
        and(
          eq(sessionFiles.sessionId, sessionId),
          eq(files.status, 'ready')
        )
      );

    return rows;
  }

  /**
   * Lister les fichiers attachés avec contexte éducatif (pour injection AI)
   */
  async findBySessionWithContext(sessionId: string) {
    const rows = await db
      .select({
        fileId: files.id,
        fileName: files.fileName,
        mimeType: files.mimeType,
        educationalContext: files.educationalContext,
        geminiFileUri: files.geminiFileUri,
        geminiExpiresAt: files.geminiExpiresAt,
      })
      .from(sessionFiles)
      .innerJoin(files, eq(sessionFiles.fileId, files.id))
      .where(
        and(
          eq(sessionFiles.sessionId, sessionId),
          eq(files.status, 'ready')
        )
      );

    return rows;
  }

  /**
   * Vérifier si un fichier est attaché à une session
   */
  async isAttached(sessionId: string, fileId: string): Promise<boolean> {
    const rows = await db
      .select({ id: sessionFiles.id })
      .from(sessionFiles)
      .where(
        and(
          eq(sessionFiles.sessionId, sessionId),
          eq(sessionFiles.fileId, fileId)
        )
      )
      .limit(1);

    return rows.length > 0;
  }

  /**
   * Compter les fichiers attachés à une session
   */
  async countBySession(sessionId: string): Promise<number> {
    const rows = await db
      .select({ id: sessionFiles.id })
      .from(sessionFiles)
      .where(eq(sessionFiles.sessionId, sessionId));

    return rows.length;
  }
}

export const sessionFilesRepository = new SessionFilesRepository();
