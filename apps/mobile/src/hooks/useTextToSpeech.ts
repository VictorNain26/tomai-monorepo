/**
 * useTextToSpeech Hook
 *
 * Text-to-Speech using backend ElevenLabs service.
 * Uses expo-av for audio playback.
 *
 * Best Practice 2026: Uses expo-av which is fully compatible with
 * Expo Go and production builds.
 */

import { useState, useCallback, useRef } from 'react';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
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

  const soundRef = useRef<Audio.Sound | null>(null);
  const currentTextRef = useRef<string | null>(null);

  /**
   * Stop any current playback
   */
  const stop = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch {
        // Ignore errors during cleanup
      }
      soundRef.current = null;
    }
    currentTextRef.current = null;
    setState((prev) => ({ ...prev, isSpeaking: false }));
  }, []);

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
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          interruptionModeIOS: InterruptionModeIOS.DoNotMix,
          playsInSilentModeIOS: true,
          interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
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

        // Save base64 audio to temp file (expo-av requires file URI)
        const tempFileName = `tts_${Date.now()}.mp3`;
        const tempFile = new File(Paths.cache, tempFileName);

        // Decode base64 and write to file
        const binaryString = atob(response.audio.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        await tempFile.write(bytes);

        const tempUri = tempFile.uri;

        // Check if we were stopped during file write
        if (currentTextRef.current !== text) {
          await tempFile.delete();
          return false;
        }

        // Create and play sound
        const { sound } = await Audio.Sound.createAsync(
          { uri: tempUri },
          { shouldPlay: true },
          (status) => {
            if (status.isLoaded && status.didJustFinish) {
              // Playback finished
              stop();
              // Clean up temp file
              tempFile.delete();
            }
          }
        );

        soundRef.current = sound;
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
    [stop]
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
