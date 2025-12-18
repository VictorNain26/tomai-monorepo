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
 * Best Practice 2025 : L'IA choisit automatiquement le mode (cours/exercice)
 */
export function generateSubjectPrompt(params: SubjectPromptParams): string | null {
  const { subject, query, level } = params;
  const normalizedSubject = normalizeSubject(subject);

  if (!normalizedSubject) {
    return null;
  }

  switch (normalizedSubject) {
    case 'mathematiques':
      return generateMathPrompt({ query, level });

    case 'francais':
      return generateFrancaisPrompt();

    case 'langues':
      return generateLanguesPrompt();

    case 'sciences':
      return generateSciencesPrompt();

    case 'histoire-geo':
      return generateHistoireGeoPrompt();

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
