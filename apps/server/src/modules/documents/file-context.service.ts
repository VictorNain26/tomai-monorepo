import { filesRepository, type File as FileRecord } from './files.repository.js';
import { sessionFilesRepository } from './session-files.repository.js';
import * as storage from './storage.js';
import { documentExtractionService } from './document-extraction.service.js';
import { costTrackingService } from '../billing/index.js';
import { env } from '../../platform/config/env.js';
import { logger } from '../../platform/observability/logger.js';
import type { AttachedFileInfo, AttachedFileForPrompt } from './file-context-types.js';

// The attached texts of a turn share this budget, the files of the turn served first.
const MAX_ATTACHED_CHARS = 50_000;
const CUT = '\n\n[Contenu tronqué]';

const cachedText = (educationalContext: unknown) =>
  (educationalContext as { extractedText?: string } | null)?.extractedText ?? null;

/** Each text cut to what is left of the budget, in order. */
function bounded(files: AttachedFileForPrompt[], budget: number): { files: AttachedFileForPrompt[]; left: number } {
  let left = budget;
  const out = files.map((file) => {
    if (file.text.length <= left) {
      left -= file.text.length;
      return file;
    }
    const text = left > 0 ? `${file.text.slice(0, left)}${CUT}` : CUT.trim();
    left = 0;
    return { ...file, text };
  });
  return { files: out, left };
}

class FileContextService {
  /** The text of a file, read once and kept on its record; null when it cannot be read. */
  private async extractedText(file: FileRecord, owner: { userId: string; sessionId: string }): Promise<string | null> {
    const cached = cachedText(file.educationalContext);
    if (cached) return cached;

    const content = await storage.getFileContent(file.storageKey);
    if (!content) {
      logger.error('Failed to retrieve file from storage', { fileId: file.id, operation: 'file-extraction', severity: 'medium' as const });
      return null;
    }
    const bytes = content.content;
    const extraction = await documentExtractionService.extractText(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      file.mimeType,
      file.fileName,
    );
    const { usage } = extraction.metadata;
    if (usage) {
      void costTrackingService.record({
        ...owner,
        aiModel: env.MISTRAL_MODEL,
        operation: 'document-extraction',
        tokensInput: usage.inputTokens,
        tokensOutput: usage.outputTokens,
        cachedTokens: usage.cachedInputTokens,
      });
    }
    if (!extraction.success) {
      logger.warn('File text not extracted', { fileId: file.id, method: extraction.metadata.extractionMethod, operation: 'file-extraction' });
      return null;
    }

    await filesRepository
      .mergeEducationalContext(file.id, {
        extractedText: extraction.text,
        extractionMethod: extraction.metadata.extractionMethod,
        wordCount: extraction.metadata.wordCount,
      })
      .catch((err: unknown) => { logger.warn('Extracted text not saved', { fileId: file.id, err, operation: 'file-extraction' }); });
    return extraction.text;
  }

  /**
   * The texts of the files attached to the session before this turn, in the order they were
   * attached, and of the files of this turn, read now. A file sent again with the turn counts as
   * the turn's.
   */
  async prepareFileContext(params: { fileIds: string[]; userId: string; sessionId: string }): Promise<{
    attachedFileInfos: AttachedFileInfo[];
    sessionFiles: AttachedFileForPrompt[];
    turnFiles: AttachedFileForPrompt[];
  }> {
    const { fileIds, userId, sessionId } = params;
    const [records, attached] = await Promise.all([
      filesRepository.findByIds(fileIds),
      sessionFilesRepository.findBySessionWithContext(sessionId),
    ]);
    const ordered = fileIds
      .map((id) => records.find((f) => f.id === id))
      .filter((f): f is FileRecord => f !== undefined);

    // One at a time: several multi-MB images in parallel would hammer Mistral.
    const turnTexts: AttachedFileForPrompt[] = [];
    for (const file of ordered) {
      const text = await this.extractedText(file, { userId, sessionId });
      if (text) turnTexts.push({ fileId: file.id, fileName: file.fileName, text });
    }
    const sessionTexts = attached
      .filter((f) => !fileIds.includes(f.fileId))
      .flatMap((f) => {
        const text = cachedText(f.educationalContext);
        return text ? [{ fileId: f.fileId, fileName: f.fileName, text }] : [];
      });

    const turn = bounded(turnTexts, MAX_ATTACHED_CHARS);
    return {
      attachedFileInfos: ordered.map((file) => ({ fileName: file.fileName, fileId: file.id, mimeType: file.mimeType, fileSizeBytes: file.sizeBytes })),
      sessionFiles: bounded(sessionTexts, turn.left).files,
      turnFiles: turn.files,
    };
  }
}

export const fileContextService = new FileContextService();
