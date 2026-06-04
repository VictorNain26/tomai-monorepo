/**
 * usePresignedUpload Hook - React Native
 *
 * Upload de fichiers vers Scaleway S3 via URLs présignées.
 * Flow: presign -> upload direct -> confirm
 */

import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { getTreaty, unwrap, UPLOAD_CONFIG, type ResponseData } from '@repo/api';

// ============================================================================
// TYPES — derived from the server contract (single source of truth)
// ============================================================================

type UploadApi = ReturnType<typeof getTreaty>['api']['upload'];

export type PresignResponse = ResponseData<UploadApi['presign']['post']>;
export type ConfirmResponse = ResponseData<ReturnType<UploadApi['confirm']>['post']>;

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

interface UploadOptions {
  context?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const presignMutation = useMutation({
    mutationFn: async (params: {
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      context?: string;
    }): Promise<PresignResponse> => {
      return unwrap(await getTreaty().api.upload.presign.post(params));
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (fileId: string): Promise<ConfirmResponse> => {
      return unwrap(await getTreaty().api.upload.confirm({ fileId }).post());
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
        const response = await fetch(uri);
        if (!response.ok) {
          throw new Error('Impossible de lire le fichier');
        }
        const blob = await response.blob();
        const sizeBytes = blob.size;

        const validation = validateFile(mimeType, sizeBytes);
        if (!validation.valid) {
          setError(validation.error ?? 'Fichier invalide');
          return null;
        }

        const presignResult = await presignMutation.mutateAsync({
          fileName,
          mimeType,
          sizeBytes,
          context: options.context,
        });

        // unwrap() already throws on error responses; fields are non-optional on success.
        const { uploadUrl, fileId } = presignResult;

        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: blob,
          headers: {
            'Content-Type': mimeType,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error('Upload vers le stockage échoué');
        }

        const confirmResult = await confirmMutation.mutateAsync(fileId);

        const fileType = detectFileType(mimeType);
        const attachment: FileAttachment = {
          fileId,
          fileName,
          mimeType,
          sizeBytes,
          type: fileType,
          preview: fileType === 'image' ? uri : undefined,
          transcription: confirmResult.transcription,
        };

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

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isProcessing:
      isProcessing ||
      presignMutation.isPending ||
      confirmMutation.isPending,
    error,
    uploadFile,
    clearError,
  };
}
