/**
 * Routes File Upload - Scaleway Object Storage + PostgreSQL (RGPD France)
 *
 * Flow presigned URL (bypass backend pour gros fichiers):
 * 1. POST /api/upload/presign → Backend génère URL + enregistre en DB
 * 2. PUT direct vers Scaleway (frontend → storage)
 * 3. POST /api/upload/confirm/:fileId → Backend marque ready
 */

import { Elysia, t } from 'elysia';
import { auth } from '../lib/auth.js';
import { logger } from '../lib/observability.js';
import { scalewayStorageService } from '../services/storage/scaleway-storage.service.js';
import { geminiFilesService } from '../services/gemini-files.service.js';
import { audioTranscriptionService } from '../services/audio-transcription.service.js';
import { filesRepository } from '../db/repositories/index.js';
import { env } from '../config/environment.config.js';
import type { User } from '../types/auth.types.js';
import type { EducationLevelType } from '../types/education.types.js';

// ============================================================================
// Configuration
// ============================================================================

const SUPPORTED_MIME_TYPES = {
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

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (Scaleway optimal)

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
  fileUri?: string;
  geminiExpiresAt?: string;
  transcription?: string;
  error?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function detectFileType(mimeType: string): 'image' | 'pdf' | 'document' | 'audio' | 'unknown' {
  const cleanMimeType = mimeType.split(';')[0]?.trim();
  for (const [type, mimeTypes] of Object.entries(SUPPORTED_MIME_TYPES)) {
    if (mimeTypes.includes(cleanMimeType as never)) {
      return type as 'image' | 'pdf' | 'document' | 'audio';
    }
  }
  return 'unknown';
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '_')
    .replace(/^\./, '_')
    .slice(0, 255);
}

function buildEducationalContext(user: User, context?: string) {
  const schoolLevel = (user.schoolLevel ?? 'seconde') as EducationLevelType;
  return {
    subject: context ?? 'analyse-generale',
    level: schoolLevel,
    userId: user.id,
  };
}

// ============================================================================
// Routes
// ============================================================================

export const fileUploadRoutes = new Elysia({ prefix: '/api/upload' })

  /**
   * GET /api/upload/status - Vérifier si le service est configuré
   */
  .get('/status', () => {
    const configured = scalewayStorageService.isConfigured();
    return {
      configured,
      provider: 'scaleway',
      region: env.SCALEWAY_REGION ?? 'fr-par',
      maxFileSize: MAX_FILE_SIZE,
    };
  })

  /**
   * POST /api/upload/presign - Générer URL présignée pour upload direct
   */
  .post('/presign', async ({ body, request, set }) => {
    try {
      // Auth check
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session?.user) {
        set.status = 401;
        return { success: false, error: 'Authentication required' } as PresignedUploadResponse;
      }

      const user = session.user as User;
      const { fileName, mimeType, sizeBytes, context } = body;

      // Validate file type
      const fileType = detectFileType(mimeType);
      if (fileType === 'unknown') {
        set.status = 400;
        return { success: false, error: 'Unsupported file type' } as PresignedUploadResponse;
      }

      // Validate size
      if (sizeBytes > MAX_FILE_SIZE) {
        set.status = 400;
        return {
          success: false,
          error: `File too large. Maximum: ${MAX_FILE_SIZE / (1024 * 1024)}MB`
        } as PresignedUploadResponse;
      }

      // Check Scaleway is configured
      if (!scalewayStorageService.isConfigured()) {
        set.status = 503;
        return { success: false, error: 'Storage service not configured' } as PresignedUploadResponse;
      }

      // Generate presigned URL
      const sanitizedName = sanitizeFileName(fileName);
      const presignedResult = await scalewayStorageService.generatePresignedUploadUrl({
        userId: user.id,
        fileName: sanitizedName,
        mimeType,
        sizeBytes,
      });

      // Create file record in DB (status: pending)
      const educationalContext = buildEducationalContext(user, context);
      const fileRecord = await filesRepository.create({
        userId: user.id,
        fileName: sanitizedName,
        mimeType,
        sizeBytes,
        storageKey: presignedResult.storageKey,
        storageBucket: env.SCALEWAY_BUCKET ?? '',
        storageRegion: env.SCALEWAY_REGION ?? 'fr-par',
        educationalContext,
        status: 'pending',
        metadata: {
          originalFileName: fileName,
          fileType,
          context: context ?? null,
        },
      });

      logger.info('Presigned upload URL generated', {
        operation: 'file:presign',
        fileId: fileRecord.id,
        userId: user.id,
        mimeType,
        sizeBytes,
        storageKey: presignedResult.storageKey,
      });

      return {
        success: true,
        fileId: fileRecord.id,
        uploadUrl: presignedResult.uploadUrl,
        storageKey: presignedResult.storageKey,
        expiresAt: presignedResult.expiresAt.toISOString(),
      } as PresignedUploadResponse;

    } catch (error) {
      logger.error('Presign URL generation failed', {
        _error: error instanceof Error ? error.message : String(error),
        operation: 'file:presign',
        severity: 'high' as const,
      });
      set.status = 500;
      return { success: false, error: 'Failed to generate upload URL' } as PresignedUploadResponse;
    }
  }, {
    body: t.Object({
      fileName: t.String({ minLength: 1, maxLength: 255 }),
      mimeType: t.String({ minLength: 1, maxLength: 100 }),
      sizeBytes: t.Number({ minimum: 1, maximum: MAX_FILE_SIZE }),
      context: t.Optional(t.String({ maxLength: 500 })),
    }),
  })

  /**
   * POST /api/upload/confirm/:fileId - Confirmer upload terminé
   *
   * Frontend appelle cet endpoint APRÈS avoir uploadé vers Scaleway
   * Backend vérifie le fichier et lance l'upload vers Gemini Files API
   */
  .post('/confirm/:fileId', async ({ params: { fileId }, request, set }) => {
    try {
      // Auth check
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session?.user) {
        set.status = 401;
        return { success: false, error: 'Authentication required' } as ConfirmUploadResponse;
      }

      const user = session.user as User;

      // Get file record
      const fileRecord = await filesRepository.findById(fileId);
      if (!fileRecord) {
        set.status = 404;
        return { success: false, error: 'File not found' } as ConfirmUploadResponse;
      }

      // Verify ownership
      if (fileRecord.userId !== user.id) {
        set.status = 403;
        return { success: false, error: 'Access denied' } as ConfirmUploadResponse;
      }

      // Verify file exists in Scaleway
      const fileInfo = await scalewayStorageService.getFileInfo(fileRecord.storageKey);
      if (!fileInfo) {
        set.status = 400;
        return { success: false, error: 'File not found in storage' } as ConfirmUploadResponse;
      }

      // Update status to uploaded
      await filesRepository.confirmUpload(fileId, fileInfo.sizeBytes);

      logger.info('Upload confirmed', {
        operation: 'file:confirm',
        fileId,
        userId: user.id,
        sizeBytes: fileInfo.sizeBytes,
      });

      // Get file type from metadata
      const metadata = fileRecord.metadata as { fileType?: string } | null;
      const fileType = metadata?.fileType ?? detectFileType(fileRecord.mimeType);

      let geminiFileUri: string | undefined;
      let geminiExpiresAt: string | undefined;
      let transcription: string | undefined;

      // Process based on file type
      if (fileType === 'audio') {
        // Audio: transcription avec Gemini
        try {
          const fileContent = await scalewayStorageService.getFileContent(fileRecord.storageKey);
          if (fileContent) {
            const transcriptionResult = await audioTranscriptionService.transcribeAudio(
              fileContent.content.buffer as ArrayBuffer,
              fileContent.contentType,
              {
                targetLanguage: 'fr',
                schoolLevel: user.schoolLevel as EducationLevelType,
                context: 'general',
              }
            );

            if (transcriptionResult.success && transcriptionResult.transcription) {
              transcription = transcriptionResult.transcription;
            }
          }
        } catch (err) {
          logger.warn('Audio transcription failed (non-blocking)', {
            _error: err instanceof Error ? err.message : String(err),
            operation: 'file:transcription',
            fileId,
          });
        }
      } else if ((fileType === 'image' || fileType === 'pdf') && geminiFilesService.isAvailable()) {
        // Image/PDF: upload vers Gemini Files API (cache 48h)
        try {
          const fileContent = await scalewayStorageService.getFileContent(fileRecord.storageKey);
          if (fileContent) {
            const geminiResult = await geminiFilesService.uploadFile(
              fileContent.content.buffer as ArrayBuffer,
              fileContent.contentType,
              fileRecord.fileName
            );

            if (geminiResult.success && geminiResult.fileUri) {
              geminiFileUri = geminiResult.fileUri;
              geminiExpiresAt = geminiResult.expiresAt?.toISOString();

              // Update DB with Gemini info
              await filesRepository.updateGeminiInfo(
                fileId,
                geminiFileUri,
                geminiResult.expiresAt ?? new Date(Date.now() + 48 * 60 * 60 * 1000)
              );
            }
          }
        } catch (err) {
          logger.warn('Gemini Files upload failed (non-blocking)', {
            _error: err instanceof Error ? err.message : String(err),
            operation: 'file:gemini-upload',
            fileId,
          });
        }
      }

      // Mark as ready
      await filesRepository.updateStatus(fileId, 'ready');

      logger.info('File processing complete', {
        operation: 'file:ready',
        fileId,
        fileType,
        hasGeminiUri: !!geminiFileUri,
        hasTranscription: !!transcription,
      });

      return {
        success: true,
        fileId,
        fileUri: geminiFileUri,
        geminiExpiresAt,
        transcription,
      } as ConfirmUploadResponse;

    } catch (error) {
      logger.error('Upload confirmation failed', {
        _error: error instanceof Error ? error.message : String(error),
        operation: 'file:confirm',
        fileId,
        severity: 'high' as const,
      });
      set.status = 500;
      return { success: false, error: 'Failed to confirm upload' } as ConfirmUploadResponse;
    }
  }, {
    params: t.Object({
      fileId: t.String({ format: 'uuid' }),
    }),
  })

  /**
   * GET /api/upload/file/:fileId - Obtenir URL de téléchargement
   */
  .get('/file/:fileId', async ({ params: { fileId }, request, set }) => {
    try {
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session?.user) {
        set.status = 401;
        return { success: false, error: 'Authentication required' };
      }

      const user = session.user as User;
      const fileRecord = await filesRepository.findById(fileId);

      if (!fileRecord) {
        set.status = 404;
        return { success: false, error: 'File not found' };
      }

      if (fileRecord.userId !== user.id) {
        set.status = 403;
        return { success: false, error: 'Access denied' };
      }

      const downloadResult = await scalewayStorageService.generatePresignedDownloadUrl(
        fileRecord.storageKey
      );

      return {
        success: true,
        downloadUrl: downloadResult.downloadUrl,
        expiresAt: downloadResult.expiresAt.toISOString(),
        fileName: fileRecord.fileName,
        mimeType: fileRecord.mimeType,
        sizeBytes: fileRecord.sizeBytes,
      };

    } catch (error) {
      logger.error('Download URL generation failed', {
        _error: error instanceof Error ? error.message : String(error),
        operation: 'file:download',
        fileId,
        severity: 'medium' as const,
      });
      set.status = 500;
      return { success: false, error: 'Failed to generate download URL' };
    }
  }, {
    params: t.Object({
      fileId: t.String({ format: 'uuid' }),
    }),
  })

  /**
   * DELETE /api/upload/file/:fileId - Supprimer un fichier
   */
  .delete('/file/:fileId', async ({ params: { fileId }, request, set }) => {
    try {
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session?.user) {
        set.status = 401;
        return { success: false, error: 'Authentication required' };
      }

      const user = session.user as User;
      const fileRecord = await filesRepository.findById(fileId);

      if (!fileRecord) {
        set.status = 404;
        return { success: false, error: 'File not found' };
      }

      if (fileRecord.userId !== user.id) {
        set.status = 403;
        return { success: false, error: 'Access denied' };
      }

      // Delete from Scaleway
      await scalewayStorageService.deleteFile(fileRecord.storageKey);

      // Delete from DB
      await filesRepository.hardDelete(fileId);

      logger.info('File deleted', {
        operation: 'file:delete',
        fileId,
        userId: user.id,
        storageKey: fileRecord.storageKey,
      });

      return { success: true, fileId };

    } catch (error) {
      logger.error('File deletion failed', {
        _error: error instanceof Error ? error.message : String(error),
        operation: 'file:delete',
        fileId,
        severity: 'medium' as const,
      });
      set.status = 500;
      return { success: false, error: 'Failed to delete file' };
    }
  }, {
    params: t.Object({
      fileId: t.String({ format: 'uuid' }),
    }),
  });
