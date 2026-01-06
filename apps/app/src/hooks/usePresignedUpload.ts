/**
 * Hook Presigned Upload - Upload direct vers Scaleway
 *
 * Flow optimisé (bypasse le backend pour les gros fichiers):
 * 1. GET presigned URL depuis backend
 * 2. PUT direct vers Scaleway
 * 3. CONFIRM upload au backend
 *
 * @see https://github.com/aws/aws-sdk-js-v3/blob/main/packages/s3-request-presigner/README.md
 */

import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useUser } from '@/lib/auth';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import type { IFileAttachment, FileType } from '@/types';

// Types API
interface PresignedResponse {
  success: boolean;
  fileId?: string;
  uploadUrl?: string;
  storageKey?: string;
  expiresAt?: string;
  error?: string;
}

interface ConfirmResponse {
  success: boolean;
  fileId?: string;
  fileUri?: string;
  geminiExpiresAt?: string;
  transcription?: string;
  error?: string;
}

interface UsePresignedUploadReturn {
  files: IFileAttachment[];
  isProcessing: boolean;
  error: string | null;
  uploadFile: (file: File, options?: { context?: string }) => Promise<IFileAttachment | null>;
  removeFile: (index: number) => void;
  clearFiles: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const SUPPORTED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/mp3'
];

/**
 * Hook pour upload presigned vers Scaleway Object Storage
 */
export function usePresignedUpload(): UsePresignedUploadReturn {
  const [files, setFiles] = useState<IFileAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const user = useUser();

  // Step 1: Get presigned URL
  const presignMutation = useMutation({
    mutationKey: ['files', 'presign'] as const,
    mutationFn: async (params: {
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      context?: string;
    }): Promise<PresignedResponse> => {
      return apiClient.post('/api/upload/presign', params);
    },
  });

  // Step 3: Confirm upload
  const confirmMutation = useMutation({
    mutationKey: ['files', 'confirm'] as const,
    mutationFn: async (fileId: string): Promise<ConfirmResponse> => {
      return apiClient.post(`/api/upload/confirm/${fileId}`, {});
    },
  });

  const detectFileType = (mimeType: string): FileType => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
  };

  /**
   * Upload complet avec presigned URL
   */
  const uploadFile = useCallback(async (
    file: File,
    options: { context?: string } = {}
  ): Promise<IFileAttachment | null> => {
    setError(null);

    try {
      if (!user) {
        throw new Error('Vous devez être connecté pour uploader des fichiers');
      }

      // Validation locale
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`Fichier trop volumineux. Maximum: ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
      }

      if (!SUPPORTED_TYPES.includes(file.type)) {
        throw new Error('Type de fichier non supporté');
      }

      // Step 1: Obtenir presigned URL
      const presignResult = await presignMutation.mutateAsync({
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        context: options.context,
      });

      if (!presignResult.success || !presignResult.uploadUrl || !presignResult.fileId) {
        throw new Error(presignResult.error ?? 'Échec de la préparation de l\'upload');
      }

      // Step 2: Upload direct vers Scaleway (PUT)
      const uploadResponse = await fetch(presignResult.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
          'Content-Length': file.size.toString(),
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Échec de l'upload vers le stockage: ${uploadResponse.status}`);
      }

      // Step 3: Confirmer au backend
      const confirmResult = await confirmMutation.mutateAsync(presignResult.fileId);

      if (!confirmResult.success) {
        throw new Error(confirmResult.error ?? 'Échec de la confirmation');
      }

      // Créer l'attachment
      const fileType = detectFileType(file.type);
      const fileAttachment: IFileAttachment = {
        file,
        type: fileType,
        fileId: presignResult.fileId,
        ...(confirmResult.fileUri && { geminiFileId: confirmResult.fileUri }),
      };

      // Preview pour images
      if (fileType === 'image') {
        try {
          fileAttachment.preview = URL.createObjectURL(file);
        } catch {
          // Ignore preview errors
        }
      }

      setFiles(prev => [...prev, fileAttachment]);
      toast.success('Fichier uploadé avec succès');

      return fileAttachment;

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erreur lors de l\'upload';
      setError(errorMsg);
      toast.error(errorMsg);
      return null;
    }
  }, [user, presignMutation, confirmMutation]);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      const removed = newFiles.splice(index, 1)[0];

      // Cleanup preview URL
      if (removed?.preview) {
        URL.revokeObjectURL(removed.preview);
      }

      return newFiles;
    });
    setError(null);
    toast.info('Fichier supprimé');
  }, []);

  const clearFiles = useCallback(() => {
    // Cleanup all preview URLs
    files.forEach(f => {
      if (f.preview) {
        URL.revokeObjectURL(f.preview);
      }
    });
    setFiles([]);
    setError(null);
  }, [files]);

  return {
    files,
    isProcessing: presignMutation.isPending || confirmMutation.isPending,
    error: error ?? presignMutation.error?.message ?? confirmMutation.error?.message ?? null,
    uploadFile,
    removeFile,
    clearFiles,
  };
}

export default usePresignedUpload;
