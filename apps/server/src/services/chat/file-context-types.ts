import type { EducationLevelType } from '../../types/index.js';

export interface AttachedFileInfo {
  fileName: string;
  fileId?: string;
  /**
   * Public Scaleway URL or signed URL when the file is accessible via HTTPS.
   * Used by Mistral vision (image_url field). When undefined, the multimodal
   * pipeline falls back to inline base64.
   */
  fileUrl?: string;
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

export interface MultimodalFile {
  /** Public HTTPS URL — preferred for Mistral image_url. */
  fileUrl?: string;
  /** Inline base64 fallback when no public URL is available. */
  base64?: string;
  mimeType: string;
  contentType: 'image' | 'document';
  fileName: string;
}
