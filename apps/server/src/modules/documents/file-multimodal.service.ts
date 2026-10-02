import { filesRepository } from './files.repository.js';
import * as storage from './storage.js';
import { logger } from '../../platform/observability/logger.js';
import type { DocumentAnalysisResult } from './document-types.js';
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
 * Mistral has no equivalent of Gemini Files API (TTL 48h, 2-step polling upload),
 * so we re-encode from Scaleway on every
 * turn. Cost is dominated by Mistral inference, not the upstream bandwidth.
 */
export async function prepareMultimodalFiles(fileIds: string[]): Promise<MultimodalFile[]> {
  if (fileIds.length === 0) {
    return [];
  }

  const records = await filesRepository.findByIds(fileIds);
  const result: MultimodalFile[] = [];

  for (const fileId of fileIds) {
    const file = records.find((f) => f.id === fileId);
    if (!file) continue;
    try {
      const isImage = file.mimeType.startsWith('image/');
      const contentType: 'image' | 'document' = isImage ? 'image' : 'document';

      if (isImage) {
        const content = await storage.getFileContent(file.storageKey);
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
        err: error,
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
    const saved = await filesRepository.mergeEducationalContext(fileId, {
      analysisContext: result.analysis,
      extractedText: result.extraction.text,
      documentType: result.classification.documentType,
      subject: result.classification.subject,
      classification: result.classification,
      metrics: result.metrics,
    });
    if (!saved) return;

    logger.info('File analysis saved to DB', {
      fileId,
      documentType: result.classification.documentType,
      operation: 'update-file-analysis',
    });
  } catch (error) {
    logger.warn('Failed to update file analysis in DB', {
      err: error,
      fileId,
      operation: 'update-file-analysis',
    });
  }
}
