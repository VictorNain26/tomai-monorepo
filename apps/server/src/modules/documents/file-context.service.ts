import { filesRepository } from './files.repository.js';
import { sessionFilesRepository } from './session-files.repository.js';
import * as storage from './storage.js';
import { documentExtractionService } from './document-extraction.service.js';
import { logger } from '../../platform/observability/logger.js';
import type { AttachedFileInfo, AttachedFileForPrompt } from './file-context-types.js';

// The attached texts of a turn share this budget, the newest files served first: the same files
// get the same cut from one turn to the next, which keeps them in the cached prefix.
const MAX_ATTACHED_CHARS = 50_000;
const CUT = '\n\n[Contenu tronqué]';
/** Stands for a file whose text could not be read, so the tutor knows it was sent. */
export const UNREADABLE = '[Fichier illisible : son contenu n’a pas pu être lu.]';

interface Readable {
  id: string;
  fileName: string;
  mimeType: string;
  storageKey: string;
  educationalContext: unknown;
}

function bounded(files: AttachedFileForPrompt[]): AttachedFileForPrompt[] {
  let left = MAX_ATTACHED_CHARS;
  return files
    .toReversed()
    .map((file) => {
      if (file.text.length <= left) {
        left -= file.text.length;
        return file;
      }
      const text = left > 0 ? `${file.text.slice(0, left)}${CUT}` : CUT.trim();
      left = 0;
      return { ...file, text };
    })
    .toReversed();
}

class FileContextService {
  /** The text of a file, read once and kept on its record; a failed read is kept too, and not tried again. */
  private async textOf(file: Readable, owner: { userId: string; sessionId: string }): Promise<string> {
    const kept = file.educationalContext as { extractedText?: string; extractionFailed?: boolean } | null;
    if (kept?.extractedText) return kept.extractedText;
    if (kept?.extractionFailed) return UNREADABLE;

    const content = await storage.getFileContent(file.storageKey);
    if (!content) {
      logger.error('Failed to retrieve file from storage', { fileId: file.id, operation: 'file-extraction', severity: 'medium' as const });
      return UNREADABLE;
    }
    const bytes = content.content;
    const extraction = await documentExtractionService.extractText(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      file.mimeType,
      owner,
    );
    if (!extraction.success) {
      logger.warn('File text not extracted', { fileId: file.id, method: extraction.metadata.extractionMethod, operation: 'file-extraction' });
    }
    await filesRepository
      .mergeEducationalContext(
        file.id,
        extraction.success
          ? { extractedText: extraction.text, extractionMethod: extraction.metadata.extractionMethod, wordCount: extraction.metadata.wordCount }
          : { extractionFailed: true },
      )
      .catch((err: unknown) => {
        logger.warn('Extraction result not saved', { fileId: file.id, err, operation: 'file-extraction' });
      });
    return extraction.success ? extraction.text : UNREADABLE;
  }

  /**
   * The texts of the session's files, in the order they were attached, then of this turn's: only
   * the user's own files that finished uploading. A file sent again with the turn counts as the
   * turn's; a session file never read, attached from the binder, is read now.
   */
  async prepareFileContext(params: { fileIds: string[]; userId: string; sessionId: string }): Promise<{
    /** The turn's files the user may attach: their own, uploaded, each once. */
    fileIds: string[];
    attachedFileInfos: AttachedFileInfo[];
    files: AttachedFileForPrompt[];
  }> {
    const { userId, sessionId } = params;
    const requested = [...new Set(params.fileIds)];
    const [records, attached] = await Promise.all([
      filesRepository.findReadyOwnedBy(userId, requested),
      sessionFilesRepository.findBySessionWithContext(sessionId).catch((err: unknown) => {
        logger.error('Session files not loaded, the turn goes on without them', {
          sessionId,
          err,
          operation: 'file-context',
          severity: 'medium' as const,
        });
        return [];
      }),
    ]);
    const turnFiles = requested.flatMap((id) => records.filter((f) => f.id === id));
    const turnIds = new Set(turnFiles.map((f) => f.id));
    const sessionFiles: Readable[] = attached.filter((f) => !turnIds.has(f.fileId)).map((f) => ({ ...f, id: f.fileId }));

    // One at a time: several multi-MB images in parallel would hammer Mistral.
    const texts: AttachedFileForPrompt[] = [];
    for (const file of [...sessionFiles, ...turnFiles]) {
      texts.push({ fileId: file.id, fileName: file.fileName, text: await this.textOf(file, { userId, sessionId }) });
    }

    return {
      fileIds: turnFiles.map((f) => f.id),
      attachedFileInfos: turnFiles.map((f) => ({ fileName: f.fileName, fileId: f.id, mimeType: f.mimeType, fileSizeBytes: f.sizeBytes })),
      files: bounded(texts),
    };
  }
}

export const fileContextService = new FileContextService();
