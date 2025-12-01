import { useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import { useUser } from './auth';
import { getUIMode, type EducationLevelType } from '@/utils/uiModeSystem';
import { createMathPreprocessor } from '@/utils/mathPreprocessingConfig';
import { logger } from './logger';
import { isITomUser } from '@/types';
import { EDUCATION_CONFIG } from './audioConfig';
import { AudioContext, type AudioManagerContext } from './audioHooks';
import type { AudioState } from './audioTypes';
import { detectDominantLanguage } from '@/utils/languageDetection';

// Re-export types pour compatibilité
export type { AudioManagerContext } from './audioHooks';
export type { AudioState } from './audioTypes';

/**
 * AudioManager - React Context Pattern (Official)
 *
 * Architecture React officielle suivant les bonnes pratiques :
 * - Context API avec useMemo pour éviter re-renders
 * - useCallback pour stabiliser les fonctions
 * - Zero global state listeners (anti-pattern supprimé)
 * - Configuration éducative adaptée par niveau scolaire
 *
 * @see https://react.dev/reference/react/useContext
 * @see https://react.dev/learn/scaling-up-with-reducer-and-context
 */

/**
 * Provider AudioManager - Composant racine
 * À placer dans App.tsx au niveau racine
 */
export function AudioManagerProvider({ children }: { children: ReactNode }) {
  // État React pur (plus de global state)
  const [state, setState] = useState<AudioState>({
    isGlobalEnabled: false,
    currentlySpeaking: false,
    activeMessageId: null
  });

  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [_availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const user = useUser();

  // Configuration voix selon niveau utilisateur
  const voiceLevel = useMemo((): 'primary' | 'college' | 'lycee' => {
    if (!isITomUser(user) || !user.schoolLevel) return 'college';
    return getUIMode(user.schoolLevel as EducationLevelType);
  }, [user]);

  // Support Web Speech API (constante - pas besoin de useMemo)
  const isSupported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

  // Preprocessing du texte
  const preprocessText = useMemo(() => {
    return createMathPreprocessor(voiceLevel);
  }, [voiceLevel]);

  /**
   * Sélection intelligente de la meilleure voix française
   */
  const selectBestVoice = useCallback((voices: SpeechSynthesisVoice[], level: typeof voiceLevel) => {
    const config = EDUCATION_CONFIG[level];

    const frenchVoices = voices.filter(voice =>
      voice.lang.startsWith('fr') &&
      !voice.name.toLowerCase().includes('novelty') &&
      !voice.name.toLowerCase().includes('whisper')
    );

    if (frenchVoices.length === 0) return voices[0] ?? null;

    const franceFrench = frenchVoices.filter(v => v.lang === 'fr-FR');
    const targetVoices = franceFrench.length > 0 ? franceFrench : frenchVoices;

    const premiumVoices = targetVoices.filter(voice =>
      voice.name.toLowerCase().includes('google') ||
      voice.name.toLowerCase().includes('neural') ||
      voice.name.toLowerCase().includes('enhanced') ||
      voice.name.toLowerCase().includes('premium')
    );

    const voicePool = premiumVoices.length > 0 ? premiumVoices : targetVoices;

    if (config.preferFemale) {
      const femaleVoices = voicePool.filter(voice =>
        voice.name.toLowerCase().includes('female') ||
        voice.name.toLowerCase().includes('féminin') ||
        voice.name.toLowerCase().includes('femme') ||
        (!voice.name.toLowerCase().includes('male') && !voice.name.toLowerCase().includes('homme'))
      );
      if (femaleVoices.length > 0) return femaleVoices[0];
    }

    return voicePool[0] ?? null;
  }, []);

  // Chargement des voix
  useEffect(() => {
    if (!isSupported) return;

    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      setAvailableVoices(voices);

      const bestVoice = selectBestVoice(voices, voiceLevel);
      setSelectedVoice(bestVoice ?? null);
    };

    loadVoices();
    speechSynthesis.addEventListener('voiceschanged', loadVoices);

    return () => {
      speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, [isSupported, voiceLevel, selectBestVoice]);

  /**
   * Arrêter complètement l'audio (useCallback pour stabilité)
   */
  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    setState(prev => ({
      ...prev,
      currentlySpeaking: false,
      activeMessageId: null
    }));

    logger.info('Audio stopped manually', {
      operation: 'audio-manager'
    });
  }, []);

  /**
   * Toggle audio global (useCallback pour stabilité)
   */
  const toggleGlobal = useCallback(() => {
    setState(prev => {
      const newEnabled = !prev.isGlobalEnabled;

      // Si on désactive, arrêter tout
      if (!newEnabled && prev.currentlySpeaking) {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
      }

      logger.info('Audio global toggled', {
        operation: 'audio-manager',
        enabled: newEnabled
      });

      return {
        ...prev,
        isGlobalEnabled: newEnabled,
        currentlySpeaking: newEnabled ? prev.currentlySpeaking : false,
        activeMessageId: newEnabled ? prev.activeMessageId : null
      };
    });
  }, []);

  /**
   * Fonction principale pour lire un message (useCallback pour stabilité)
   * ⚠️ IMPORTANT : Ne pas mettre state dans les deps pour éviter re-création constante
   * On accède à state via setState(prev => ...) quand on en a besoin
   */
  const speakMessage = useCallback(async (messageId: string, content: string) => {
    if (!isSupported || !content.trim()) {
      return;
    }

    // Vérifier isGlobalEnabled via setState pour éviter dépendance directe
    let shouldProceed = false;
    setState(prev => {
      shouldProceed = prev.isGlobalEnabled;
      return prev; // Pas de changement
    });

    if (!shouldProceed) {
      return;
    }

    try {
      // Arrêter toute lecture en cours
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }

      // Mettre à jour l'état
      setState(prev => ({
        ...prev,
        currentlySpeaking: true,
        activeMessageId: messageId
      }));

      // Configuration selon le niveau
      const config = EDUCATION_CONFIG[voiceLevel];
      const processedText = preprocessText(content);

      // Détection automatique de la langue pour prononciation correcte
      const detectedLang = detectDominantLanguage(content);

      // Créer l'utterance
      const utterance = new SpeechSynthesisUtterance(processedText);

      // Configuration voix et paramètres
      utterance.rate = config.rate;
      utterance.pitch = config.pitch;
      utterance.volume = config.volume;
      utterance.lang = detectedLang; // ✅ Langue détectée automatiquement

      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      // Gestion des événements
      utterance.onend = () => {
        setState(prev => ({
          ...prev,
          currentlySpeaking: false,
          activeMessageId: null
        }));
      };

      utterance.onerror = (event) => {
        const errorMessage = event.error || 'Unknown speech synthesis error';

        logger.warn('Speech synthesis error', {
          operation: 'audio-manager',
          error: errorMessage,
          messageId,
          voiceLevel,
          selectedVoice: selectedVoice?.name ?? 'none'
        });

        setState(prev => ({
          ...prev,
          currentlySpeaking: false,
          activeMessageId: null
        }));
      };

      // Lancer la synthèse
      speechSynthesis.speak(utterance);

      logger.info('Speech started', {
        operation: 'audio-manager',
        messageId,
        voiceLevel,
        detectedLanguage: detectedLang,
        selectedVoice: selectedVoice?.name ?? 'none'
      });

    } catch (error) {
      logger.error('Failed to start speech', {
        operation: 'audio-manager',
        error: error instanceof Error ? error.message : String(error),
        messageId
      });

      setState(prev => ({
        ...prev,
        currentlySpeaking: false,
        activeMessageId: null
      }));
    }
  }, [isSupported, voiceLevel, selectedVoice, preprocessText]);

  // useMemo pour stabiliser la valeur du contexte
  // Note : state change, mais les fonctions restent stables grâce à useCallback
  const contextValue = useMemo<AudioManagerContext>(() => ({
    state,
    toggleGlobal,
    speakMessage,
    stopSpeaking,
    isSupported,
    selectedVoice,
    voiceLevel
  }), [state, toggleGlobal, speakMessage, stopSpeaking, isSupported, selectedVoice, voiceLevel]);

  return (
    <AudioContext.Provider value={contextValue}>
      {children}
    </AudioContext.Provider>
  );
}
