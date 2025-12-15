/**
 * Voice Types - Audio et Text-to-Speech
 */

// Voice input modes for subject-aware voice detection
export type VoiceMode = 'text' | 'audio';

export interface IVoiceState {
  isListening: boolean;
  transcript: string;
  permission: 'granted' | 'denied' | 'prompt';
  confidence: number;
}

export interface ITextToSpeechState {
  isSpeaking: boolean;
  rate: number;
  pitch: number;
  volume: number;
}
