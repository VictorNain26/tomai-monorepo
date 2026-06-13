/**
 * Service de Transcription Audio - TomAI
 *
 * Architecture Gladia 100% (Migration Janvier 2025):
 * - Gladia (France) : Transcription STT haute précision
 * - Analyse de prononciation : Programmatique (scores confiance + comparaison texte)
 *
 * ❌ Plus de dépendance Gemini pour l'audio
 *
 * Cas d'usage éducatif principal :
 * - Matières de langue (anglais, espagnol, allemand) : analyse de prononciation
 * - Dictées et lecture à voix haute
 * - Exercices oraux
 */

import { logger } from '../lib/observability.js';
import type { EducationLevelType } from '../types/education.types.js';
import {
  getGladiaTranscriptionService,
  isGladiaConfigured,
  type GladiaTranscriptionResult,
} from './gladia-transcription.service.js';

// ============================================
// Types
// ============================================

interface TranscriptionResult {
  success: boolean;
  transcription?: string;
  pronunciationAnalysis?: {
    score: number; // 0-100
    feedback: string; // Feedback pédagogique
    corrections?: string[]; // Corrections suggérées
    strengths?: string[]; // Points forts
  };
  detectedLanguage?: string;
  duration?: number; // Durée estimée en secondes
  _error?: string;
}

interface TranscriptionOptions {
  /** Langue cible pour l'analyse de prononciation */
  targetLanguage?: 'fr' | 'en' | 'es' | 'de';
  /** Niveau scolaire pour adapter le feedback */
  schoolLevel?: EducationLevelType;
  /** Texte de référence pour comparaison (dictée, lecture) */
  referenceText?: string;
  /** Contexte pédagogique (prononciation, dictée, lecture) */
  context?: 'pronunciation' | 'dictation' | 'reading' | 'general';
}

// ============================================
// Feedback Templates par niveau
// ============================================

const FEEDBACK_TEMPLATES = {
  excellent: {
    primaire: 'Bravo ! Tu as très bien prononcé, continue comme ça ! 🌟',
    college: 'Excellent travail ! Ta prononciation est très claire.',
    lycee: 'Excellente maîtrise de la prononciation. Performance remarquable.',
  },
  good: {
    primaire: 'C\'est bien ! Tu progresses, encore un petit effort ! 👍',
    college: 'Bonne prononciation dans l\'ensemble. Quelques points à améliorer.',
    lycee: 'Bonne performance. Attention à quelques subtilités de prononciation.',
  },
  average: {
    primaire: 'Pas mal ! Continue à t\'entraîner, tu vas y arriver ! 💪',
    college: 'Prononciation correcte mais perfectible. Entraîne-toi sur les mots difficiles.',
    lycee: 'Prononciation acceptable. Travaille les points mentionnés pour progresser.',
  },
  needsWork: {
    primaire: 'Continue à t\'entraîner ! Écoute bien et répète doucement. 🎯',
    college: 'Il faut retravailler la prononciation. Écoute des exemples natifs.',
    lycee: 'Prononciation à améliorer. Concentre-toi sur l\'articulation et l\'intonation.',
  },
};

const LANG_NAMES: Record<string, string> = {
  fr: 'français',
  en: 'anglais',
  es: 'espagnol',
  de: 'allemand',
};

// ============================================
// Service
// ============================================

class AudioTranscriptionService {
  constructor() {
    if (!isGladiaConfigured()) {
      logger.warn('Gladia API key not configured - audio transcription will fail', {
        operation: 'audio:init',
      });
    }
  }

  /**
   * Transcrit un fichier audio et analyse la prononciation si demandé
   * Utilise Gladia 100% + analyse programmatique
   */
  async transcribeAudio(
    audioBuffer: ArrayBuffer,
    mimeType: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();

    const {
      targetLanguage = 'fr',
      schoolLevel,
      referenceText,
      context = 'general',
    } = options;

    // Vérifier que Gladia est configuré
    if (!isGladiaConfigured()) {
      return {
        success: false,
        _error: 'Service de transcription non configuré (GLADIA_API_KEY manquant)',
      };
    }

    try {
      // Transcription via Gladia
      const gladiaService = getGladiaTranscriptionService();
      const gladiaResult = await gladiaService.transcribe(audioBuffer, mimeType, {
        language: targetLanguage,
        detectLanguage: true,
      });

      if (!gladiaResult.success || !gladiaResult.transcription) {
        logger.error('Gladia transcription failed', {
          operation: 'audio:transcription',
          _error: gladiaResult.error ?? 'No transcription result',
          severity: 'high' as const,
        });

        return {
          success: false,
          _error: gladiaResult.error ?? 'Échec de la transcription',
        };
      }

      // Construire le résultat de base
      const result: TranscriptionResult = {
        success: true,
        transcription: gladiaResult.transcription,
        detectedLanguage: gladiaResult.detectedLanguage ?? targetLanguage,
        duration: gladiaResult.duration,
      };

      // Ajouter l'analyse de prononciation si contexte approprié
      if (context !== 'general' && gladiaResult.words && gladiaResult.words.length > 0) {
        result.pronunciationAnalysis = this.buildPronunciationAnalysis(
          gladiaResult,
          referenceText,
          targetLanguage,
          schoolLevel,
          context
        );
      }

      logger.info('Audio transcription completed (Gladia 100%)', {
        operation: 'audio:transcription',
        provider: 'gladia',
        context,
        targetLanguage,
        hasAnalysis: !!result.pronunciationAnalysis,
        durationMs: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      logger.error('Audio transcription error', {
        operation: 'audio:transcription',
        _error: error instanceof Error ? error.message : String(error),
        severity: 'high' as const,
      });

      return {
        success: false,
        _error: 'Échec de la transcription audio',
      };
    }
  }

  /**
   * Construit l'analyse de prononciation à partir des données Gladia
   */
  private buildPronunciationAnalysis(
    gladiaResult: GladiaTranscriptionResult,
    referenceText: string | undefined,
    targetLanguage: string,
    schoolLevel: EducationLevelType | undefined,
    context: string
  ): TranscriptionResult['pronunciationAnalysis'] {
    const words = gladiaResult.words ?? [];
    const transcription = gladiaResult.transcription ?? '';

    // 1. Calculer le score basé sur la confiance moyenne
    const avgConfidence = gladiaResult.confidence ?? this.calculateAverageConfidence(words);
    const score = Math.round(avgConfidence * 100);

    // 2. Identifier les mots bien/mal prononcés
    const wellPronouncedWords = words.filter((w) => w.confidence >= 0.85);
    const poorlyPronouncedWords = words.filter((w) => w.confidence < 0.7);

    // 3. Comparer avec le texte de référence si fourni
    const textComparison = referenceText
      ? this.compareTexts(transcription, referenceText)
      : null;

    // 4. Construire les corrections
    const corrections: string[] = [];

    // Mots avec faible confiance
    if (poorlyPronouncedWords.length > 0) {
      const poorWords = poorlyPronouncedWords.slice(0, 3).map((w) => `"${w.word}"`);
      corrections.push(`Travaille la prononciation de : ${poorWords.join(', ')}`);
    }

    // Mots manquants ou différents (si référence)
    if (textComparison && textComparison.missingWords.length > 0) {
      const missing = textComparison.missingWords.slice(0, 3).map((w) => `"${w}"`);
      corrections.push(`Mots manquants ou mal compris : ${missing.join(', ')}`);
    }

    if (textComparison && textComparison.extraWords.length > 0) {
      corrections.push(`Attention aux mots en trop ou mal placés`);
    }

    // 5. Construire les points forts
    const strengths: string[] = [];

    if (wellPronouncedWords.length >= words.length * 0.7) {
      strengths.push('Bonne articulation générale');
    }

    if (score >= 80) {
      strengths.push(`Bonne maîtrise du ${LANG_NAMES[targetLanguage] ?? targetLanguage}`);
    }

    if (textComparison && textComparison.matchRate >= 0.9) {
      strengths.push('Texte bien restitué');
    }

    if (words.length > 0 && poorlyPronouncedWords.length === 0) {
      strengths.push('Tous les mots sont clairement prononcés');
    }

    // 6. Générer le feedback adapté au niveau
    const feedback = this.generateFeedback(score, schoolLevel, context, targetLanguage);

    return {
      score,
      feedback,
      corrections: corrections.length > 0 ? corrections : undefined,
      strengths: strengths.length > 0 ? strengths : undefined,
    };
  }

  /**
   * Calcule la confiance moyenne à partir des mots
   */
  private calculateAverageConfidence(
    words: Array<{ word: string; confidence: number }>
  ): number {
    if (words.length === 0) return 0.5;
    const sum = words.reduce((acc, w) => acc + w.confidence, 0);
    return sum / words.length;
  }

  /**
   * Compare le texte transcrit avec le texte de référence
   */
  private compareTexts(
    transcription: string,
    referenceText: string
  ): { matchRate: number; missingWords: string[]; extraWords: string[] } {
    // Normaliser les textes
    const normalize = (text: string) =>
      text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Enlever accents
        .replace(/[.,!?;:'"()-]/g, '') // Enlever ponctuation
        .split(/\s+/)
        .filter((w) => w.length > 0);

    const transcribedWords = normalize(transcription);
    const referenceWords = normalize(referenceText);

    const transcribedSet = new Set(transcribedWords);
    const referenceSet = new Set(referenceWords);

    // Mots manquants (dans référence mais pas dans transcription)
    const missingWords = referenceWords.filter((w) => !transcribedSet.has(w));

    // Mots en trop (dans transcription mais pas dans référence)
    const extraWords = transcribedWords.filter((w) => !referenceSet.has(w));

    // Taux de correspondance
    const matchingWords = referenceWords.filter((w) => transcribedSet.has(w));
    const matchRate = referenceWords.length > 0 ? matchingWords.length / referenceWords.length : 1;

    return {
      matchRate,
      missingWords: [...new Set(missingWords)], // Dédupliquer
      extraWords: [...new Set(extraWords)],
    };
  }

  /**
   * Génère le feedback adapté au niveau scolaire
   */
  private generateFeedback(
    score: number,
    schoolLevel: EducationLevelType | undefined,
    context: string,
    targetLanguage: string
  ): string {
    // Déterminer la catégorie de niveau
    const levelCategory = this.getLevelCategory(schoolLevel);

    // Déterminer la catégorie de score
    let scoreCategory: 'excellent' | 'good' | 'average' | 'needsWork';
    if (score >= 90) {
      scoreCategory = 'excellent';
    } else if (score >= 75) {
      scoreCategory = 'good';
    } else if (score >= 60) {
      scoreCategory = 'average';
    } else {
      scoreCategory = 'needsWork';
    }

    // Récupérer le template
    const template = FEEDBACK_TEMPLATES[scoreCategory][levelCategory];

    // Ajouter contexte si lecture/dictée
    if (context === 'reading') {
      return `${template} Continue à lire à voix haute régulièrement.`;
    } else if (context === 'dictation') {
      return `${template} La pratique de la dictée améliore l'orthographe.`;
    } else if (context === 'pronunciation' && targetLanguage !== 'fr') {
      return `${template} Écoute des locuteurs natifs en ${LANG_NAMES[targetLanguage] ?? targetLanguage}.`;
    }

    return template;
  }

  /**
   * Détermine la catégorie de niveau (primaire, collège, lycée)
   */
  private getLevelCategory(
    schoolLevel: EducationLevelType | undefined
  ): 'primaire' | 'college' | 'lycee' {
    if (!schoolLevel) return 'college'; // Défaut

    const primaire = ['cp', 'ce1', 'ce2', 'cm1', 'cm2'];
    const college = ['sixieme', 'cinquieme', 'quatrieme', 'troisieme'];

    if (primaire.includes(schoolLevel)) return 'primaire';
    if (college.includes(schoolLevel)) return 'college';
    return 'lycee';
  }
}

// Singleton export
export const audioTranscriptionService = new AudioTranscriptionService();
