/**
 * Multimodal file preparation for the Mistral chat pipeline.
 *
 * Mistral has no server-side persistent files API.
 * Each chat turn that needs vision either:
 *   1. Receives a public HTTPS URL (Scaleway presigned), OR
 *   2. Receives the raw bytes inline as base64 in the message.
 *
 * We try (1) first because it keeps message payloads small and lets Mistral
 * fetch the asset directly. We fall back to (2) when Scaleway can't expose the
 * object publicly (private bucket, presign disabled, etc.).
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/connection.js';
import { files } from '../../db/schema.js';
import { filesRepository } from '../../db/repositories/index.js';
import { scalewayStorageService } from '../storage/scaleway-storage.service.js';
import { logger } from '../../lib/observability.js';
import type { DocumentAnalysisResult } from '../document/index.js';
import type { MultimodalFile } from './file-context-types.js';

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour — covers a single chat turn comfortably.

export async function prepareMultimodalFiles(fileIds: string[]): Promise<MultimodalFile[]> {
  if (!fileIds || fileIds.length === 0) {
    return [];
  }

  const out: MultimodalFile[] = [];

  for (const fileId of fileIds) {
    try {
      const file = await filesRepository.findById(fileId);
      if (!file) continue;

      const isImage = file.mimeType.startsWith('image/');
      const contentType: 'image' | 'document' = isImage ? 'image' : 'document';

      const multimodalFile: MultimodalFile = {
        mimeType: file.mimeType,
        contentType,
        fileName: file.fileName,
      };

      // Prefer a public URL: smaller payload, Mistral fetches directly.
      const publicUrl = await tryPublicUrl(file.storageKey);
      if (publicUrl) {
        multimodalFile.fileUrl = publicUrl;
      } else {
        const content = await scalewayStorageService.getFileContent(file.storageKey);
        if (!content) continue;
        multimodalFile.base64 = content.content.toString('base64');
      }

      out.push(multimodalFile);
    } catch (error) {
      logger.warn('Failed to prepare multimodal file', {
        fileId,
        error: error instanceof Error ? error.message : String(error),
        operation: 'prepare-multimodal',
      });
    }
  }

  return out;
}

async function tryPublicUrl(storageKey: string): Promise<string | null> {
  type StorageWithSign = {
    getPresignedDownloadUrl?: (key: string, ttl?: number) => Promise<string | null>;
  };
  const storage = scalewayStorageService as unknown as StorageWithSign;
  if (typeof storage.getPresignedDownloadUrl !== 'function') {
    return null;
  }
  try {
    return await storage.getPresignedDownloadUrl(storageKey, SIGNED_URL_TTL_SECONDS);
  } catch (err) {
    logger.debug('Presigned download URL unavailable, falling back to base64', {
      operation: 'prepare-multimodal:presign-fallback',
      _error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function updateFileAnalysis(
  fileId: string,
  result: DocumentAnalysisResult,
): Promise<void> {
  try {
    const file = await filesRepository.findById(fileId);
    if (!file) return;

    const existingContext = (file.educationalContext ?? {}) as Record<string, unknown>;
    const updatedContext = {
      ...existingContext,
      analysisContext: result.analysis,
      extractedText: result.extraction.text,
      documentType: result.classification.documentType,
      subject: result.classification.subject,
      hadRAG: !!result.rag?.found,
      classification: result.classification,
      ragContext: result.rag?.context,
      metrics: result.metrics,
    };

    await db
      .update(files)
      .set({
        educationalContext: sql`${JSON.stringify(updatedContext)}::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(files.id, fileId));

    logger.info('File analysis saved to DB', {
      fileId,
      documentType: result.classification.documentType,
      operation: 'update-file-analysis',
    });
  } catch (error) {
    logger.warn('Failed to update file analysis in DB', {
      error: error instanceof Error ? error.message : String(error),
      fileId,
      operation: 'update-file-analysis',
    });
  }
}
