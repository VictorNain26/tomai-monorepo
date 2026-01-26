/**
 * useVoiceInput Hook
 *
 * Records audio and transcribes it using the backend Gladia service.
 * Uses expo-audio (SDK 54+) for recording.
 *
 * Best Practice 2026: Uses expo-audio which replaces deprecated expo-av.
 * @see https://docs.expo.dev/versions/latest/sdk/audio/
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  useAudioRecorder,
  RecordingPresets,
  AudioModule,
  RecordingStatus,
} from 'expo-audio';
import { apiClient } from '@repo/api';

// ============================================================================
// TYPES
// ============================================================================

export interface VoiceInputState {
  /** Is currently recording */
  isRecording: boolean;
  /** Is processing (uploading + transcribing) */
  isProcessing: boolean;
  /** Recording duration in seconds */
  duration: number;
  /** Error message if any */
  error: string | null;
}

/**
 * Response from POST /api/upload/presign
 * @see apps/server/src/routes/file-upload.routes.ts
 */
interface PresignedUrlResponse {
  success: boolean;
  fileId?: string;
  uploadUrl?: string;
  storageKey?: string;
  expiresAt?: string;
  error?: string;
}

/**
 * Response from POST /api/upload/confirm/:fileId
 * @see apps/server/src/routes/file-upload.routes.ts
 */
interface ConfirmUploadResponse {
  success: boolean;
  fileId?: string;
  fileUri?: string;
  geminiExpiresAt?: string;
  transcription?: string;
  error?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_DURATION_MS = 120000; // 2 minutes max

// ============================================================================
// HOOK
// ============================================================================

export function useVoiceInput() {
  const [state, setState] = useState<VoiceInputState>({
    isRecording: false,
    isProcessing: false,
    duration: 0,
    error: null,
  });

  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const stopRecordingRef = useRef<() => Promise<string | null>>(() => Promise.resolve(null));

  // expo-audio recorder hook with HIGH_QUALITY preset
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY, (status: RecordingStatus) => {
    // Auto-stop at max duration
    if (status.isRecording && status.durationMillis >= MAX_DURATION_MS) {
      void stopRecordingRef.current();
    }
  });

  // Sync isRecording state with recorder
  useEffect(() => {
    setState((prev) => ({
      ...prev,
      isRecording: recorder.isRecording,
    }));
  }, [recorder.isRecording]);

  /**
   * Request audio permissions
   */
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        setState((prev) => ({
          ...prev,
          error: 'Permission microphone refusée',
        }));
        return false;
      }
      return true;
    } catch {
      setState((prev) => ({
        ...prev,
        error: 'Erreur lors de la demande de permission',
      }));
      return false;
    }
  }, []);

  /**
   * Start recording audio
   */
  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      // Request permissions
      const hasPermission = await requestPermissions();
      if (!hasPermission) return false;

      // Configure audio mode for recording
      await AudioModule.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      // Prepare and start recording
      await recorder.prepareToRecordAsync();
      recorder.record();

      startTimeRef.current = Date.now();

      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setState((prev) => ({ ...prev, duration: elapsed }));
      }, 500);

      setState({
        isRecording: true,
        isProcessing: false,
        duration: 0,
        error: null,
      });

      return true;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isRecording: false,
        error: err instanceof Error ? err.message : 'Erreur lors du démarrage',
      }));
      return false;
    }
  }, [requestPermissions, recorder]);

  /**
   * Stop recording and get transcription
   */
  const stopRecording = useCallback(async (): Promise<string | null> => {
    // Clear duration interval
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (!recorder.isRecording) {
      setState((prev) => ({ ...prev, isRecording: false }));
      return null;
    }

    try {
      setState((prev) => ({
        ...prev,
        isRecording: false,
        isProcessing: true,
      }));

      // Stop recording - uri available at recorder.uri
      await recorder.stop();
      const uri = recorder.uri;

      if (!uri) {
        throw new Error('Aucun fichier audio enregistré');
      }

      // Reset audio mode
      await AudioModule.setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });

      // Upload and transcribe
      const transcription = await uploadAndTranscribe(uri);

      setState((prev) => ({
        ...prev,
        isProcessing: false,
        duration: 0,
      }));

      return transcription;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isRecording: false,
        isProcessing: false,
        error: err instanceof Error ? err.message : 'Erreur lors de la transcription',
      }));
      return null;
    }
  }, [recorder]);

  // Keep ref updated for auto-stop timer
  stopRecordingRef.current = stopRecording;

  /**
   * Cancel recording without transcribing
   */
  const cancelRecording = useCallback(async () => {
    // Clear duration interval
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (recorder.isRecording) {
      try {
        await recorder.stop();
      } catch {
        // Ignore errors
      }
    }

    // Reset audio mode
    await AudioModule.setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    });

    setState({
      isRecording: false,
      isProcessing: false,
      duration: 0,
      error: null,
    });
  }, [recorder]);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    startRecording,
    stopRecording,
    cancelRecording,
    clearError,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Upload audio file and get transcription from backend
 */
async function uploadAndTranscribe(uri: string): Promise<string | null> {
  // Get presigned URL from backend (Scaleway via /api/upload/presign)
  const presignedResponse = await apiClient.post<PresignedUrlResponse>(
    '/api/upload/presign',
    {
      fileName: 'voice-recording.m4a',
      mimeType: 'audio/mp4',
      sizeBytes: 1, // Placeholder, backend will get actual size from storage
    }
  );

  if (!presignedResponse.success || !presignedResponse.uploadUrl || !presignedResponse.fileId) {
    throw new Error(presignedResponse.error ?? 'Impossible de préparer l\'upload');
  }

  const { uploadUrl, fileId } = presignedResponse;

  // Read file and upload to Scaleway
  const response = await fetch(uri);
  const blob = await response.blob();

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: {
      'Content-Type': 'audio/mp4',
    },
  });

  if (!uploadResponse.ok) {
    throw new Error('Erreur lors de l\'upload audio');
  }

  // Confirm upload and get transcription (POST /api/upload/confirm/:fileId)
  const confirmResponse = await apiClient.post<ConfirmUploadResponse>(
    `/api/upload/confirm/${fileId}`,
    {}
  );

  if (!confirmResponse.success) {
    throw new Error(confirmResponse.error ?? 'Erreur lors de la confirmation');
  }

  return confirmResponse.transcription ?? null;
}

export default useVoiceInput;
