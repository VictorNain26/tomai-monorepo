/**
 * File Types - Upload et gestion de fichiers
 */

export type FileType = 'image' | 'pdf' | 'document';

export interface IFileAttachment {
  file: File;
  type: FileType;
  preview?: string; // Base64 preview for images
  fileId?: string; // ID unique pour récupération lors du message
  geminiFileId?: string; // Gemini Files API ID for large files (>20MB)
  // Note: L'analyse se fait maintenant côté backend lors de l'envoi du message
  metadata?: {
    fileName: string;
    size: number;
    mimeType?: string;
    hash: string;
    uploadedAt: string;
    userId: string;
    schoolLevel: string;
  };
}

export interface IFileUploadResult {
  success: boolean;
  fileType: FileType;
  fileId?: string; // ID unique pour récupérer le fichier lors du message
  geminiFileId?: string; // ID from Gemini Files API (legacy)
  metadata?: {
    fileId: string;
    fileName: string;
    size: number;
    type: string;
    hash: string;
    uploadedAt: string;
    userId: string;
    schoolLevel: string;
    [key: string]: unknown;
  };
  error?: string;
}

export interface IFileProcessingOptions {
  maxSize?: number;
  allowedTypes?: string[];
  enablePreview?: boolean;
  useGeminiFiles?: boolean; // Auto for files >20MB
  analysisContext?: string;
}
