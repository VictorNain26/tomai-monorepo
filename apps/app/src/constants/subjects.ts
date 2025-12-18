/**
 * Subject Metadata - Données UI pour les matières scolaires
 *
 * Source de vérité frontend pour l'affichage (emoji, color, description).
 * Le backend RAG retourne uniquement les clés des matières disponibles.
 */

import type { EducationLevelType } from '@/types';

// =============================================================================
// Types
// =============================================================================

export interface SubjectMetadata {
  name: string;
  description: string;
  emoji: string;
  color: string;
  ragKeywords: string[];
  ttsLanguage?: string; // BCP 47 language tag pour TTS multilingue
}

export type Lv2Option = 'espagnol' | 'allemand' | 'italien';

export interface Lv2OptionInfo {
  key: Lv2Option;
  name: string;
  description: string;
  emoji: string;
  color: string;
  ttsLanguage: string;
}

// =============================================================================
// Subject Metadata
// =============================================================================

export const SUBJECT_METADATA: Record<string, SubjectMetadata> = {
  mathematiques: {
    name: 'Mathématiques',
    description: 'Calculs, géométrie, algèbre et problèmes',
    emoji: '📐',
    color: 'blue',
    ragKeywords: ['maths', 'calcul', 'géométrie', 'algèbre', 'équation', 'nombre'],
  },
  francais: {
    name: 'Français',
    description: 'Lecture, écriture, grammaire et littérature',
    emoji: '📚',
    color: 'red',
    ragKeywords: ['français', 'grammaire', 'conjugaison', 'orthographe', 'lecture', 'rédaction'],
  },
  physique_chimie: {
    name: 'Physique-Chimie',
    description: 'Sciences physiques et chimiques',
    emoji: '⚗️',
    color: 'purple',
    ragKeywords: ['physique', 'chimie', 'énergie', 'électricité', 'molécule', 'atome'],
  },
  svt: {
    name: 'SVT',
    description: 'Sciences de la Vie et de la Terre',
    emoji: '🌿',
    color: 'green',
    ragKeywords: ['svt', 'biologie', 'géologie', 'vivant', 'cellule', 'environnement'],
  },
  histoire_geo: {
    name: 'Histoire-Géographie',
    description: 'Histoire et géographie de France et du monde',
    emoji: '🌍',
    color: 'orange',
    ragKeywords: ['histoire', 'géographie', 'guerre', 'révolution', 'territoire'],
  },
  anglais: {
    name: 'Anglais',
    description: 'Compréhension, expression et culture anglophone',
    emoji: '🗣️',
    color: 'red',
    ragKeywords: ['anglais', 'english', 'vocabulary', 'grammar', 'conversation'],
    ttsLanguage: 'en-US',
  },
  espagnol: {
    name: 'Espagnol',
    description: 'Vocabulaire, grammaire et culture hispanophone',
    emoji: '💬',
    color: 'yellow',
    ragKeywords: ['espagnol', 'español', 'vocabulario', 'gramática'],
    ttsLanguage: 'es-ES',
  },
  allemand: {
    name: 'Allemand',
    description: 'Expression orale, écrite et culture germanique',
    emoji: '📖',
    color: 'slate',
    ragKeywords: ['allemand', 'deutsch', 'vokabular', 'grammatik'],
    ttsLanguage: 'de-DE',
  },
  italien: {
    name: 'Italien',
    description: 'Langue et civilisation italiennes',
    emoji: '🎭',
    color: 'green',
    ragKeywords: ['italien', 'italiano', 'vocabolario', 'grammatica'],
    ttsLanguage: 'it-IT',
  },
  technologie: {
    name: 'Technologie',
    description: 'Découverte technique et numérique',
    emoji: '⚙️',
    color: 'gray',
    ragKeywords: ['technologie', 'informatique', 'numérique', 'programmation'],
  },
};

// =============================================================================
// LV2 (Seconde Langue Vivante)
// =============================================================================

export const LV2_OPTIONS: Lv2Option[] = ['espagnol', 'allemand', 'italien'];

export const LV2_ELIGIBLE_LEVELS: EducationLevelType[] = [
  'cinquieme', 'quatrieme', 'troisieme',
  'seconde', 'premiere', 'terminale',
];

const LV2_METADATA: Record<Lv2Option, Omit<Lv2OptionInfo, 'key'>> = {
  espagnol: {
    name: 'Espagnol',
    description: 'Vocabulaire, grammaire et culture hispanophone',
    emoji: '💬',
    color: 'yellow',
    ttsLanguage: 'es-ES',
  },
  allemand: {
    name: 'Allemand',
    description: 'Expression orale, écrite et culture germanique',
    emoji: '📖',
    color: 'slate',
    ttsLanguage: 'de-DE',
  },
  italien: {
    name: 'Italien',
    description: 'Langue et civilisation italiennes',
    emoji: '🎭',
    color: 'green',
    ttsLanguage: 'it-IT',
  },
};

// =============================================================================
// Helpers
// =============================================================================

/**
 * Vérifie si un niveau est éligible à la LV2 (5ème et au-dessus)
 */
export function isLv2EligibleLevel(level: EducationLevelType): boolean {
  return LV2_ELIGIBLE_LEVELS.includes(level);
}

/**
 * Retourne les options LV2 disponibles avec leurs métadonnées
 */
export function getLv2Options(): Lv2OptionInfo[] {
  return LV2_OPTIONS.map((key) => ({ key, ...LV2_METADATA[key] }));
}

/**
 * Normalise une clé de matière pour la recherche dans SUBJECT_METADATA
 * Gère les variantes: tirets vs underscores, majuscules vs minuscules
 */
function normalizeSubjectKey(key: string): string {
  return key.toLowerCase().replace(/-/g, '_');
}

/**
 * Mapping des alias RAG vers les clés normalisées
 * Gère les différentes variantes de nommage dans Qdrant
 */
const RAG_KEY_ALIASES: Record<string, string> = {
  'histoire-geo': 'histoire_geo',
  'histoire-geographie': 'histoire_geo',
  'histoire_geographie': 'histoire_geo',
  'physique-chimie': 'physique_chimie',
  'sciences': 'svt',
  'sciences-vie-terre': 'svt',
  'langues-vivantes': 'anglais',
  'lv1': 'anglais',
  'lv2': 'espagnol',
  'maths': 'mathematiques',
  'math': 'mathematiques',
  'techno': 'technologie',
  'info': 'technologie',
  'informatique': 'technologie',
};

/**
 * Enrichit une clé de matière avec ses métadonnées UI
 * Gère les variantes de clés RAG (tirets, underscores, alias)
 */
export function enrichSubjectKey(key: string): SubjectMetadata {
  // 1. Essai direct
  if (SUBJECT_METADATA[key]) {
    return SUBJECT_METADATA[key];
  }

  // 2. Normalisation (tirets → underscores, lowercase)
  const normalizedKey = normalizeSubjectKey(key);
  if (SUBJECT_METADATA[normalizedKey]) {
    return SUBJECT_METADATA[normalizedKey];
  }

  // 3. Alias connus
  const aliasKey = RAG_KEY_ALIASES[normalizedKey];
  if (aliasKey && SUBJECT_METADATA[aliasKey]) {
    return SUBJECT_METADATA[aliasKey];
  }

  // 4. Matching par préfixe (ex: "mathematiques-algebre" → "mathematiques")
  for (const metaKey of Object.keys(SUBJECT_METADATA)) {
    if (normalizedKey.startsWith(metaKey)) {
      return SUBJECT_METADATA[metaKey];
    }
  }

  // 5. Fallback pour matières inconnues
  const displayName = key
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());

  return {
    name: displayName,
    description: `Cours de ${displayName.toLowerCase()}`,
    emoji: '📖',
    color: 'gray',
    ragKeywords: [key, normalizedKey],
  };
}

/**
 * Vérifie si une matière est une LV2
 */
export function isLv2Subject(subjectKey: string): boolean {
  return LV2_OPTIONS.includes(subjectKey as Lv2Option);
}
