/**
 * SubjectIcons - Icônes modernes pour chaque matière
 *
 * Mapping centralisé des icônes lucide-react pour chaque matière éducative.
 * Basé sur les clés RÉELLES du backend (school-subjects.config.ts + RAG data)
 */

import {
  BookText,
  SquareRadical,
  Globe,
  Activity,
  Music2,
  Paintbrush,
  Atom,
  Landmark,
  BrainCircuit,
  Dna,
  Earth,
  Beaker,
  Scale,
  Sparkles,
  Microscope,
  FlaskConical,
  Cog,
  ChartBar,
  Languages,
  GraduationCap,
  Presentation,
  Book,
  Target,
  type LucideIcon
} from 'lucide-react';

export type SubjectKey =
  // Matières de base (toutes classes)
  | 'mathematiques'
  | 'francais'
  | 'sciences'
  | 'histoire'
  | 'geographie'
  | 'anglais'
  // Collège
  | 'svt'
  | 'physique'
  | 'physique-chimie'
  | 'technologie'
  // Lycée
  | 'philosophie'
  | 'economie'
  | 'sciences-economiques-sociales'
  // Primaire
  | 'anglais-initiation'
  | 'sciences-et-technologie'
  | 'sciences-technologie'
  | 'sciences-numeriques-technologie'
  | 'questionner-le-monde'
  // Langues vivantes
  | 'anglais-lv1'
  | 'anglais-lv2'
  | 'espagnol'
  | 'espagnol-lv2'
  | 'allemand'
  | 'allemand-lv2'
  | 'italien'
  | 'italien-lv2'
  | 'langues-vivantes'
  // Arts et Sport
  | 'arts-plastiques'
  | 'education-musicale'
  | 'education-physique-sportive'
  | 'eps'
  // Éducation civique
  | 'education-civique'
  | 'emc'
  | 'enseignement-moral-civique'
  // Méthodologie
  | 'grand-oral-methodologie'
  | 'brevet-methodologie'
  // Spécialités lycée
  | 'specialite-mathematiques'
  | 'specialite-physique-chimie'
  | 'specialite-svt'
  | 'specialite-ses'
  // Autres
  | 'sciences-physiques'
  | 'chimie'
  | 'enseignement-scientifique'
  | 'histoire-geographie'
  | 'autre';

export interface SubjectIconConfig {
  icon: LucideIcon;
  color: string; // TailwindCSS color class
  bgColor: string; // Background color class
  label: string;
}

/**
 * Mapping des icônes par clé de matière
 * Basé sur les clés RÉELLES du backend
 */
export const SUBJECT_ICONS: Record<SubjectKey, SubjectIconConfig> = {
  // MATIÈRES DE BASE (Primaire → Lycée)
  francais: {
    icon: BookText,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-950/30',
    label: 'Français'
  },
  mathematiques: {
    icon: SquareRadical,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-950/30',
    label: 'Mathématiques'
  },
  sciences: {
    icon: Microscope,
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-100 dark:bg-cyan-950/30',
    label: 'Sciences'
  },
  'sciences-et-technologie': {
    icon: FlaskConical,
    color: 'text-teal-600 dark:text-teal-400',
    bgColor: 'bg-teal-100 dark:bg-teal-950/30',
    label: 'Sciences et Technologie'
  },
  histoire: {
    icon: Landmark,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-950/30',
    label: 'Histoire'
  },
  geographie: {
    icon: Earth,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-950/30',
    label: 'Géographie'
  },
  'histoire-geographie': {
    icon: Landmark,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-950/30',
    label: 'Histoire-Géographie'
  },

  // LANGUES
  anglais: {
    icon: Globe,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-950/30',
    label: 'Anglais'
  },
  'anglais-initiation': {
    icon: Globe,
    color: 'text-red-500 dark:text-red-300',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    label: 'Anglais (Initiation)'
  },
  'anglais-lv1': {
    icon: Globe,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-950/30',
    label: 'Anglais LV1'
  },
  'anglais-lv2': {
    icon: Globe,
    color: 'text-red-500 dark:text-red-300',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    label: 'Anglais LV2'
  },
  espagnol: {
    icon: Globe,
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-950/30',
    label: 'Espagnol'
  },
  'espagnol-lv2': {
    icon: Globe,
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-950/30',
    label: 'Espagnol LV2'
  },
  allemand: {
    icon: Globe,
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-950/30',
    label: 'Allemand'
  },
  'allemand-lv2': {
    icon: Globe,
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-950/30',
    label: 'Allemand LV2'
  },
  italien: {
    icon: Globe,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-950/30',
    label: 'Italien'
  },
  'italien-lv2': {
    icon: Globe,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-950/30',
    label: 'Italien LV2'
  },
  'langues-vivantes': {
    icon: Languages,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-950/30',
    label: 'Langues Vivantes'
  },

  // SCIENCES (Collège/Lycée)
  svt: {
    icon: Dna,
    color: 'text-lime-600 dark:text-lime-400',
    bgColor: 'bg-lime-100 dark:bg-lime-950/30',
    label: 'SVT'
  },
  physique: {
    icon: Atom,
    color: 'text-sky-600 dark:text-sky-400',
    bgColor: 'bg-sky-100 dark:bg-sky-950/30',
    label: 'Physique-Chimie'
  },
  chimie: {
    icon: Beaker,
    color: 'text-teal-600 dark:text-teal-400',
    bgColor: 'bg-teal-100 dark:bg-teal-950/30',
    label: 'Chimie'
  },
  'sciences-physiques': {
    icon: FlaskConical,
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-100 dark:bg-cyan-950/30',
    label: 'Sciences Physiques'
  },
  'enseignement-scientifique': {
    icon: Microscope,
    color: 'text-cyan-700 dark:text-cyan-300',
    bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
    label: 'Enseignement Scientifique'
  },

  // TECHNOLOGIE
  technologie: {
    icon: Cog,
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-950/30',
    label: 'Technologie'
  },

  // LYCÉE
  philosophie: {
    icon: BrainCircuit,
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-100 dark:bg-violet-950/30',
    label: 'Philosophie'
  },
  economie: {
    icon: ChartBar,
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-100 dark:bg-rose-950/30',
    label: 'SES'
  },

  // ARTS ET SPORT
  'arts-plastiques': {
    icon: Paintbrush,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-950/30',
    label: 'Arts Plastiques'
  },
  'education-musicale': {
    icon: Music2,
    color: 'text-pink-600 dark:text-pink-400',
    bgColor: 'bg-pink-100 dark:bg-pink-950/30',
    label: 'Éducation Musicale'
  },
  'education-physique-sportive': {
    icon: Activity,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-950/30',
    label: 'EPS'
  },

  // ÉDUCATION CIVIQUE (toutes variantes)
  'education-civique': {
    icon: Scale,
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-100 dark:bg-indigo-950/30',
    label: 'Éducation Civique'
  },
  'emc': {
    icon: Scale,
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-100 dark:bg-indigo-950/30',
    label: 'EMC'
  },
  'enseignement-moral-civique': {
    icon: Scale,
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-100 dark:bg-indigo-950/30',
    label: 'Enseignement Moral et Civique'
  },

  // EPS (toutes variantes)
  'eps': {
    icon: Activity,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-950/30',
    label: 'EPS'
  },

  // PHYSIQUE-CHIMIE (nom composé)
  'physique-chimie': {
    icon: Atom,
    color: 'text-sky-600 dark:text-sky-400',
    bgColor: 'bg-sky-100 dark:bg-sky-950/30',
    label: 'Physique-Chimie'
  },

  // SCIENCES ÉCONOMIQUES ET SOCIALES
  'sciences-economiques-sociales': {
    icon: ChartBar,
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-100 dark:bg-rose-950/30',
    label: 'Sciences Économiques et Sociales'
  },

  // SCIENCES ET TECHNOLOGIE variantes
  'sciences-technologie': {
    icon: FlaskConical,
    color: 'text-teal-600 dark:text-teal-400',
    bgColor: 'bg-teal-100 dark:bg-teal-950/30',
    label: 'Sciences et Technologie'
  },
  'sciences-numeriques-technologie': {
    icon: Cog,
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-100 dark:bg-cyan-950/30',
    label: 'Sciences Numériques et Technologie'
  },

  // QUESTIONNER LE MONDE (primaire) - toutes variantes
  'questionner-le-monde': {
    icon: Book,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-950/30',
    label: 'Questionner le Monde'
  },

  // MÉTHODOLOGIE
  'grand-oral-methodologie': {
    icon: Presentation,
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-100 dark:bg-indigo-950/30',
    label: 'Grand Oral - Méthodologie'
  },
  'brevet-methodologie': {
    icon: GraduationCap,
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-100 dark:bg-violet-950/30',
    label: 'Brevet - Méthodologie'
  },

  // SPÉCIALITÉS LYCÉE
  'specialite-mathematiques': {
    icon: Target,
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    label: 'Spé Mathématiques'
  },
  'specialite-physique-chimie': {
    icon: Target,
    color: 'text-sky-700 dark:text-sky-300',
    bgColor: 'bg-sky-50 dark:bg-sky-900/20',
    label: 'Spé Physique-Chimie'
  },
  'specialite-svt': {
    icon: Target,
    color: 'text-lime-700 dark:text-lime-300',
    bgColor: 'bg-lime-50 dark:bg-lime-900/20',
    label: 'Spé SVT'
  },
  'specialite-ses': {
    icon: Target,
    color: 'text-rose-700 dark:text-rose-300',
    bgColor: 'bg-rose-50 dark:bg-rose-900/20',
    label: 'Spé SES'
  },

  // AUTRE (fallback)
  autre: {
    icon: Sparkles,
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-950/30',
    label: 'Autre'
  }
};

/**
 * Obtenir la configuration d'icône pour une matière avec logique intelligente
 *
 * Gère automatiquement toutes les variantes RAG (120+ matières):
 * - Compétences langues: anglais-lv1-listening → anglais-lv1
 * - Sous-thèmes: francais-grammaire → francais
 * - Variantes EMC: enseignement-moral-et-civique-* → emc
 * - Variantes EPS: education-physique-*-activites-* → eps
 * - Matières complètes: mathematiques-complet → mathematiques
 * - Spécialités: specialite-* (icône Target avec couleur matière)
 *
 * @param subjectKey - Clé de la matière (ex: "mathematiques", "anglais-lv1-listening")
 * @returns Configuration d'icône ou config par défaut
 */
export function getSubjectIcon(subjectKey: string): SubjectIconConfig {
  // Normalisation UNIFIÉE : tout en tirets (standard RAG data)
  const normalizedKey = subjectKey
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/_/g, '-')
    .replace(/:/g, '-'); // Gérer les ":" dans certains noms RAG

  // 1️⃣ CORRESPONDANCE EXACTE
  const exactMatch = SUBJECT_ICONS[normalizedKey as SubjectKey];
  if (exactMatch) {
    return exactMatch;
  }

  // 2️⃣ LOGIQUE INTELLIGENTE - Matching par préfixe/racine

  // Langues vivantes - Compétences (listening, reading, speaking, writing)
  // anglais-lv1-listening-comprehension-orale → anglais-lv1
  if (normalizedKey.match(/^(anglais|espagnol|allemand|italien)-lv[12]-/)) {
    const baseLanguage = normalizedKey.match(/^(anglais|espagnol|allemand|italien)-lv[12]/)?.[0];
    const baseMatch = SUBJECT_ICONS[baseLanguage as SubjectKey];
    if (baseMatch) return baseMatch;
  }

  // Langues vivantes - Compétences génériques
  // langues-vivantes-anglais → langues-vivantes ou anglais
  if (normalizedKey.startsWith('langues-vivantes-')) {
    const specificLang = normalizedKey.replace('langues-vivantes-', '');
    const specificMatch = SUBJECT_ICONS[specificLang as SubjectKey];
    if (specificMatch) return specificMatch;
    return SUBJECT_ICONS['langues-vivantes'] ?? SUBJECT_ICONS.autre;
  }

  // EMC/Enseignement Moral et Civique - Toutes variantes
  // enseignement-moral-et-civique-la-sensibilite → emc
  if (
    normalizedKey.startsWith('enseignement-moral-et-civique') ||
    normalizedKey.startsWith('enseignement-moral-civique') ||
    normalizedKey.startsWith('emc-')
  ) {
    return SUBJECT_ICONS.emc;
  }

  // EPS - Toutes variantes d'activités
  // education-physique-et-sportive-activites-athletiques → eps
  if (
    normalizedKey.startsWith('education-physique-et-sportive') ||
    normalizedKey.startsWith('education-physique-sportive') ||
    normalizedKey.startsWith('eps-')
  ) {
    return SUBJECT_ICONS.eps;
  }

  // Questionner le monde - Variantes primaire
  // questionner-le-monde-questionner-l-espace-et-le-temps → questionner-le-monde
  if (normalizedKey.startsWith('questionner-le-monde-')) {
    return SUBJECT_ICONS['questionner-le-monde'];
  }

  // Matières complètes ou sous-thèmes - Extraction racine
  // francais-grammaire → francais
  // mathematiques-geometrie → mathematiques
  // svt-circulation-sanguine → svt
  const rootSubjects = [
    'francais',
    'mathematiques',
    'svt',
    'physique-chimie',
    'histoire',
    'geographie',
    'histoire-geographie',
    'technologie',
    'arts-plastiques',
    'education-musicale',
    'sciences-et-technologie',
    'sciences-technologie'
  ];

  for (const root of rootSubjects) {
    if (normalizedKey.startsWith(`${root}-`) || normalizedKey === `${root}-complet`) {
      const rootMatch = SUBJECT_ICONS[root as SubjectKey];
      if (rootMatch) return rootMatch;
    }
  }

  // Spécialités lycée - Extraction de la matière de base
  // specialite-mathematiques → Target icon avec couleur matière
  if (normalizedKey.startsWith('specialite-')) {
    const exactSpec = SUBJECT_ICONS[normalizedKey as SubjectKey];
    if (exactSpec) return exactSpec;
    // Fallback: utiliser icône Target générique
    return {
      icon: Target,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-100 dark:bg-purple-950/30',
      label: 'Spécialité'
    };
  }

  // 3️⃣ FALLBACK FINAL
  return SUBJECT_ICONS.autre;
}

/**
 * Obtenir l'icône React Component pour une matière
 * @param subjectKey - Clé de la matière
 * @returns Composant icône lucide-react
 */
export function getSubjectIconComponent(subjectKey: string): LucideIcon {
  return getSubjectIcon(subjectKey).icon;
}
