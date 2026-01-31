/**
 * useFileShare Hook
 *
 * Download and share files using Expo APIs.
 * Supports downloading from Scaleway Object Storage (S3-compatible, RGPD France)
 * via presigned URLs from backend.
 *
 * Flow: GET /api/upload/file/:fileId → presigned URL → fetch → local cache → share
 *
 * @see apps/server/src/routes/file-upload.routes.ts
 */

import { useState, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { Paths, File } from 'expo-file-system';
import { apiClient } from '@repo/api';

// ============================================================================
// TYPES
// ============================================================================

export interface FileShareState {
  /** Is currently downloading */
  isDownloading: boolean;
  /** Is sharing dialog open */
  isSharing: boolean;
  /** Download progress (0-100) */
  progress: number;
  /** Error message if any */
  error: string | null;
}

/**
 * Response from GET /api/upload/file/:fileId
 * @see apps/server/src/routes/file-upload.routes.ts
 */
interface DownloadUrlResponse {
  success: boolean;
  downloadUrl?: string;
  expiresAt?: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  error?: string;
}

// ============================================================================
// HOOK
// ============================================================================

export function useFileShare() {
  const [state, setState] = useState<FileShareState>({
    isDownloading: false,
    isSharing: false,
    progress: 0,
    error: null,
  });

  /**
   * Check if sharing is available on this device
   */
  const isSharingAvailable = useCallback(async (): Promise<boolean> => {
    return Sharing.isAvailableAsync();
  }, []);

  /**
   * Download file from Scaleway storage to local cache
   * Uses backend presigned URL endpoint: GET /api/upload/file/:fileId
   */
  const downloadFile = useCallback(
    async (
      fileId: string,
      fileName: string
    ): Promise<string | null> => {
      setState((prev) => ({
        ...prev,
        isDownloading: true,
        progress: 0,
        error: null,
      }));

      try {
        // Get presigned download URL from backend (Scaleway via /api/upload/file/:fileId)
        const response = await apiClient.get<DownloadUrlResponse>(
          `/api/upload/file/${fileId}`
        );

        if (!response.success || !response.downloadUrl) {
          throw new Error(response.error ?? 'URL de téléchargement non disponible');
        }

        // Download to cache directory
        const cacheFile = new File(Paths.cache, fileName);

        // Check if file already exists and delete it
        if (cacheFile.exists) {
          cacheFile.delete();
        }

        // Download the file from Scaleway using presigned URL
        const downloadResponse = await fetch(response.downloadUrl);
        if (!downloadResponse.ok) {
          throw new Error('Échec du téléchargement');
        }

        setState((prev) => ({ ...prev, progress: 50 }));

        // Convert response to blob and write to file
        // React Native: use FileReader to convert Blob to ArrayBuffer
        const blob = await downloadResponse.blob();
        const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = () => reject(new Error('Failed to read blob'));
          reader.readAsArrayBuffer(blob);
        });
        const bytes = new Uint8Array(arrayBuffer);

        cacheFile.write(bytes);

        setState((prev) => ({ ...prev, progress: 100 }));

        return cacheFile.uri;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Erreur de téléchargement';
        setState((prev) => ({ ...prev, error: message }));
        return null;
      } finally {
        setState((prev) => ({ ...prev, isDownloading: false }));
      }
    },
    []
  );

  /**
   * Share a file using the native share sheet
   */
  const shareFile = useCallback(
    async (localUri: string, mimeType?: string): Promise<boolean> => {
      setState((prev) => ({ ...prev, isSharing: true, error: null }));

      try {
        // Check if sharing is available
        const available = await Sharing.isAvailableAsync();
        if (!available) {
          Alert.alert(
            'Partage non disponible',
            'Le partage de fichiers n\'est pas disponible sur cet appareil.'
          );
          return false;
        }

        // Share the file
        await Sharing.shareAsync(localUri, {
          mimeType: mimeType ?? 'application/octet-stream',
          dialogTitle: 'Partager le fichier',
          UTI: getUTIFromMimeType(mimeType),
        });

        return true;
      } catch (err) {
        // User cancelled or error
        if (err instanceof Error && err.message.includes('cancelled')) {
          return false;
        }
        const message =
          err instanceof Error ? err.message : 'Erreur lors du partage';
        setState((prev) => ({ ...prev, error: message }));
        return false;
      } finally {
        setState((prev) => ({ ...prev, isSharing: false }));
      }
    },
    []
  );

  /**
   * Download and share a file in one operation
   */
  const downloadAndShare = useCallback(
    async (
      fileId: string,
      fileName: string,
      mimeType?: string
    ): Promise<boolean> => {
      // Download first
      const localUri = await downloadFile(fileId, fileName);
      if (!localUri) {
        return false;
      }

      // Then share
      return shareFile(localUri, mimeType);
    },
    [downloadFile, shareFile]
  );

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    isSharingAvailable,
    downloadFile,
    shareFile,
    downloadAndShare,
    clearError,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert MIME type to iOS UTI for better sharing experience
 */
function getUTIFromMimeType(mimeType?: string): string | undefined {
  if (Platform.OS !== 'ios' || !mimeType) return undefined;

  const utiMap: Record<string, string> = {
    'application/pdf': 'com.adobe.pdf',
    'image/jpeg': 'public.jpeg',
    'image/png': 'public.png',
    'image/gif': 'com.compuserve.gif',
    'audio/mpeg': 'public.mp3',
    'audio/mp4': 'public.mpeg-4-audio',
    'audio/wav': 'com.microsoft.waveform-audio',
    'text/plain': 'public.plain-text',
    'application/msword': 'com.microsoft.word.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      'org.openxmlformats.wordprocessingml.document',
  };

  return utiMap[mimeType];
}

export default useFileShare;
