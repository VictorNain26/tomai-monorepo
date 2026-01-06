/**
 * Hook File Upload Optimisé - Tom 2025
 * Architecture optimale : TanStack Query direct sans double mutation
 * Evidence-based selon doc TanStack + backend simple
 */

import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useUser } from '@/lib/auth';
import { toast } from 'sonner';
import { fileMutations } from '@/lib/query-factories';
import type { IFileAttachment, IFileUploadResult, FileType } from '@/types';

interface UseOptimizedFileUploadReturn {
  files: IFileAttachment[];
  isProcessing: boolean;
  error: string | null;

  // Actions principales
  uploadFile: (file: File, options?: { context?: string }) => Promise<IFileAttachment | null>;
  removeFile: (index: number) => void;
  clearFiles: () => void;
}

/**
 * Hook unifié pour upload et traitement de fichiers
 * Config validée côté backend (15MB max, types supportés)
 */
export function useOptimizedFileUpload(): UseOptimizedFileUploadReturn {
  const [files, setFiles] = useState<IFileAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const user = useUser();

  // TanStack Query mutation directe (optimal selon doc)
  const uploadMutation = useMutation({
    ...fileMutations.upload(),
    onError: (error: Error) => {
      toast.error(`❌ ${error.message}`);
      setError(error.message);
    },
    onSuccess: () => {
      toast.success('📁 Fichier uploadé avec succès');
      // Note: Pas d'invalidation de cache nécessaire
      // Les fichiers sont stockés en Redis (TTL) et gérés localement dans ce hook
    }
  });

  /**
   * Détection du type de fichier
   */
  const detectFileType = (mimeType: string): FileType => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType === 'application/pdf') return 'pdf';
    return 'document';
  };

  /**
   * Upload et traitement principal - TanStack Query direct
   */
  const uploadFile = useCallback(async (
    file: File,
    uploadOptions: { context?: string } = {}
  ): Promise<IFileAttachment | null> => {
    setError(null);

    try {
      if (!user) {
        throw new Error('Vous devez être connecté pour uploader des fichiers');
      }

      // Préparer FormData selon API backend
      const formData = new FormData();
      formData.append('file', file);
      if (uploadOptions.context) {
        formData.append('context', uploadOptions.context);
      }

      // Upload direct via fileMutations (optimal)
      const result = await uploadMutation.mutateAsync(formData) as IFileUploadResult;

      const fileType = detectFileType(file.type);

      // Créer l'attachment selon interface backend
      const fileAttachment: IFileAttachment = {
        file,
        type: fileType,
        ...(result.fileId && { fileId: result.fileId }),
        ...(result.geminiFileId && { geminiFileId: result.geminiFileId }),
        ...(result.metadata && { metadata: result.metadata })
      };

      // Ajout à la liste
      setFiles(prev => [...prev, fileAttachment]);
      return fileAttachment;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erreur lors du traitement du fichier';
      setError(errorMsg);
      return null;
    }
  }, [user, uploadMutation]);

  /**
   * Suppression de fichier
   */
  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setError(null);
    toast.info('📁 Fichier supprimé');
  }, []);

  /**
   * Vidage complet
   */
  const clearFiles = useCallback(() => {
    setFiles([]);
    setError(null);
  }, []);

  return {
    files,
    isProcessing: uploadMutation.isPending,
    error: error ?? uploadMutation.error?.message ?? null,
    uploadFile,
    removeFile,
    clearFiles
  };
}

export default useOptimizedFileUpload;
