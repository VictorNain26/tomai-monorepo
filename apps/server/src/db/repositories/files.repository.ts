/**
 * Files Repository - Data access layer pour la table files
 * Gestion des métadonnées fichiers stockés sur Scaleway Object Storage
 */

import { eq, and, sql, lt, desc, inArray } from 'drizzle-orm';
import { db } from '../connection.js';
import { files, type FileStatus } from '../schema.js';

// Types inférés du schéma
export type File = typeof files.$inferSelect;
export type NewFile = typeof files.$inferInsert;

export class FilesRepository {
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
   * Mettre à jour les infos Gemini d'un fichier
   */
  async updateGeminiInfo(id: string, geminiFileUri: string, geminiExpiresAt: Date): Promise<File | undefined> {
    const [updatedFile] = await db
      .update(files)
      .set({
        geminiFileUri,
        geminiExpiresAt,
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
   * Trouver les fichiers expirés (Gemini expiré + status ready)
   * Utile pour le cleanup automatique
   */
  async findExpiredGeminiFiles(limit = 100): Promise<File[]> {
    return await db
      .select()
      .from(files)
      .where(and(
        eq(files.status, 'ready'),
        lt(files.geminiExpiresAt, sql`NOW()`)
      ))
      .limit(limit);
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
}

export const filesRepository = new FilesRepository();
