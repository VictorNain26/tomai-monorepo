/**
 * usePresignedUpload Hook - React Native
 *
 * Upload de fichiers vers Scaleway S3 via URLs présignées.
 * Flow: presign → upload direct → confirm
 */

import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient, UPLOAD_CONFIG } from '@repo/api';

// ============================================================================
// TYPES (aligned with backend apps/server/src/routes/file-upload.routes.ts)
// ============================================================================

/** Backend detectFileType return values */
export type FileType = 'image' | 'pdf' | 'document' | 'audio' | 'unknown';

export interface FileAttachment {
  fileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  type: FileType;
  preview?: string;
  geminiFileId?: string;
  transcription?: string;
}

/** Backend PresignedUploadResponse */
interface PresignResponse {
  success: boolean;
  fileId?: string;
  uploadUrl?: string;
  storageKey?: string;
  expiresAt?: string; // ISO string (Date from backend)
  error?: string;
}

/** Backend ConfirmUploadResponse */
interface ConfirmResponse {
  success: boolean;
  fileId?: string;
  fileUri?: string;
  geminiExpiresAt?: string; // ISO string (Date from backend)
  transcription?: string;
  error?: string;
}

interface UploadOptions {
  context?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Detect file type from MIME type (matches backend logic) */
function detectFileType(mimeType: string): FileType {
  const cleanMimeType = mimeType.split(';')[0]?.trim() ?? '';

  if (cleanMimeType.startsWith('image/')) return 'image';
  if (cleanMimeType === 'application/pdf') return 'pdf';
  if (cleanMimeType.startsWith('audio/')) return 'audio';
  if (
    cleanMimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    cleanMimeType === 'application/msword' ||
    cleanMimeType === 'text/plain'
  ) {
    return 'document';
  }
  return 'unknown';
}

function validateFile(
  mimeType: string,
  sizeBytes: number
): { valid: boolean; error?: string } {
  if (sizeBytes > UPLOAD_CONFIG.maxSize) {
    return {
      valid: false,
      error: `Fichier trop volumineux (max ${UPLOAD_CONFIG.maxSize / 1024 / 1024}MB)`,
    };
  }

  if (!UPLOAD_CONFIG.allowedTypes.includes(mimeType as (typeof UPLOAD_CONFIG.allowedTypes)[number])) {
    return {
      valid: false,
      error: 'Type de fichier non supporté',
    };
  }

  return { valid: true };
}

// ============================================================================
// HOOK
// ============================================================================

export function usePresignedUpload() {
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Get presigned URL
  const presignMutation = useMutation({
    mutationFn: async (params: {
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      context?: string;
    }): Promise<PresignResponse> => {
      return apiClient.post('/api/upload/presign', params);
    },
  });

  // Step 3: Confirm upload
  const confirmMutation = useMutation({
    mutationFn: async (fileId: string): Promise<ConfirmResponse> => {
      return apiClient.post(`/api/upload/confirm/${fileId}`, {});
    },
  });

  const uploadFile = useCallback(
    async (
      uri: string,
      fileName: string,
      mimeType: string,
      options: UploadOptions = {}
    ): Promise<FileAttachment | null> => {
      setError(null);
      setIsProcessing(true);

      try {
        // Get file info from URI
        const response = await fetch(uri);
        if (!response.ok) {
          throw new Error('Impossible de lire le fichier');
        }
        const blob = await response.blob();
        const sizeBytes = blob.size;

        // Validate
        const validation = validateFile(mimeType, sizeBytes);
        if (!validation.valid) {
          setError(validation.error ?? 'Fichier invalide');
          return null;
        }

        // Step 1: Get presigned URL
        const presignResult = await presignMutation.mutateAsync({
          fileName,
          mimeType,
          sizeBytes,
          context: options.context,
        });

        // Check presign response
        if (!presignResult.success || !presignResult.uploadUrl || !presignResult.fileId) {
          throw new Error(presignResult.error ?? 'Échec de la génération de l\'URL d\'upload');
        }

        // Step 2: Upload directly to S3
        const uploadResponse = await fetch(presignResult.uploadUrl, {
          method: 'PUT',
          body: blob,
          headers: {
            'Content-Type': mimeType,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error('Upload vers le stockage échoué');
        }

        // Step 3: Confirm upload
        const confirmResult = await confirmMutation.mutateAsync(presignResult.fileId);

        // Check confirm response
        if (!confirmResult.success) {
          throw new Error(confirmResult.error ?? 'Échec de la confirmation de l\'upload');
        }

        // Create attachment object
        const fileType = detectFileType(mimeType);
        const attachment: FileAttachment = {
          fileId: presignResult.fileId,
          fileName,
          mimeType,
          sizeBytes,
          type: fileType,
          preview: fileType === 'image' ? uri : undefined,
          geminiFileId: confirmResult.fileUri,
          transcription: confirmResult.transcription,
        };

        setFiles((prev) => [...prev, attachment]);
        return attachment;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erreur lors de l'upload";
        setError(message);
        return null;
      } finally {
        setIsProcessing(false);
      }
    },
    [presignMutation, confirmMutation]
  );

  const removeFile = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.fileId !== fileId));
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    files,
    isProcessing:
      isProcessing ||
      presignMutation.isPending ||
      confirmMutation.isPending,
    error,
    uploadFile,
    removeFile,
    clearFiles,
    clearError,
  };
}
