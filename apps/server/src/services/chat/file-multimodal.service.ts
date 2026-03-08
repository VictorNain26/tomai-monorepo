import { filesRepository } from '../../db/repositories/index.js';
import { scalewayStorageService } from '../storage/scaleway-storage.service.js';
import { geminiFilesService } from '../gemini-files.service.js';
import { logger } from '../../lib/observability.js';
import type { DocumentAnalysisResult } from '../document/index.js';
import type { MultimodalFile } from './file-context-types.js';

export async function prepareMultimodalFiles(fileIds: string[]): Promise<MultimodalFile[]> {
  if (!fileIds || fileIds.length === 0) {
    return [];
  }

  const files: MultimodalFile[] = [];

  for (const fileId of fileIds) {
    try {
      const file = await filesRepository.findById(fileId);
      if (!file) continue;

      const isImage = file.mimeType.startsWith('image/');
      const contentType: 'image' | 'document' = isImage ? 'image' : 'document';

      let fileUri = file.geminiFileUri ?? undefined;
      const isExpired = fileUri && file.geminiExpiresAt && file.geminiExpiresAt <= new Date();
      if (isExpired) {
        fileUri = undefined;
      }

      const multimodalFile: MultimodalFile = {
        mimeType: file.mimeType,
        contentType,
        fileName: file.fileName
      };

      if (fileUri) {
        multimodalFile.fileUri = fileUri;
      } else {
        const content = await scalewayStorageService.getFileContent(file.storageKey);
        if (!content) continue;

        const uploadResult = await geminiFilesService.uploadFile(
          content.content.buffer as ArrayBuffer,
          file.mimeType,
          file.fileName
        );

        if (uploadResult.success && uploadResult.fileUri && uploadResult.expiresAt) {
          multimodalFile.fileUri = uploadResult.fileUri;
          await filesRepository.updateGeminiInfo(
            file.id,
            uploadResult.fileUri,
            uploadResult.expiresAt
          );
          logger.info('Re-uploaded expired file to Gemini', {
            fileId, fileName: file.fileName, operation: 'prepare-multimodal'
          });
        } else {
          multimodalFile.base64 = content.content.toString('base64');
          logger.warn('Gemini re-upload failed, using base64 fallback', {
            fileId, error: uploadResult.error, operation: 'prepare-multimodal'
          });
        }
      }

      files.push(multimodalFile);
    } catch (error) {
      logger.warn('Failed to prepare multimodal file', {
        fileId,
        error: error instanceof Error ? error.message : String(error),
        operation: 'prepare-multimodal'
      });
    }
  }

  return files;
}

export async function updateFileAnalysis(fileId: string, result: DocumentAnalysisResult): Promise<void> {
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
      metrics: result.metrics
    };

    const { db, sql } = await import('../../db/repositories/index.js');
    const { files } = await import('../../db/schema.js');
    const { eq } = await import('drizzle-orm');

    await db.update(files)
      .set({
        educationalContext: sql`${JSON.stringify(updatedContext)}::jsonb`,
        updatedAt: new Date()
      })
      .where(eq(files.id, fileId));

    logger.info('File analysis saved to DB', {
      fileId,
      documentType: result.classification.documentType,
      operation: 'update-file-analysis'
    });
  } catch (error) {
    logger.warn('Failed to update file analysis in DB', {
      error: error instanceof Error ? error.message : String(error),
      fileId,
      operation: 'update-file-analysis'
    });
  }
}
