import { Elysia, t } from 'elysia';
import { authMacro } from '../lib/auth-macro.js';
import { logger } from '../lib/observability.js';
import { scalewayStorageService } from '../services/storage/scaleway-storage.service.js';
import { audioTranscriptionService } from '../services/audio-transcription.service.js';
import { filesRepository } from '../db/repositories/index.js';
import { env } from '../config/env.js';
import type { EducationLevelType } from '../types/education.types.js';
import {
  MAX_FILE_SIZE,
  detectFileType,
  sanitizeFileName,
  buildEducationalContext,
} from './file-upload.helpers.js';

;

export const fileUploadRoutes = new Elysia({ prefix: '/api/upload' })
  .use(authMacro)
  .guard({ auth: true })

  /**
   * GET /api/upload/status - Vérifier si le service est configuré
   * Requires authentication to prevent unauthorized storage service discovery
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
  .post('/presign', async ({ body, user, status }) => {
    try {
      // Auth with strict DB validation (prevents orphan session reuse)
      const { fileName, mimeType, sizeBytes, context } = body;

      // Validate file type
      const fileType = detectFileType(mimeType);
      if (fileType === 'unknown') {
        return status(400, { success: false, error: 'Unsupported file type' });
      }

      // Validate size
      if (sizeBytes > MAX_FILE_SIZE) {
        return status(400, {
          success: false,
          error: `File too large. Maximum: ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        });
      }

      // Check Scaleway is configured
      if (!scalewayStorageService.isConfigured()) {
        return status(503, { success: false, error: 'Storage service not configured' });
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
      };

    } catch (error) {
      logger.error('Presign URL generation failed', {
        _error: error instanceof Error ? error.message : String(error),
        operation: 'file:presign',
        severity: 'high' as const,
      });
      return status(500, { success: false, error: 'Failed to generate upload URL' });
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
  .post('/confirm/:fileId', async ({ params: { fileId }, user, status }) => {
    try {
      // Auth with strict DB validation (prevents orphan session reuse)

      // Get file record
      const fileRecord = await filesRepository.findById(fileId);
      if (!fileRecord) {
        return status(404, { success: false, error: 'File not found' });
      }

      // Verify ownership
      if (fileRecord.userId !== user.id) {
        return status(403, { success: false, error: 'Access denied' });
      }

      // Verify file exists in Scaleway
      const fileInfo = await scalewayStorageService.getFileInfo(fileRecord.storageKey);
      if (!fileInfo) {
        return status(400, { success: false, error: 'File not found in storage' });
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

      let transcription: string | undefined;

      // Audio: transcription via Voxtral STT (Mistral) at upload time so the chat
      // path doesn't have to wait for STT on every turn. Images and PDFs are sent
      // back to Mistral inline (base64 / OCR text) by file-multimodal at chat
      // time — no separate upload step, no external file cache.
      if (fileType === 'audio') {
        try {
          const fileContent = await scalewayStorageService.getFileContent(fileRecord.storageKey);
          if (fileContent) {
            const transcriptionResult = await audioTranscriptionService.transcribeAudio(
              fileContent.content.buffer as ArrayBuffer,
              fileContent.contentType,
              {
                targetLanguage: 'fr',
                schoolLevel: user.schoolLevel as EducationLevelType,
              }
            );

            if (transcriptionResult.success && transcriptionResult.transcription) {
              transcription = transcriptionResult.transcription;
              await filesRepository.mergeEducationalContext(fileId, {
                transcription: transcriptionResult.transcription,
                detectedLanguage: transcriptionResult.detectedLanguage,
                transcribedAt: new Date().toISOString(),
              });
            }
          }
        } catch (err) {
          logger.warn('Audio transcription failed (non-blocking)', {
            _error: err instanceof Error ? err.message : String(err),
            operation: 'file:transcription',
            fileId,
          });
        }
      }

      await filesRepository.updateStatus(fileId, 'ready');

      logger.info('File processing complete', {
        operation: 'file:ready',
        fileId,
        fileType,
        hasTranscription: !!transcription,
      });

      return {
        success: true,
        fileId,
        transcription,
      };

    } catch (error) {
      logger.error('Upload confirmation failed', {
        _error: error instanceof Error ? error.message : String(error),
        operation: 'file:confirm',
        fileId,
        severity: 'high' as const,
      });
      return status(500, { success: false, error: 'Failed to confirm upload' });
    }
  }, {
    params: t.Object({
      fileId: t.String({ format: 'uuid' }),
    }),
  })

  /**
   * GET /api/upload/file/:fileId - Obtenir URL de téléchargement
   */
  .get('/file/:fileId', async ({ params: { fileId }, user, status }) => {
    try {
      const fileRecord = await filesRepository.findById(fileId);

      if (!fileRecord) {
        return status(404, { success: false, error: 'File not found' });
      }

      if (fileRecord.userId !== user.id) {
        return status(403, { success: false, error: 'Access denied' });
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
      return status(500, { success: false, error: 'Failed to generate download URL' });
    }
  }, {
    params: t.Object({
      fileId: t.String({ format: 'uuid' }),
    }),
  })

  /**
   * DELETE /api/upload/file/:fileId - Supprimer un fichier
   */
  .delete('/file/:fileId', async ({ params: { fileId }, user, status }) => {
    try {
      const fileRecord = await filesRepository.findById(fileId);

      if (!fileRecord) {
        return status(404, { success: false, error: 'File not found' });
      }

      if (fileRecord.userId !== user.id) {
        return status(403, { success: false, error: 'Access denied' });
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
      return status(500, { success: false, error: 'Failed to delete file' });
    }
  }, {
    params: t.Object({
      fileId: t.String({ format: 'uuid' }),
    }),
  });
