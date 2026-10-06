/**
 * Files Repository - Data access layer pour la table files
 * Gestion des métadonnées fichiers stockés sur Scaleway Object Storage
 */

import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import { db } from '../../db/connection.js';
import { files, type FileStatus } from './files.schema.js';

// Types inférés du schéma
type File = typeof files.$inferSelect;
type NewFile = typeof files.$inferInsert;

class FilesRepository {
  /**
   * Créer un nouveau fichier
   */
  async create(fileData: NewFile): Promise<File> {
    const [createdFile] = await db.insert(files).values(fileData).returning();

    if (!createdFile) {
      throw new Error('Failed to create file record');
    }

    return createdFile;
  }

  /**
   * Trouver un fichier par ID
   */
  async findById(id: string): Promise<File | undefined> {
    const [file] = await db.select().from(files).where(eq(files.id, id)).limit(1);

    return file;
  }

  /** The given files that belong to the user and finished uploading; any other id is left out. */
  async findReadyOwnedBy(userId: string, ids: readonly string[]): Promise<File[]> {
    if (ids.length === 0) return [];
    return await db
      .select()
      .from(files)
      .where(and(inArray(files.id, [...ids]), eq(files.userId, userId), eq(files.status, 'ready')));
  }

  /**
   * Lister les fichiers d'un utilisateur
   */
  async findByUserId(userId: string, limit = 50): Promise<File[]> {
    return await db
      .select()
      .from(files)
      .where(and(eq(files.userId, userId), eq(files.status, 'ready')))
      .orderBy(desc(files.createdAt))
      .limit(limit);
  }

  /**
   * Lister tous les fichiers d'un utilisateur, tous statuts confondus (y
   * compris 'deleted' : pour un effacement de compte, tout objet S3 restant
   * doit être purgé). Utilisé avant la suppression pour collecter les clés.
   */
  async listByUserId(userId: string): Promise<Pick<File, 'id' | 'storageKey'>[]> {
    return await db.select({ id: files.id, storageKey: files.storageKey }).from(files).where(eq(files.userId, userId));
  }

  /**
   * Mettre à jour le statut d'un fichier
   */
  async updateStatus(id: string, status: FileStatus): Promise<File | undefined> {
    const [updatedFile] = await db
      .update(files)
      .set({
        status,
        updatedAt: sql`NOW()`,
      })
      .where(eq(files.id, id))
      .returning();

    return updatedFile;
  }

  /**
   * Supprimer un fichier (hard delete)
   */
  async hardDelete(id: string): Promise<boolean> {
    const result = await db.delete(files).where(eq(files.id, id)).returning();

    return result.length > 0;
  }

  /**
   * Marquer un fichier comme uploadé (après confirmation presigned URL)
   */
  async confirmUpload(id: string, sizeBytes?: number): Promise<File | undefined> {
    const updateData: Partial<NewFile> = {
      status: 'uploaded',
      updatedAt: new Date(),
    };

    if (sizeBytes !== undefined) {
      updateData.sizeBytes = sizeBytes;
    }

    const [updatedFile] = await db.update(files).set(updateData).where(eq(files.id, id)).returning();

    return updatedFile;
  }

  /**
   * Merge arbitrary keys into the JSONB educationalContext column (SQL-level merge
   * to avoid read-modify-write races). Used to persist the STT transcription and the text
   * extracted from the file.
   * Returns false when no row matched (file deleted meanwhile).
   */
  async mergeEducationalContext(id: string, patch: Record<string, unknown>): Promise<boolean> {
    const updated = await db
      .update(files)
      .set({
        educationalContext: sql`COALESCE(${files.educationalContext}, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb`,
        updatedAt: sql`NOW()`,
      })
      .where(eq(files.id, id))
      .returning({ id: files.id });

    return updated.length > 0;
  }
}

export const filesRepository = new FilesRepository();
