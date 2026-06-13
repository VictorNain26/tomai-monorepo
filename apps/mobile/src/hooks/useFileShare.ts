/**
 * useFileShare Hook
 *
 * Download and share files using Expo APIs.
 * Supports downloading from Scaleway Object Storage (S3-compatible, RGPD France)
 * via presigned URLs from backend.
 *
 * Flow: GET /api/upload/file/:fileId -> presigned URL -> fetch -> local cache -> share
 *
 * @see apps/server/src/routes/file-upload.routes.ts
 */

import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { useConfirm } from '@/components/ui/confirm-dialog';
import * as Sharing from 'expo-sharing';
import { Paths, File } from 'expo-file-system';
import { getTreaty, unwrap } from '@repo/api';

// ============================================================================
// TYPES
// ============================================================================

interface FileShareState {
  isDownloading: boolean;
  isSharing: boolean;
  progress: number;
  error: string | null;
}

// ============================================================================
// HOOK
// ============================================================================

export function useFileShare() {
  const { info } = useConfirm();
  const [state, setState] = useState<FileShareState>({
    isDownloading: false,
    isSharing: false,
    progress: 0,
    error: null,
  });

  const isSharingAvailable = useCallback(async (): Promise<boolean> => {
    return Sharing.isAvailableAsync();
  }, []);

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
        const response = unwrap(
          await getTreaty().api.upload.file({ fileId }).get()
        );
        const data = response as {
          success: boolean;
          downloadUrl?: string;
          error?: string;
        };

        if (!data.success || !data.downloadUrl) {
          throw new Error(data.error ?? 'URL de téléchargement non disponible');
        }

        const cacheFile = new File(Paths.cache, fileName);

        if (cacheFile.exists) {
          cacheFile.delete();
        }

        const downloadResponse = await fetch(data.downloadUrl);
        if (!downloadResponse.ok) {
          throw new Error('Échec du téléchargement');
        }

        setState((prev) => ({ ...prev, progress: 50 }));

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

  const shareFile = useCallback(
    async (localUri: string, mimeType?: string): Promise<boolean> => {
      setState((prev) => ({ ...prev, isSharing: true, error: null }));

      try {
        const available = await Sharing.isAvailableAsync();
        if (!available) {
          info('Partage non disponible', 'Le partage de fichiers n\'est pas disponible sur cet appareil.');
          return false;
        }

        await Sharing.shareAsync(localUri, {
          mimeType: mimeType ?? 'application/octet-stream',
          dialogTitle: 'Partager le fichier',
          UTI: getUTIFromMimeType(mimeType),
        });

        return true;
      } catch (err) {
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
    [info]
  );

  const downloadAndShare = useCallback(
    async (
      fileId: string,
      fileName: string,
      mimeType?: string
    ): Promise<boolean> => {
      const localUri = await downloadFile(fileId, fileName);
      if (!localUri) {
        return false;
      }

      return shareFile(localUri, mimeType);
    },
    [downloadFile, shareFile]
  );

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
