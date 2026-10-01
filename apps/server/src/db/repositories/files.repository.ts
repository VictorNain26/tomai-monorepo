/**
 * Files Repository - Data access layer pour la table files
 * Gestion des métadonnées fichiers stockés sur Scaleway Object Storage
 */

import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import { db } from '../connection.js';
import { files, type FileStatus } from '../schema.js';

// Types inférés du schéma
export type File = typeof files.$inferSelect;
type NewFile = typeof files.$inferInsert;

class FilesRepository {
  /**
   * Créer un nouveau fichier
   */
  async create(fileData: NewFile): Promise<File> {
    const [createdFile] = await db
      .insert(files)
      .values(fileData)
      .returning();

    if (!createdFile) {
      throw new Error('Failed to create file record');
    }

    return createdFile;
  }

  /**
   * Trouver un fichier par ID
   */
  async findById(id: string): Promise<File | undefined> {
    const [file] = await db
      .select()
      .from(files)
      .where(eq(files.id, id))
      .limit(1);

    return file;
  }

  /**
   * Trouver plusieurs fichiers par leurs IDs (un seul SELECT)
   */
  async findByIds(ids: string[]): Promise<File[]> {
    if (ids.length === 0) return [];
    return await db
      .select()
      .from(files)
      .where(inArray(files.id, ids));
  }

  /**
   * Trouver un fichier par storageKey
   */
  async findByStorageKey(storageKey: string): Promise<File | undefined> {
    const [file] = await db
      .select()
      .from(files)
      .where(eq(files.storageKey, storageKey))
      .limit(1);

    return file;
  }

  /**
   * Lister les fichiers d'un utilisateur
   */
  async findByUserId(userId: string, limit = 50): Promise<File[]> {
    return await db
      .select()
      .from(files)
      .where(and(
        eq(files.userId, userId),
        eq(files.status, 'ready')
      ))
      .orderBy(desc(files.createdAt))
      .limit(limit);
  }

  /**
   * Lister tous les fichiers d'un utilisateur, tous statuts confondus (y
   * compris 'deleted' : pour un effacement de compte, tout objet S3 restant
   * doit être purgé). Utilisé avant la suppression pour collecter les clés.
   */
  async listByUserId(userId: string): Promise<Pick<File, 'id' | 'storageKey'>[]> {
    return await db
      .select({ id: files.id, storageKey: files.storageKey })
      .from(files)
      .where(eq(files.userId, userId));
  }

  /**
   * Mettre à jour le statut d'un fichier
   */
  async updateStatus(id: string, status: FileStatus): Promise<File | undefined> {
    const [updatedFile] = await db
      .update(files)
      .set({
        status,
        updatedAt: sql`NOW()`
      })
      .where(eq(files.id, id))
      .returning();

    return updatedFile;
  }

  /**
   * Marquer un fichier comme supprimé (soft delete)
   */
  async softDelete(id: string): Promise<File | undefined> {
    return await this.updateStatus(id, 'deleted');
  }

  /**
   * Supprimer un fichier (hard delete)
   */
  async hardDelete(id: string): Promise<boolean> {
    const result = await db
      .delete(files)
      .where(eq(files.id, id))
      .returning();

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

    const [updatedFile] = await db
      .update(files)
      .set(updateData)
      .where(eq(files.id, id))
      .returning();

    return updatedFile;
  }

  /**
   * Merge arbitrary keys into the JSONB educationalContext column (SQL-level merge
   * to avoid read-modify-write races). Used to persist STT transcription, OCR
   * extraction snippets, and document analysis caches on the file record.
   */
  async mergeEducationalContext(id: string, patch: Record<string, unknown>): Promise<void> {
    await db
      .update(files)
      .set({
        educationalContext: sql`COALESCE(${files.educationalContext}, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb`,
        updatedAt: sql`NOW()`,
      })
      .where(eq(files.id, id));
  }
}

export const filesRepository = new FilesRepository();
