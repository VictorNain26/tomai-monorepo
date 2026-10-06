/**
 * Configuration par matière pour la génération de cartes
 *
 * Architecture libre 2025:
 * - Types de cartes suggérés, pas imposés
 * - Instructions courtes donnant le contexte disciplinaire
 * - L'IA choisit les types les plus adaptés au contenu
 */

import type { EducationCycle } from '../card-generation.types.js';
import { CARD_TYPES, type CardType } from '../card-content.schema.js';
import { SUBJECTS, type SubjectFamily, type SubjectSlug } from '../../../lib/subjects.js';
import type { EducationLevelType } from '../../../types/index.js';

type CardFamily = Exclude<SubjectFamily, 'general'>;

// ============================================================================
// TOUS LES TYPES DE CARTES DISPONIBLES
// ============================================================================

// ============================================================================
// TYPES SUGGÉRÉS PAR CATÉGORIE (guidance, pas restriction)
// ============================================================================

/**
 * Types particulièrement adaptés à chaque matière
 * L'IA peut toujours utiliser d'autres types si pertinent
 * 'concept' en premier pour les matières nécessitant théorie avant pratique
 * 'reformulation' ajouté partout pour favoriser l'élaboration (Sciences Cognitives 2025)
 */
const SUGGESTED_CARD_TYPES: Record<CardFamily, CardType[]> = {
  mathematiques: ['concept', 'flashcard', 'qcm', 'vrai_faux', 'calculation', 'fill_blank', 'reformulation'],
  sciences: ['concept', 'flashcard', 'qcm', 'vrai_faux', 'calculation', 'classification', 'process_order', 'cause_effect', 'reformulation'],
  francais: ['concept', 'flashcard', 'qcm', 'vrai_faux', 'fill_blank', 'grammar_transform', 'matching', 'reformulation'],
  langues: ['concept', 'flashcard', 'qcm', 'matching', 'fill_blank', 'word_order', 'vrai_faux', 'reformulation'],
  'histoire-geo': ['concept', 'flashcard', 'qcm', 'vrai_faux', 'timeline', 'matching_era', 'cause_effect', 'matching', 'reformulation'],
};

// ============================================================================
// INSTRUCTIONS PAR MATIÈRE (contexte disciplinaire)
// ============================================================================

const SUBJECT_INSTRUCTIONS: Record<CardFamily, string> = {
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
};

// ============================================================================
// ADAPTATION PAR CYCLE SCOLAIRE
// ============================================================================

const LEVEL_TO_CYCLE: Record<EducationLevelType, EducationCycle> = {
  sixieme: 'cycle3',
  cinquieme: 'cycle4',
  quatrieme: 'cycle4',
  troisieme: 'cycle4',
};

const CYCLE_GUIDANCE: Record<EducationCycle, string> = {
  cycle3: `**Cycle 3 (6ème, 11 ans)**
- Introduction progressive du vocabulaire technique
- Début d'abstraction
- Exemples variés`,

  cycle4: `**Cycle 4 (5ème-3ème, 12-14 ans)**
- Vocabulaire scolaire standard
- Termes techniques du programme
- Raisonnement et argumentation`,
};

// ============================================================================
// FONCTIONS EXPORTÉES
// ============================================================================

export function subjectRequiresKaTeX(subject: SubjectSlug): boolean {
  const { family } = SUBJECTS[subject];
  return family === 'mathematiques' || family === 'sciences';
}

export function getSubjectInstructions(subject: SubjectSlug): string {
  return SUBJECT_INSTRUCTIONS[SUBJECTS[subject].family];
}

export function getRecommendedCardTypes(subject: SubjectSlug): CardType[] {
  // Retourne tous les types avec les suggérés en premier
  const suggested = SUGGESTED_CARD_TYPES[SUBJECTS[subject].family];
  const others = CARD_TYPES.filter((t) => !suggested.includes(t));
  return [...suggested, ...others];
}

export function getEducationCycle(level: EducationLevelType): EducationCycle {
  return LEVEL_TO_CYCLE[level];
}

export function getCycleAdaptationInstructions(cycle: EducationCycle): string {
  return CYCLE_GUIDANCE[cycle];
}
