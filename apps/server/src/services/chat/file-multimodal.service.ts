import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/connection.js';
import { files } from '../../db/schema.js';
import { filesRepository } from '../../db/repositories/index.js';
import { scalewayStorageService } from '../storage/scaleway-storage.service.js';
import { logger } from '../../lib/observability.js';
import type { DocumentAnalysisResult } from '../document/index.js';
import type { MultimodalFile } from './file-context-types.js';

/**
 * Prepare the multimodal payload for the chat call. For each attached file:
 *
 * - Image : encode the bytes inline as base64 (Mistral vision accepts
 *           `data:<mime>;base64,...` URLs in the `image_url` content part).
 * - Document : reuse the OCR'd text stored in `educationalContext.extractedText`
 *              at upload time. We don't re-extract here to keep the chat path
 *              fast; if extraction was skipped, the document just won't appear
 *              in the multimodal payload (the document-analysis pipeline takes
 *              over via the chat enrichment path).
 *
 * Replaces the Gemini Files cache layer (TTL 48h, 2-step polling upload). With
 * Mistral there is no equivalent API, so we re-encode from Scaleway on every
 * turn. Cost is dominated by Mistral inference, not the upstream bandwidth.
 */
export async function prepareMultimodalFiles(fileIds: string[]): Promise<MultimodalFile[]> {
  if (!fileIds || fileIds.length === 0) {
    return [];
  }

  const result: MultimodalFile[] = [];

  for (const fileId of fileIds) {
    try {
      const file = await filesRepository.findById(fileId);
      if (!file) continue;

      const isImage = file.mimeType.startsWith('image/');
      const contentType: 'image' | 'document' = isImage ? 'image' : 'document';

      if (isImage) {
        const content = await scalewayStorageService.getFileContent(file.storageKey);
        if (!content) continue;
        result.push({
          fileName: file.fileName,
          mimeType: file.mimeType,
          contentType,
          base64: content.content.toString('base64'),
        });
        continue;
      }

      // Document path: reuse the OCR'd text that was cached at upload time. The
      // chat path already injects analysisContext separately via file-context;
      // we mirror extractedText here for callers that want the raw OCR
      // (text-only embedding into a system message).
      const eduContext = (file.educationalContext ?? {}) as {
        extractedText?: string;
      };
      if (eduContext.extractedText) {
        result.push({
          fileName: file.fileName,
          mimeType: file.mimeType,
          contentType,
          extractedText: eduContext.extractedText,
        });
      }
    } catch (error) {
      logger.warn('Failed to prepare multimodal file', {
        fileId,
        error: error instanceof Error ? error.message : String(error),
        operation: 'prepare-multimodal',
      });
    }
  }

  return result;
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
