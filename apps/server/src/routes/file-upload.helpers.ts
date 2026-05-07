import type { User } from '../types/auth.types.js';
import type { EducationLevelType } from '../types/education.types.js';

// ============================================================================
// Configuration
// ============================================================================

export const SUPPORTED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
  pdf: ['application/pdf'],
  document: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain'
  ],
  audio: [
    'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg',
    'audio/wav', 'audio/x-wav', 'audio/mp3',
    'audio/aac', 'audio/flac', 'audio/aiff', 'audio/x-aiff'
  ]
} as const;

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (Scaleway optimal)

// ============================================================================
// Types
// ============================================================================

export interface PresignedUploadResponse {
  success: boolean;
  fileId?: string;
  uploadUrl?: string;
  storageKey?: string;
  expiresAt?: string;
  error?: string;
}

export interface ConfirmUploadResponse {
  success: boolean;
  fileId?: string;
  /** Pre-fetched STT transcription for audio uploads. Empty for images / PDFs. */
  transcription?: string;
  error?: string;
}

// ============================================================================
// Helpers
// ============================================================================

export function detectFileType(mimeType: string): 'image' | 'pdf' | 'document' | 'audio' | 'unknown' {
  const cleanMimeType = mimeType.split(';')[0]?.trim();
  for (const [type, mimeTypes] of Object.entries(SUPPORTED_MIME_TYPES)) {
    if (mimeTypes.includes(cleanMimeType as never)) {
      return type as 'image' | 'pdf' | 'document' | 'audio';
    }
  }
  return 'unknown';
}

export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '_')
    .replace(/^\./, '_')
    .slice(0, 255);
}

export function buildEducationalContext(user: User, context?: string) {
  const schoolLevel = (user.schoolLevel ?? 'seconde') as EducationLevelType;
  return {
    subject: context ?? 'analyse-generale',
    level: schoolLevel,
    userId: user.id,
  };
}
