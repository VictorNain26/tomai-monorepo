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
 * No Gemini Files cache layer: Mistral has no equivalent of Gemini's files
 * API, so every chat turn re-encodes the asset from Scaleway. Acceptable for
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
