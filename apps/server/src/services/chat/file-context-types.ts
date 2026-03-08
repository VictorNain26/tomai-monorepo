import type { EducationLevelType } from '../../types/index.js';

export interface AttachedFileInfo {
  fileName: string;
  fileId?: string;
  geminiFileId?: string;
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
  fileUri?: string;
  base64?: string;
  mimeType: string;
  contentType: 'image' | 'document';
  fileName: string;
}
