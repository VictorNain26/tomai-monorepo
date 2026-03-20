/**
 * useVoiceInput Hook
 *
 * Records audio and transcribes it using the backend Gladia service.
 * Uses expo-audio (SDK 55) for recording.
 *
 * @see https://docs.expo.dev/versions/latest/sdk/audio/
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  AudioModule,
  setAudioModeAsync,
} from 'expo-audio';
import { getTreaty, unwrap } from '@repo/api';
import { haptics } from '@/lib/haptics';

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

interface PresignedUrlResponse {
  success: boolean;
  fileId?: string;
  uploadUrl?: string;
  storageKey?: string;
  expiresAt?: string;
  error?: string;
}

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
  const isMountedRef = useRef(false);

  // expo-audio recorder hook (SDK 55 pattern - no callback)
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  // Track mount state + cleanup interval on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    };
  }, []);

  // Auto-stop at max duration
  useEffect(() => {
    if (recorderState.isRecording && recorderState.durationMillis >= MAX_DURATION_MS) {
      void stopRecordingRef.current();
    }
  }, [recorderState.isRecording, recorderState.durationMillis]);

  // Sync isRecording state with recorder
  useEffect(() => {
    setState((prev) => ({
      ...prev,
      isRecording: recorderState.isRecording,
    }));
  }, [recorderState.isRecording]);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        if (isMountedRef.current) {
          setState((prev) => ({
            ...prev,
            error: 'Permission microphone refusée',
          }));
        }
        return false;
      }
      return true;
    } catch {
      if (isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          error: 'Erreur lors de la demande de permission',
        }));
      }
      return false;
    }
  }, []);

  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return false;

      // Configure audio mode for recording (SDK 55 standalone function)
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        interruptionMode: 'doNotMix',
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });

      // Prepare and start recording
      await recorder.prepareToRecordAsync();
      recorder.record();
      void haptics.medium();

      startTimeRef.current = Date.now();

      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        if (isMountedRef.current) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setState((prev) => ({ ...prev, duration: elapsed }));
        }
      }, 500);

      if (isMountedRef.current) {
        setState({
          isRecording: true,
          isProcessing: false,
          duration: 0,
          error: null,
        });
      }

      return true;
    } catch (err) {
      if (isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          isRecording: false,
          error: err instanceof Error ? err.message : 'Erreur lors du démarrage',
        }));
      }
      return false;
    }
  }, [requestPermissions, recorder]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (!recorderState.isRecording) {
      if (isMountedRef.current) setState((prev) => ({ ...prev, isRecording: false }));
      return null;
    }

    try {
      if (isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          isRecording: false,
          isProcessing: true,
        }));
      }

      await recorder.stop();
      void haptics.success();
      const uri = recorder.uri;

      if (!uri) {
        throw new Error('Aucun fichier audio enregistré');
      }

      // Reset audio mode
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        interruptionMode: 'mixWithOthers',
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });

      // Upload and transcribe
      const transcription = await uploadAndTranscribe(uri);

      if (isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          duration: 0,
        }));
      }

      return transcription;
    } catch (err) {
      if (isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          isRecording: false,
          isProcessing: false,
          error: err instanceof Error ? err.message : 'Erreur lors de la transcription',
        }));
      }
      return null;
    }
  }, [recorder, recorderState.isRecording]);

  // Keep ref updated for auto-stop timer
  stopRecordingRef.current = stopRecording;

  const cancelRecording = useCallback(async () => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (recorderState.isRecording) {
      try {
        await recorder.stop();
      } catch {
        // Ignore errors
      }
    }

    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
    });

    void haptics.warning();

    if (isMountedRef.current) {
      setState({
        isRecording: false,
        isProcessing: false,
        duration: 0,
        error: null,
      });
    }
  }, [recorder, recorderState.isRecording]);

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

async function uploadAndTranscribe(uri: string): Promise<string | null> {
  const presignedResponse = unwrap(
    await getTreaty().api.upload.presign.post({
      fileName: 'voice-recording.m4a',
      mimeType: 'audio/mp4',
      sizeBytes: 1,
    })
  ) as PresignedUrlResponse;

  if (!presignedResponse.success || !presignedResponse.uploadUrl || !presignedResponse.fileId) {
    throw new Error(presignedResponse.error ?? 'Impossible de préparer l\'upload');
  }

  const { uploadUrl, fileId } = presignedResponse;

  const response = await fetch(uri);
  const blob = await response.blob();

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': 'audio/mp4' },
  });

  if (!uploadResponse.ok) {
    throw new Error('Erreur lors de l\'upload audio');
  }

  const confirmResponse = unwrap(
    await getTreaty().api.upload.confirm({ fileId }).post()
  ) as ConfirmUploadResponse;

  if (!confirmResponse.success) {
    throw new Error(confirmResponse.error ?? 'Erreur lors de la confirmation');
  }

  return confirmResponse.transcription ?? null;
}

export default useVoiceInput;
