/**
 * useTextToSpeech Hook
 *
 * Text-to-Speech using backend ElevenLabs service.
 * Uses expo-audio (SDK 55) for audio playback.
 *
 * @see https://docs.expo.dev/versions/latest/sdk/audio/
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { Paths, File } from 'expo-file-system';
import { getTreaty, unwrap } from '@repo/api';

// ============================================================================
// TYPES
// ============================================================================

export interface TextToSpeechState {
  /** Is currently speaking (derived from player status, exposed for consumers) */
  isSpeaking: boolean;
  /** Is loading audio from API */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
}

/**
 * Internal state — `isSpeaking` is derived during render, not stored.
 * `currentText` doubles as render-input (for derived `isSpeaking`) and as the
 * source-of-truth for the active synthesis request; a parallel ref keeps a
 * synchronous mirror so race-checks inside `speak`'s async flow stay coherent
 * before React commits the next state update.
 */
interface InternalState {
  isLoading: boolean;
  error: string | null;
  currentText: string | null;
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
  const [state, setState] = useState<InternalState>({
    isLoading: false,
    error: null,
    currentText: null,
  });

  // Mirror of `state.currentText` for synchronous race-checks inside async
  // flows (between API call and player.play). Never read during render.
  const currentTextRef = useRef<string | null>(null);
  const tempFileRef = useRef<File | null>(null);
  const isMountedRef = useRef(false);

  // expo-audio player hook (SDK 55 pattern)
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);

  // Derived `isSpeaking` (no redundant state — see React 19 docs).
  // Truthy when:
  //   1. The player reports active playback, OR
  //   2. We just kicked off playback for a text (state holds the active text,
  //      no longer loading, no error, and the audio hasn't yet finished). This
  //      bridges the sub-render gap between `player.play()` and `status.playing`
  //      flipping to true, preserving the previous behavior where `setState`
  //      set `isSpeaking: true` synchronously after play.
  const isSpeaking =
    status.playing ||
    (state.currentText !== null &&
      !state.isLoading &&
      state.error === null &&
      !status.didJustFinish);

  // Track mount state + cleanup temp file on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
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

  // Subscribe directly to the player's external event stream. Per React 19
  // guidance, setState in an external-system subscription callback is the
  // canonical pattern — and avoids the `react-hooks/set-state-in-effect`
  // warning that triggers when setState is called synchronously in an
  // effect's body.
  useEffect(() => {
    const subscription = player.addListener('playbackStatusUpdate', (st) => {
      if (!st.didJustFinish) return;
      currentTextRef.current = null;
      if (tempFileRef.current) {
        try {
          void tempFileRef.current.delete();
        } catch {
          // Ignore cleanup errors
        }
        tempFileRef.current = null;
      }
      if (isMountedRef.current) {
        setState((prev) => (prev.currentText === null ? prev : { ...prev, currentText: null }));
      }
    });
    return () => {
      subscription.remove();
    };
  }, [player]);

  const stop = useCallback(async () => {
    try {
      player.pause();
    } catch {
      // Ignore errors during cleanup
    }
    currentTextRef.current = null;
    if (isMountedRef.current) {
      setState((prev) => (prev.currentText === null ? prev : { ...prev, currentText: null }));
    }

    if (tempFileRef.current) {
      try {
        await tempFileRef.current.delete();
      } catch {
        // Ignore
      }
      tempFileRef.current = null;
    }
  }, [player]);

  const speak = useCallback(
    async (text: string, options: TTSOptions = {}): Promise<boolean> => {
      await stop();

      if (!text || text.trim().length === 0) {
        if (isMountedRef.current) setState((prev) => ({ ...prev, error: 'Texte vide' }));
        return false;
      }

      if (text.length > MAX_TEXT_LENGTH) {
        if (isMountedRef.current) {
          setState((prev) => ({
            ...prev,
            error: `Texte trop long (max ${MAX_TEXT_LENGTH} caractères)`,
          }));
        }
        return false;
      }

      try {
        currentTextRef.current = text;
        if (isMountedRef.current) {
          setState({ isLoading: true, error: null, currentText: text });
        }

        // Configure audio mode for playback (SDK 55 standalone function)
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
          interruptionMode: 'mixWithOthers',
          shouldPlayInBackground: false,
          shouldRouteThroughEarpiece: false,
        });

        // Call backend TTS API
        const response = unwrap(
          await getTreaty().api.tts.synthesize.post({
            text: text.trim(),
            language: options.language ?? 'fr',
            schoolLevel: options.schoolLevel,
          })
        ) as TTSSynthesizeResponse;

        if (currentTextRef.current !== text) return false;

        if (!response.success || !response.audio) {
          throw new Error(response.error ?? 'Échec de la synthèse vocale');
        }

        // Save base64 audio to temp file
        const tempFileName = `tts_${Date.now()}.mp3`;
        const tempFile = new File(Paths.cache, tempFileName);
        tempFileRef.current = tempFile;

        const { Buffer } = await import('buffer');
        const bytes = Buffer.from(response.audio.data, 'base64');
        await tempFile.write(new Uint8Array(bytes));

        const tempUri = tempFile.uri;

        if (currentTextRef.current !== text) {
          await tempFile.delete();
          tempFileRef.current = null;
          return false;
        }

        // Load and play audio
        player.replace({ uri: tempUri });
        player.seekTo(0);
        player.play();

        if (isMountedRef.current) {
          setState((prev) => ({ ...prev, isLoading: false, error: null }));
        }
        return true;
      } catch (err) {
        currentTextRef.current = null;
        if (isMountedRef.current) {
          setState({
            isLoading: false,
            error: err instanceof Error ? err.message : 'Erreur lors de la synthèse',
            currentText: null,
          });
        }
        return false;
      }
    },
    [stop, player]
  );

  const toggle = useCallback(
    async (text: string, options?: TTSOptions): Promise<boolean> => {
      // Re-derive `isSpeaking` here against the latest player status so that
      // toggling a text already being read stops it.
      const speakingThisText =
        state.currentText === text &&
        (status.playing ||
          (!state.isLoading && state.error === null && !status.didJustFinish));
      if (speakingThisText) {
        await stop();
        return false;
      }
      return speak(text, options);
    },
    [
      state.currentText,
      state.isLoading,
      state.error,
      status.playing,
      status.didJustFinish,
      stop,
      speak,
    ]
  );

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    isSpeaking,
    isLoading: state.isLoading,
    error: state.error,
    speak,
    stop,
    toggle,
    clearError,
  };
}

export default useTextToSpeech;
