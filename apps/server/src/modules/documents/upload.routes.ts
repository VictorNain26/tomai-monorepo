import { Hono } from 'hono';
import { z } from 'zod';
import { requireUser, validate, type AppEnv } from '../../platform/http/context.js';
import { logger } from '../../platform/observability/logger.js';
import * as storage from './storage.js';
import { getVoxtralTranscribeService } from '../voice/index.js';
import { filesRepository } from './files.repository.js';
import { env } from '../../platform/config/env.js';
import {
  MAX_FILE_SIZE,
  detectFileType,
  sanitizeFileName,
} from './upload.helpers.js';

const presignBody = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  sizeBytes: z.number().min(1).max(MAX_FILE_SIZE),
  context: z.string().max(500).optional(),
});

const fileParams = z.object({ fileId: z.uuid() });

// Mounted under /api/upload by app.ts; every route needs a signed-in user.
export const uploadRoutes = new Hono<AppEnv>()
  .use(requireUser)

  /**
   * GET /api/upload/status - Vérifier si le service est configuré
   * Requires authentication to prevent unauthorized storage service discovery
   */
  .get('/status', (c) => {
    const configured = storage.isConfigured();
    return c.json({
      configured,
      provider: 'scaleway',
      region: env.SCALEWAY_REGION,
      maxFileSize: MAX_FILE_SIZE,
    });
  })

  /**
   * POST /api/upload/presign - Générer URL présignée pour upload direct
   */
  .post('/presign', validate('json', presignBody), async (c) => {
    const user = c.var.user;
    const body = c.req.valid('json');
    try {
      // Auth with strict DB validation (prevents orphan session reuse)
      const { fileName, mimeType, sizeBytes, context } = body;

      // Validate file type
      const fileType = detectFileType(mimeType);
      if (fileType === 'unknown') {
        return c.json({ success: false, error: 'Unsupported file type' }, 400);
      }

      // Validate size
      if (sizeBytes > MAX_FILE_SIZE) {
        return c.json({
          success: false,
          error: `File too large. Maximum: ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        }, 400);
      }

      // Check Scaleway is configured
      if (!storage.isConfigured()) {
        return c.json({ success: false, error: 'Storage service not configured' }, 503);
      }

      // Generate presigned URL
      const sanitizedName = sanitizeFileName(fileName);
      const presignedResult = await storage.generatePresignedUploadUrl({
        userId: user.id,
        fileName: sanitizedName,
        mimeType,
        sizeBytes,
      });

      // Create file record in DB (status: pending)
      const fileRecord = await filesRepository.create({
        userId: user.id,
        fileName: sanitizedName,
        mimeType,
        sizeBytes,
        storageKey: presignedResult.storageKey,
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

      return c.json({
        success: true,
        fileId: fileRecord.id,
        uploadUrl: presignedResult.uploadUrl,
        storageKey: presignedResult.storageKey,
        expiresAt: presignedResult.expiresAt.toISOString(),
      });

    } catch (error) {
      logger.error('Presign URL generation failed', {
        err: error,
        operation: 'file:presign',
        severity: 'high' as const,
      });
      return c.json({ success: false, error: 'Failed to generate upload URL' }, 500);
    }
  })

  /**
   * POST /api/upload/confirm/:fileId - Confirmer upload terminé
   *
   * Frontend appelle cet endpoint APRÈS avoir uploadé vers Scaleway
   * Backend vérifie le fichier et enregistre les métadonnées en base
   */
  .post('/confirm/:fileId', validate('param', fileParams), async (c) => {
    const user = c.var.user;
    const { fileId } = c.req.valid('param');
    try {
      // Auth with strict DB validation (prevents orphan session reuse)

      // Get file record
      const fileRecord = await filesRepository.findById(fileId);
      if (!fileRecord) {
        return c.json({ success: false, error: 'File not found' }, 404);
      }

      // Verify ownership
      if (fileRecord.userId !== user.id) {
        return c.json({ success: false, error: 'Access denied' }, 403);
      }

      // Verify file exists in Scaleway
      const fileInfo = await storage.getFileInfo(fileRecord.storageKey);
      if (!fileInfo) {
        return c.json({ success: false, error: 'File not found in storage' }, 400);
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
          const fileContent = await storage.getFileContent(fileRecord.storageKey);
          if (fileContent) {
            const transcriptionResult = await getVoxtralTranscribeService().transcribe(fileContent.content, fileContent.contentType, { userId: user.id });

            if (transcriptionResult.success && transcriptionResult.transcription) {
              transcription = transcriptionResult.transcription;
              await filesRepository.mergeEducationalContext(fileId, {
                transcription: transcriptionResult.transcription,
                transcribedAt: new Date().toISOString(),
              });
            }
          }
        } catch (err) {
          logger.warn('Audio transcription failed (non-blocking)', {
            err: err,
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

      return c.json({
        success: true,
        fileId,
        transcription,
      });

    } catch (error) {
      logger.error('Upload confirmation failed', {
        err: error,
        operation: 'file:confirm',
        fileId,
        severity: 'high' as const,
      });
      return c.json({ success: false, error: 'Failed to confirm upload' }, 500);
    }
  })

  /**
   * GET /api/upload/file/:fileId - Obtenir URL de téléchargement
   */
  .get('/file/:fileId', validate('param', fileParams), async (c) => {
    const user = c.var.user;
    const { fileId } = c.req.valid('param');
    try {
      const fileRecord = await filesRepository.findById(fileId);

      if (!fileRecord) {
        return c.json({ success: false, error: 'File not found' }, 404);
      }

      if (fileRecord.userId !== user.id) {
        return c.json({ success: false, error: 'Access denied' }, 403);
      }

      const downloadResult = await storage.generatePresignedDownloadUrl(
        fileRecord.storageKey
      );

      return c.json({
        success: true,
        downloadUrl: downloadResult.downloadUrl,
        expiresAt: downloadResult.expiresAt.toISOString(),
        fileName: fileRecord.fileName,
        mimeType: fileRecord.mimeType,
        sizeBytes: fileRecord.sizeBytes,
      });

    } catch (error) {
      logger.error('Download URL generation failed', {
        err: error,
        operation: 'file:download',
        fileId,
        severity: 'medium' as const,
      });
      return c.json({ success: false, error: 'Failed to generate download URL' }, 500);
    }
  })

  /**
   * DELETE /api/upload/file/:fileId - Supprimer un fichier
   */
  .delete('/file/:fileId', validate('param', fileParams), async (c) => {
    const user = c.var.user;
    const { fileId } = c.req.valid('param');
    try {
      const fileRecord = await filesRepository.findById(fileId);

      if (!fileRecord) {
        return c.json({ success: false, error: 'File not found' }, 404);
      }

      if (fileRecord.userId !== user.id) {
        return c.json({ success: false, error: 'Access denied' }, 403);
      }

      // The row is the only reference to the object: keep it until the object is
      // gone, so a failed S3 delete can be retried instead of orphaning it.
      if (!(await storage.deleteFile(fileRecord.storageKey))) {
        return c.json({ success: false, error: 'Failed to delete file' }, 500);
      }

      await filesRepository.hardDelete(fileId);

      logger.info('File deleted', {
        operation: 'file:delete',
        fileId,
        userId: user.id,
        storageKey: fileRecord.storageKey,
      });

      return c.json({ success: true, fileId });

    } catch (error) {
      logger.error('File deletion failed', {
        err: error,
        operation: 'file:delete',
        fileId,
        severity: 'medium' as const,
      });
      return c.json({ success: false, error: 'Failed to delete file' }, 500);
    }
  });
