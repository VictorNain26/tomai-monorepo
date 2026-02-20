/**
 * useTextToSpeech Hook
 *
 * Text-to-Speech using backend ElevenLabs service.
 * Uses expo-audio (SDK 54+) for audio playback.
 *
 * Best Practice 2026: Uses expo-audio which replaces deprecated expo-av.
 * @see https://docs.expo.dev/versions/latest/sdk/audio/
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAudioPlayer, useAudioPlayerStatus, AudioModule } from 'expo-audio';
import { Paths, File } from 'expo-file-system';
import { apiClient } from '@repo/api';

// ============================================================================
// TYPES
// ============================================================================

export interface TextToSpeechState {
  /** Is currently speaking */
  isSpeaking: boolean;
  /** Is loading audio from API */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
}

interface TTSSynthesizeResponse {
  success: boolean;
  audio?: {
    data: string; // Base64 encoded MP3
    mimeType: string;
    durationMs: number;
  };
  meta?: {
    textLength: number;
    processingMs: number;
  };
  error?: string;
}

export interface TTSOptions {
  /** Language for voice selection */
  language?: 'fr' | 'en' | 'es' | 'de';
  /** School level to adapt voice */
  schoolLevel?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_TEXT_LENGTH = 5000;

// ============================================================================
// HOOK
// ============================================================================

export function useTextToSpeech() {
  const [state, setState] = useState<TextToSpeechState>({
    isSpeaking: false,
    isLoading: false,
    error: null,
  });

  const currentTextRef = useRef<string | null>(null);
  const tempFileRef = useRef<File | null>(null);

  // expo-audio player hook (source will be set dynamically)
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);

  // Cleanup temp file on unmount (prevents file leaks if component unmounts during playback)
  useEffect(() => {
    return () => {
      if (tempFileRef.current) {
        try {
          void tempFileRef.current.delete();
        } catch {
          // Ignore cleanup errors on unmount
        }
        tempFileRef.current = null;
      }
    };
  }, []);

  // Sync isSpeaking state with player status
  useEffect(() => {
    if (status.playing) {
      setState((prev) => ({ ...prev, isSpeaking: true }));
    } else if (status.didJustFinish) {
      // Playback finished - cleanup
      setState((prev) => ({ ...prev, isSpeaking: false }));
      currentTextRef.current = null;
      // Clean up temp file
      if (tempFileRef.current) {
        try {
          void tempFileRef.current.delete();
        } catch {
          // Ignore cleanup errors
        }
        tempFileRef.current = null;
      }
    }
  }, [status.playing, status.didJustFinish]);

  /**
   * Stop any current playback
   */
  const stop = useCallback(async () => {
    try {
      player.pause();
    } catch {
      // Ignore errors during cleanup
    }
    currentTextRef.current = null;
    setState((prev) => ({ ...prev, isSpeaking: false }));

    // Clean up temp file
    if (tempFileRef.current) {
      try {
        await tempFileRef.current.delete();
      } catch {
        // Ignore
      }
      tempFileRef.current = null;
    }
  }, [player]);

  /**
   * Speak the given text
   */
  const speak = useCallback(
    async (text: string, options: TTSOptions = {}): Promise<boolean> => {
      // Stop any current playback
      await stop();

      // Validate text
      if (!text || text.trim().length === 0) {
        setState((prev) => ({ ...prev, error: 'Texte vide' }));
        return false;
      }

      if (text.length > MAX_TEXT_LENGTH) {
        setState((prev) => ({
          ...prev,
          error: `Texte trop long (max ${MAX_TEXT_LENGTH} caractères)`,
        }));
        return false;
      }

      try {
        setState({
          isSpeaking: false,
          isLoading: true,
          error: null,
        });

        currentTextRef.current = text;

        // Configure audio mode for playback
        await AudioModule.setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
        });

        // Call backend TTS API
        const response = await apiClient.post<TTSSynthesizeResponse>(
          '/api/tts/synthesize',
          {
            text: text.trim(),
            language: options.language ?? 'fr',
            schoolLevel: options.schoolLevel,
          }
        );

        // Check if we were stopped during API call
        if (currentTextRef.current !== text) {
          return false;
        }

        if (!response.success || !response.audio) {
          throw new Error(response.error ?? 'Échec de la synthèse vocale');
        }

        // Save base64 audio to temp file (expo-audio requires file URI)
        const tempFileName = `tts_${Date.now()}.mp3`;
        const tempFile = new File(Paths.cache, tempFileName);
        tempFileRef.current = tempFile;

        // Decode base64 and write to file
        // React Native: use Buffer from 'buffer' polyfill (included in React Native)
        const { Buffer } = await import('buffer');
        const bytes = Buffer.from(response.audio.data, 'base64');
        await tempFile.write(new Uint8Array(bytes));

        const tempUri = tempFile.uri;

        // Check if we were stopped during file write
        if (currentTextRef.current !== text) {
          await tempFile.delete();
          tempFileRef.current = null;
          return false;
        }

        // Load and play audio using expo-audio
        // expo-audio: replace source and play
        player.replace({ uri: tempUri });
        player.seekTo(0); // Reset position (expo-audio best practice)
        player.play();

        setState({
          isSpeaking: true,
          isLoading: false,
          error: null,
        });

        return true;
      } catch (err) {
        setState({
          isSpeaking: false,
          isLoading: false,
          error:
            err instanceof Error ? err.message : 'Erreur lors de la synthèse',
        });
        return false;
      }
    },
    [stop, player]
  );

  /**
   * Toggle speaking - start or stop
   */
  const toggle = useCallback(
    async (text: string, options?: TTSOptions): Promise<boolean> => {
      if (state.isSpeaking && currentTextRef.current === text) {
        await stop();
        return false;
      }
      return speak(text, options);
    },
    [state.isSpeaking, stop, speak]
  );

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    speak,
    stop,
    toggle,
    clearError,
  };
}

export default useTextToSpeech;
