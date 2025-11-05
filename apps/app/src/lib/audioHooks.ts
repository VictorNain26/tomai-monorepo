/**
 * Hooks pour AudioManager (version simplifiée)
 */

import { createContext, useContext } from 'react';
import type { AudioState } from './audioTypes';

// Interface complète pour le contexte
export interface AudioManagerContext {
  state: AudioState;
  toggleGlobal: () => void;
  speakMessage: (messageId: string, content: string) => Promise<void>;
  stopSpeaking: () => void;
  isSupported: boolean;
  selectedVoice: SpeechSynthesisVoice | null;
  voiceLevel: 'primary' | 'college' | 'lycee';
}

// Context unique (simple et efficace)
export const AudioContext = createContext<AudioManagerContext | null>(null);

/**
 * Hook pour accéder au AudioManager
 */
export function useAudioManager(): AudioManagerContext {
  const context = useContext(AudioContext);

  if (!context) {
    throw new Error('useAudioManager must be used within AudioManagerProvider');
  }

  return context;
}

/**
 * Hook principal pour l'audio dans TomAI (alias de useAudioManager)
 */
export function useAudio(): AudioManagerContext {
  return useAudioManager();
}

/**
 * Hook simplifié pour juste lire du texte
 */
export function useSimpleAudio() {
  const audioManager = useAudioManager();

  return {
    speak: (messageId: string, content: string) => audioManager.speakMessage(messageId, content),
    stop: audioManager.stopSpeaking,
    isSpeaking: audioManager.state.currentlySpeaking,
    isSupported: audioManager.isSupported
  };
}
