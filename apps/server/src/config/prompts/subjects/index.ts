/**
 * Subjects Router - Charge le prompt approprié par matière
 * Architecture optimisée : chargement conditionnel
 *
 * Matières supportées (présentes dans RAG Qdrant) :
 * - Mathématiques
 * - Français
 * - Langues vivantes (Anglais, Espagnol, Allemand, Italien)
 * - Sciences (SVT, Physique-Chimie)
 * - Histoire-Géographie-EMC
 *
 * Note: Les conversations hors-sujet (bonjour, merci...) sont gérées
 * par le core system prompt, pas par un prompt matière.
 */

import { generateMathPrompt } from './mathematiques.js';
import { generateFrancaisPrompt } from './francais.js';
import { generateLanguesPrompt } from './langues.js';
import { generateSciencesPrompt } from './sciences.js';
import { generateHistoireGeoPrompt } from './histoire-geo.js';

import type { EducationLevelType } from '../../../types/index.js';

export interface SubjectPromptParams {
  subject: string;
  query: string;
  isExercice?: boolean;
  isProduction?: boolean;
  /** Niveau scolaire pour adaptation KaTeX */
  level?: EducationLevelType;
}

/**
 * Normalise le nom de matière pour le routage
 * Retourne null si la matière n'est pas supportée
 */
function normalizeSubject(subject: string): string | null {
  const s = subject.toLowerCase().trim();

  // Mathématiques
  if (s.includes('math')) return 'mathematiques';

  // Français
  if (s === 'français' || s === 'francais') return 'francais';

  // Langues vivantes
  if (['anglais', 'espagnol', 'allemand', 'italien', 'english', 'spanish', 'german'].includes(s)) {
    return 'langues';
  }

  // Sciences
  if (['svt', 'sciences', 'biologie', 'physique', 'chimie', 'physique-chimie', 'physique_chimie'].includes(s)) {
    return 'sciences';
  }

  // Histoire-Géographie-EMC
  if (['histoire', 'géographie', 'geographie', 'histoire-géographie', 'histoire-geo', 'emc', 'hggsp'].includes(s)) {
    return 'histoire-geo';
  }

  // Matière non reconnue - pas de prompt spécifique
  return null;
}

/**
 * Génère le prompt spécifique à la matière
 * Retourne les règles pédagogiques de la matière, ou null si non reconnue
 * Les conversations hors-sujet sont gérées par le core system prompt
 */
export function generateSubjectPrompt(params: SubjectPromptParams): string | null {
  const { subject, query, isExercice, isProduction, level } = params;
  const normalizedSubject = normalizeSubject(subject);

  if (!normalizedSubject) {
    return null;
  }

  switch (normalizedSubject) {
    case 'mathematiques':
      return generateMathPrompt({ query, isExercice, level });

    case 'francais':
      return generateFrancaisPrompt({ isProduction, isExercice });

    case 'langues':
      return generateLanguesPrompt({ isExercice });

    case 'sciences':
      return generateSciencesPrompt({ isExercice });

    case 'histoire-geo':
      return generateHistoireGeoPrompt({ isExercice });

    default:
      return null;
  }
}

/**
 * Vérifie si la matière nécessite KaTeX
 */
export function requiresKaTeX(subject: string): boolean {
  const s = subject.toLowerCase();
  return s.includes('math') || s.includes('physique') || s.includes('chimie');
}

// Re-exports
export { generateMathPrompt } from './mathematiques.js';
export { generateFrancaisPrompt } from './francais.js';
export { generateLanguesPrompt } from './langues.js';
export { generateSciencesPrompt } from './sciences.js';
export { generateHistoireGeoPrompt } from './histoire-geo.js';
