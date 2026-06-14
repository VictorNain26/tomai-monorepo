import type { EducationLevelType } from '../../types/index.js';

export interface AttachedFileInfo {
  fileName: string;
  fileId?: string;
  mimeType?: string;
  fileSizeBytes?: number;
}

export interface FileAnalysisResult {
  analysis: string;
  extractedText?: string;
  fileName: string;
  documentType?: string;
  subject?: string;
  hadRAG?: boolean;
}

/**
 * A single attached-file analysis, ready to be wrapped in its own
 * `<attached_file>` block by wrapAttachedFiles. Kept SEPARATE from the
 * student message so the document body cannot be read as an instruction.
 */
export interface AttachedFileForPrompt {
  fileName: string;
  analysis: string;
  documentType?: string;
  subject?: string;
}

export interface FileAnalysisOptions {
  content?: string;
  schoolLevel: EducationLevelType;
  userId: string;
}

/**
 * File payload prepared for the chat multimodal pipeline.
 *
 * - Image    : `base64` data + `mimeType` for inline `image_url` parts.
 * - Document : `extractedText` (already OCRed via document-extraction.service)
 *              for plain-text injection in the system context.
 *
 * Mistral has no files cache API: every chat turn re-encodes the asset from
 * Scaleway. Acceptable for
 * the photo-of-exercise use case (small JPEG / PNG); PDFs go through text
 * extraction once at upload time and reuse the cached text on every turn.
 */
export interface MultimodalFile {
  fileName: string;
  mimeType: string;
  contentType: 'image' | 'document';
  base64?: string;
  extractedText?: string;
}
