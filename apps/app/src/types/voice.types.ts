/**
 * Voice Types - Audio et Text-to-Speech
 *
 * Simplifié (2025): Web Speech API uniquement, pas de mode audio
 */

export interface IVoiceState {
  isListening: boolean;
  transcript: string;
  permission: 'granted' | 'denied' | 'prompt';
}

export interface ITextToSpeechState {
  isSpeaking: boolean;
  rate: number;
  pitch: number;
  volume: number;
}
