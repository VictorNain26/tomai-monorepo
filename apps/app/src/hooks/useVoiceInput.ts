/**
 * useVoiceInput - Hook unifié pour entrée vocale
 *
 * Utilise des libs battle-tested au lieu de code custom:
 * - Mode 'text': react-speech-recognition (Web Speech API)
 * - Mode 'audio': react-voice-recorder-pro (MediaRecorder + visualisation)
 *
 * Architecture clean: wrapping de libs éprouvées
 */

import { useEffect, useCallback } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { useVoiceRecorder } from 'react-voice-recorder-pro';
import type { VoiceMode } from '@/types';
import { logger } from '@/lib/logger';

// ============================================
// Types
// ============================================

interface UseVoiceInputOptions {
  mode: VoiceMode;
  lang?: string;
  onTranscriptUpdate?: (text: string) => void;
}

interface UseVoiceInputReturn {
  // État commun
  mode: VoiceMode;
  isActive: boolean;
  isSupported: boolean;
  error: string | null;

  // Mode 'text' - Web Speech API
  transcript: string;
  interimTranscript: string;
  confidence: number | null;

  // Mode 'audio' - MediaRecorder
  audioBlob: Blob | null;
  duration: number;
  isSpeaking: boolean;

  // Actions communes
  start: () => Promise<void>;
  stop: () => void;
  clear: () => void;
}

// ============================================
// Hook Principal
// ============================================

export function useVoiceInput(options: UseVoiceInputOptions): UseVoiceInputReturn {
  const { mode, lang = 'fr-FR', onTranscriptUpdate } = options;

  // ========================================
  // Mode 'text' - react-speech-recognition
  // ========================================
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
    if (mode === 'text' && finalTranscript) {
      onTranscriptUpdate?.(finalTranscript);
    }
  }, [mode, finalTranscript, onTranscriptUpdate]);

  // ========================================
  // Mode 'audio' - react-voice-recorder-pro
  // ========================================
  const {
    isRecording,
    recordedBlob,
    formattedTime,
    audioLevel,
    error: recorderError,
    startRecording: startAudioRecording,
    stopRecording: stopAudioRecording
  } = useVoiceRecorder({
    autoEnableMicrophone: false,
    autoPlayAfterRecording: false
  });

  // Parsing duration depuis formattedTime "mm:ss"
  const parsedDuration = formattedTime
    ? parseInt(formattedTime.split(':')[0] ?? '0') * 60 + parseInt(formattedTime.split(':')[1] ?? '0')
    : 0;

  // ========================================
  // API Unifiée
  // ========================================

  const isSupported = mode === 'text'
    ? browserSupportsSpeechRecognition && isMicrophoneAvailable
    : typeof window !== 'undefined' && 'MediaRecorder' in window;

  const isActive = mode === 'text' ? listening : isRecording;

  const error = mode === 'audio' && recorderError
    ? recorderError
    : null;

  const start = useCallback(async (): Promise<void> => {
    if (!isSupported) {
      logger.error('Voice input not supported', { mode });
      return;
    }

    if (mode === 'text') {
      try {
        // Réinitialiser la transcription avant de démarrer (évite accumulation)
        resetTranscript();
        void SpeechRecognition.startListening({
          language: lang,
          continuous: false,
          interimResults: true
        });
        logger.info('Speech recognition started', { mode: 'text', lang });
      } catch (err) {
        logger.error('Failed to start speech recognition', { error: err });
      }
    } else {
      try {
        void startAudioRecording();
        logger.info('Audio recording started', { mode: 'audio' });
      } catch (err) {
        logger.error('Failed to start audio recording', { error: err });
      }
    }
  }, [mode, isSupported, lang, startAudioRecording, resetTranscript]);

  const stop = useCallback(() => {
    if (mode === 'text') {
      void SpeechRecognition.stopListening();
      logger.info('Speech recognition stopped', { mode: 'text' });
    } else {
      void stopAudioRecording();
      logger.info('Audio recording stopped', { mode: 'audio' });
    }
  }, [mode, stopAudioRecording]);

  const clear = useCallback(() => {
    if (mode === 'text') {
      void SpeechRecognition.abortListening();
    } else {
      void stopAudioRecording();
    }
  }, [mode, stopAudioRecording]);

  // ========================================
  // Return
  // ========================================
  return {
    mode,
    isActive,
    isSupported,
    error,
    // Mode text
    transcript,
    interimTranscript,
    confidence: null, // react-speech-recognition ne fournit pas confidence
    // Mode audio
    audioBlob: recordedBlob ?? null,
    duration: parsedDuration,
    isSpeaking: audioLevel > 0.01, // Seuil simple basé sur audioLevel
    // Actions
    start,
    stop,
    clear
  };
}
