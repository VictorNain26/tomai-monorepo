/**
 * useVoiceInput - Hook simplifié pour entrée vocale
 *
 * Architecture simplifiée (Best Practices ChatGPT/Claude 2025):
 * - Web Speech API uniquement (react-speech-recognition)
 * - Transcription temps réel, gratuit, navigateur natif
 * - Pas de mode audio complexe (MediaRecorder + Gladia)
 */

import { useEffect, useCallback } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { logger } from '@/lib/logger';

// ============================================
// Types
// ============================================

interface UseVoiceInputOptions {
  lang?: string;
  onTranscriptUpdate?: (text: string) => void;
}

interface UseVoiceInputReturn {
  isActive: boolean;
  isSupported: boolean;
  error: string | null;
  transcript: string;
  interimTranscript: string;
  start: () => Promise<void>;
  stop: () => void;
  clear: () => void;
}

// ============================================
// Hook
// ============================================

export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const { lang = 'fr-FR', onTranscriptUpdate } = options;

  const {
    transcript,
    interimTranscript,
    finalTranscript,
    listening,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
    resetTranscript
  } = useSpeechRecognition();

  // Callback quand nouveau texte final
  useEffect(() => {
    if (finalTranscript) {
      onTranscriptUpdate?.(finalTranscript);
    }
  }, [finalTranscript, onTranscriptUpdate]);

  const isSupported = browserSupportsSpeechRecognition && isMicrophoneAvailable;

  const start = useCallback(async (): Promise<void> => {
    if (!isSupported) {
      logger.error('Speech recognition not supported');
      return;
    }

    try {
      resetTranscript();
      void SpeechRecognition.startListening({
        language: lang,
        continuous: false,
        interimResults: true
      });
      logger.info('Speech recognition started', { lang });
    } catch (err) {
      logger.error('Failed to start speech recognition', { error: err });
    }
  }, [isSupported, lang, resetTranscript]);

  const stop = useCallback(() => {
    void SpeechRecognition.stopListening();
    logger.info('Speech recognition stopped');
  }, []);

  const clear = useCallback(() => {
    void SpeechRecognition.abortListening();
    resetTranscript();
  }, [resetTranscript]);

  return {
    isActive: listening,
    isSupported,
    error: null,
    transcript,
    interimTranscript,
    start,
    stop,
    clear
  };
}
