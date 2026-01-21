/**
 * Subject Metadata - Données UI pour les matières scolaires
 *
 * Source de vérité frontend pour l'affichage (emoji, color, description).
 * Le backend RAG retourne uniquement les clés des matières disponibles.
 *
 * Basé sur apps/app/src/constants/subjects.ts pour cohérence.
 */

// =============================================================================
// Types
// =============================================================================

export interface SubjectMetadata {
  name: string;
  description: string;
  emoji: string;
  color: string;
}

// =============================================================================
// Subject Metadata (clés RAG backend)
// =============================================================================

export const SUBJECT_METADATA: Record<string, SubjectMetadata> = {
  mathematiques: {
    name: 'Mathématiques',
    description: 'Calculs, géométrie, algèbre et problèmes',
    emoji: '📐',
    color: 'blue',
  },
  francais: {
    name: 'Français',
    description: 'Lecture, écriture, grammaire et littérature',
    emoji: '📚',
    color: 'red',
  },
  physique_chimie: {
    name: 'Physique-Chimie',
    description: 'Sciences physiques et chimiques',
    emoji: '⚗️',
    color: 'purple',
  },
  svt: {
    name: 'SVT',
    description: 'Sciences de la Vie et de la Terre',
    emoji: '🌿',
    color: 'green',
  },
  histoire_geo: {
    name: 'Histoire-Géographie',
    description: 'Histoire et géographie de France et du monde',
    emoji: '🌍',
    color: 'orange',
  },
  anglais: {
    name: 'Anglais',
    description: 'Compréhension, expression et culture anglophone',
    emoji: '🗣️',
    color: 'red',
  },
  espagnol: {
    name: 'Espagnol',
    description: 'Vocabulaire, grammaire et culture hispanophone',
    emoji: '💬',
    color: 'yellow',
  },
  allemand: {
    name: 'Allemand',
    description: 'Expression orale, écrite et culture germanique',
    emoji: '📖',
    color: 'slate',
  },
  italien: {
    name: 'Italien',
    description: 'Langue et civilisation italiennes',
    emoji: '🎭',
    color: 'green',
  },
  technologie: {
    name: 'Technologie',
    description: 'Découverte technique et numérique',
    emoji: '⚙️',
    color: 'gray',
  },
};

// =============================================================================
// Helpers
// =============================================================================

/**
 * Mapping des alias RAG vers les clés normalisées
 */
const RAG_KEY_ALIASES: Record<string, string> = {
  'histoire-geo': 'histoire_geo',
  'histoire-geographie': 'histoire_geo',
  'histoire_geographie': 'histoire_geo',
  'physique-chimie': 'physique_chimie',
  sciences: 'svt',
  'sciences-vie-terre': 'svt',
  'langues-vivantes': 'anglais',
  lv1: 'anglais',
  lv2: 'espagnol',
  maths: 'mathematiques',
  math: 'mathematiques',
  techno: 'technologie',
  info: 'technologie',
  informatique: 'technologie',
};

/**
 * Normalise une clé de matière (tirets → underscores, lowercase)
 */
function normalizeSubjectKey(key: string): string {
  return key.toLowerCase().replace(/-/g, '_');
}

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
  };
}
