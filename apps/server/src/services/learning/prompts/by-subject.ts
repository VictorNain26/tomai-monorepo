/**
 * Configuration par matière pour la génération de cartes
 *
 * Architecture libre 2025:
 * - Types de cartes suggérés, pas imposés
 * - Instructions courtes donnant le contexte disciplinaire
 * - L'IA choisit les types les plus adaptés au contenu
 */

import type { SubjectCategory, CardType, EducationCycle } from '../types.js';
import type { EducationLevelType } from '../../../types/index.js';

// ============================================================================
// TOUS LES TYPES DE CARTES DISPONIBLES
// ============================================================================

/**
 * Liste complète des types (15) - l'IA peut utiliser n'importe lequel
 */
export const ALL_CARD_TYPES: CardType[] = [
  'concept', // Pédagogique - théorie avant pratique
  'flashcard', 'qcm', 'vrai_faux',
  'matching', 'fill_blank', 'word_order',
  'calculation',
  'timeline', 'matching_era', 'cause_effect',
  'classification', 'process_order',
  'grammar_transform',
  'reformulation' // Sciences Cognitives 2025 - Élaboration active
];

// ============================================================================
// TYPES SUGGÉRÉS PAR CATÉGORIE (guidance, pas restriction)
// ============================================================================

/**
 * Types particulièrement adaptés à chaque matière
 * L'IA peut toujours utiliser d'autres types si pertinent
 * 'concept' en premier pour les matières nécessitant théorie avant pratique
 * 'reformulation' ajouté partout pour favoriser l'élaboration (Sciences Cognitives 2025)
 */
export const SUGGESTED_CARD_TYPES: Record<SubjectCategory, CardType[]> = {
  mathematiques: ['concept', 'flashcard', 'qcm', 'vrai_faux', 'calculation', 'fill_blank', 'reformulation'],
  sciences: ['concept', 'flashcard', 'qcm', 'vrai_faux', 'calculation', 'classification', 'process_order', 'cause_effect', 'reformulation'],
  francais: ['concept', 'flashcard', 'qcm', 'vrai_faux', 'fill_blank', 'grammar_transform', 'matching', 'reformulation'],
  langues: ['concept', 'flashcard', 'qcm', 'matching', 'fill_blank', 'word_order', 'vrai_faux', 'reformulation'],
  'histoire-geo': ['concept', 'flashcard', 'qcm', 'vrai_faux', 'timeline', 'matching_era', 'cause_effect', 'matching', 'reformulation'],
  autre: ALL_CARD_TYPES
};

// ============================================================================
// INSTRUCTIONS PAR MATIÈRE (contexte disciplinaire)
// ============================================================================

const SUBJECT_INSTRUCTIONS: Record<SubjectCategory, string> = {
  mathematiques: `**Mathématiques**
- Formules en KaTeX obligatoire
- Privilégie les calculs avec étapes
- Varie : calcul mental, algèbre, géométrie, problèmes`,

  sciences: `**Sciences (SVT, Physique-Chimie)**
- Formules en KaTeX si nécessaire
- Unités obligatoires (m, kg, s, J, mol)
- Processus biologiques en étapes
- Classifications avec critères scientifiques`,

  francais: `**Français**
- Règles de grammaire avec exemples
- Transformations (temps, voix, accords)
- Vocabulaire en contexte
- Figures de style avec exemples littéraires`,

  langues: `**Langues vivantes**
- Vocabulaire avec contexte d'usage
- Grammaire par l'exemple (induction)
- Expressions idiomatiques
- Constructions de phrases`,

  'histoire-geo': `**Histoire-Géographie-EMC**
- Dates avec contexte historique
- Événements avec causes et conséquences
- Personnages associés à leur époque
- Notions de géographie avec exemples`,

  autre: `**Matière générale**
- Adapte les types de cartes au contenu
- Privilégie la clarté et la concision`
};

// ============================================================================
// ADAPTATION PAR CYCLE SCOLAIRE
// ============================================================================

const LEVEL_TO_CYCLE: Record<EducationLevelType, EducationCycle> = {
  cp: 'cycle2', ce1: 'cycle2', ce2: 'cycle2',
  cm1: 'cycle3', cm2: 'cycle3', sixieme: 'cycle3',
  cinquieme: 'cycle4', quatrieme: 'cycle4', troisieme: 'cycle4',
  seconde: 'lycee', premiere: 'lycee', terminale: 'lycee'
};

const CYCLE_GUIDANCE: Record<EducationCycle, string> = {
  cycle2: `**Cycle 2 (CP-CE2, 6-8 ans)**
- Langage simple et concret
- Exemples du quotidien
- Phrases courtes`,

  cycle3: `**Cycle 3 (CM1-6ème, 9-11 ans)**
- Introduction progressive du vocabulaire technique
- Début d'abstraction
- Exemples variés`,

  cycle4: `**Cycle 4 (5ème-3ème, 12-14 ans)**
- Vocabulaire scolaire standard
- Termes techniques du programme
- Raisonnement et argumentation`,

  lycee: `**Lycée (2nde-Terminale, 15-18 ans)**
- Vocabulaire académique complet
- Précision scientifique
- Niveau baccalauréat`
};

// ============================================================================
// MAPPING MATIÈRE → CATÉGORIE
// ============================================================================

const SUBJECT_MAPPING: Record<string, SubjectCategory> = {
  // Maths
  math: 'mathematiques', maths: 'mathematiques', mathematiques: 'mathematiques', mathématiques: 'mathematiques',
  // Sciences
  svt: 'sciences', sciences: 'sciences', biologie: 'sciences', physique: 'sciences', chimie: 'sciences',
  'physique-chimie': 'sciences', physique_chimie: 'sciences', technologie: 'sciences',
  // Français
  français: 'francais', francais: 'francais', lettres: 'francais', french: 'francais', litterature: 'francais',
  // Langues
  anglais: 'langues', espagnol: 'langues', allemand: 'langues', italien: 'langues',
  english: 'langues', spanish: 'langues', german: 'langues', italian: 'langues',
  lv1: 'langues', lv2: 'langues', langues: 'langues',
  // Histoire-Géo
  histoire: 'histoire-geo', géographie: 'histoire-geo', geographie: 'histoire-geo',
  'histoire-géographie': 'histoire-geo', 'histoire-geo': 'histoire-geo', histoire_geo: 'histoire-geo',
  emc: 'histoire-geo', hggsp: 'histoire-geo', geo: 'histoire-geo', history: 'histoire-geo', geography: 'histoire-geo'
};

// ============================================================================
// FONCTIONS EXPORTÉES
// ============================================================================

export function getSubjectCategory(subject: string): SubjectCategory {
  const normalized = subject.toLowerCase().trim();
  return SUBJECT_MAPPING[normalized] ?? 'autre';
}

export function subjectRequiresKaTeX(subject: string): boolean {
  const category = getSubjectCategory(subject);
  return category === 'mathematiques' || category === 'sciences';
}

export function getSubjectInstructions(subject: string): string {
  return SUBJECT_INSTRUCTIONS[getSubjectCategory(subject)];
}

export function getRecommendedCardTypes(subject: string): CardType[] {
  const category = getSubjectCategory(subject);
  // Retourne tous les types avec les suggérés en premier
  const suggested = SUGGESTED_CARD_TYPES[category];
  const others = ALL_CARD_TYPES.filter(t => !suggested.includes(t));
  return [...suggested, ...others];
}

export function getEducationCycle(level: EducationLevelType): EducationCycle {
  return LEVEL_TO_CYCLE[level] ?? 'cycle4';
}

export function getCycleAdaptationInstructions(cycle: EducationCycle): string {
  return CYCLE_GUIDANCE[cycle];
}

// Compat export
export type { SubjectCategory };
export interface SubjectConfig {
  category: SubjectCategory;
  requiresKaTeX: boolean;
  instructions: string;
  recommendedCardTypes: CardType[];
}

export function getSubjectConfig(subject: string): SubjectConfig {
  const category = getSubjectCategory(subject);
  return {
    category,
    requiresKaTeX: subjectRequiresKaTeX(subject),
    instructions: SUBJECT_INSTRUCTIONS[category],
    recommendedCardTypes: getRecommendedCardTypes(subject)
  };
}
