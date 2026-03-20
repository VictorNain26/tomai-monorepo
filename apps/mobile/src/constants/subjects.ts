/**
 * Subject Metadata - Donnees UI pour les matieres scolaires
 *
 * Source de verite frontend pour l'affichage (icon, color, description).
 * Le backend RAG retourne uniquement les cles des matieres disponibles.
 */

// =============================================================================
// Types
// =============================================================================

export type SubjectColor =
  | 'blue' | 'violet' | 'purple' | 'emerald' | 'amber'
  | 'rose' | 'yellow' | 'slate' | 'teal' | 'gray';

export interface SubjectMetadata {
  name: string;
  description: string;
  icon: string;
  color: SubjectColor;
}

// =============================================================================
// Color Styles Mapping
// =============================================================================

const SUBJECT_COLOR_STYLES: Record<SubjectColor, {
  bg: string;
  bgSubtle: string;
  text: string;
  border: string;
  iconColor: { light: string; dark: string };
}> = {
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-950',
    bgSubtle: 'bg-blue-100/50 dark:bg-blue-900/30',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
    iconColor: { light: '#3B82F6', dark: '#60A5FA' },
  },
  violet: {
    bg: 'bg-violet-50 dark:bg-violet-950',
    bgSubtle: 'bg-violet-100/50 dark:bg-violet-900/30',
    text: 'text-violet-600 dark:text-violet-400',
    border: 'border-violet-200 dark:border-violet-800',
    iconColor: { light: '#7C3AED', dark: '#A78BFA' },
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-950',
    bgSubtle: 'bg-purple-100/50 dark:bg-purple-900/30',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800',
    iconColor: { light: '#9333EA', dark: '#C084FC' },
  },
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-950',
    bgSubtle: 'bg-emerald-100/50 dark:bg-emerald-900/30',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800',
    iconColor: { light: '#059669', dark: '#34D399' },
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-950',
    bgSubtle: 'bg-amber-100/50 dark:bg-amber-900/30',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800',
    iconColor: { light: '#D97706', dark: '#FBBF24' },
  },
  rose: {
    bg: 'bg-rose-50 dark:bg-rose-950',
    bgSubtle: 'bg-rose-100/50 dark:bg-rose-900/30',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-200 dark:border-rose-800',
    iconColor: { light: '#E11D48', dark: '#FB7185' },
  },
  yellow: {
    bg: 'bg-yellow-50 dark:bg-yellow-950',
    bgSubtle: 'bg-yellow-100/50 dark:bg-yellow-900/30',
    text: 'text-yellow-600 dark:text-yellow-400',
    border: 'border-yellow-200 dark:border-yellow-800',
    iconColor: { light: '#CA8A04', dark: '#FACC15' },
  },
  slate: {
    bg: 'bg-slate-50 dark:bg-slate-900',
    bgSubtle: 'bg-slate-100/50 dark:bg-slate-800/30',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-200 dark:border-slate-700',
    iconColor: { light: '#475569', dark: '#94A3B8' },
  },
  teal: {
    bg: 'bg-teal-50 dark:bg-teal-950',
    bgSubtle: 'bg-teal-100/50 dark:bg-teal-900/30',
    text: 'text-teal-600 dark:text-teal-400',
    border: 'border-teal-200 dark:border-teal-800',
    iconColor: { light: '#0D9488', dark: '#2DD4BF' },
  },
  gray: {
    bg: 'bg-stone-50 dark:bg-stone-900',
    bgSubtle: 'bg-stone-100/50 dark:bg-stone-800/30',
    text: 'text-stone-600 dark:text-stone-400',
    border: 'border-stone-200 dark:border-stone-700',
    iconColor: { light: '#57534E', dark: '#A8A29E' },
  },
};

export function getSubjectStyles(color: SubjectColor) {
  return SUBJECT_COLOR_STYLES[color];
}

// =============================================================================
// Subject Metadata (cles RAG backend)
// =============================================================================

export const SUBJECT_METADATA: Record<string, SubjectMetadata> = {
  mathematiques: {
    name: 'Mathematiques',
    description: 'Calculs, geometrie, algebre et problemes',
    icon: 'Calculator',
    color: 'blue',
  },
  francais: {
    name: 'Francais',
    description: 'Lecture, ecriture, grammaire et litterature',
    icon: 'BookOpen',
    color: 'violet',
  },
  physique_chimie: {
    name: 'Physique-Chimie',
    description: 'Sciences physiques et chimiques',
    icon: 'FlaskConical',
    color: 'purple',
  },
  svt: {
    name: 'SVT',
    description: 'Sciences de la Vie et de la Terre',
    icon: 'Leaf',
    color: 'emerald',
  },
  histoire_geo: {
    name: 'Histoire-Geographie',
    description: 'Histoire et geographie de France et du monde',
    icon: 'Globe',
    color: 'amber',
  },
  anglais: {
    name: 'Anglais',
    description: 'Comprehension, expression et culture anglophone',
    icon: 'Languages',
    color: 'rose',
  },
  espagnol: {
    name: 'Espagnol',
    description: 'Vocabulaire, grammaire et culture hispanophone',
    icon: 'MessageCircle',
    color: 'yellow',
  },
  allemand: {
    name: 'Allemand',
    description: 'Expression orale, ecrite et culture germanique',
    icon: 'Book',
    color: 'slate',
  },
  italien: {
    name: 'Italien',
    description: 'Langue et civilisation italiennes',
    icon: 'Drama',
    color: 'teal',
  },
  technologie: {
    name: 'Technologie',
    description: 'Decouverte technique et numerique',
    icon: 'Cog',
    color: 'gray',
  },
};

// =============================================================================
// Helpers
// =============================================================================

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

function normalizeSubjectKey(key: string): string {
  return key.toLowerCase().replace(/-/g, '_');
}

export function enrichSubjectKey(key: string): SubjectMetadata {
  if (SUBJECT_METADATA[key]) {
    return SUBJECT_METADATA[key];
  }

  const normalizedKey = normalizeSubjectKey(key);
  if (SUBJECT_METADATA[normalizedKey]) {
    return SUBJECT_METADATA[normalizedKey];
  }

  const aliasKey = RAG_KEY_ALIASES[normalizedKey];
  if (aliasKey && SUBJECT_METADATA[aliasKey]) {
    return SUBJECT_METADATA[aliasKey];
  }

  for (const metaKey of Object.keys(SUBJECT_METADATA)) {
    if (normalizedKey.startsWith(metaKey)) {
      return SUBJECT_METADATA[metaKey];
    }
  }

  const displayName = key
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());

  return {
    name: displayName,
    description: `Cours de ${displayName.toLowerCase()}`,
    icon: 'GraduationCap',
    color: 'gray',
  };
}
