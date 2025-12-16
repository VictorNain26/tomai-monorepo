/**
 * Configuration par matière pour la génération de cartes
 *
 * Architecture simplifiée:
 * - Instructions courtes et directes par catégorie
 * - Adaptation cycle scolaire intégrée
 * - RAG fournit le contenu, ici on guide le format
 */

import type { SubjectCategory, SubjectConfig, CardType, EducationCycle } from '../types.js';
import { CARD_TYPES_BY_CATEGORY } from '../types.js';
import type { EducationLevelType } from '../../../types/index.js';

// ============================================================================
// CONFIGURATION PAR MATIÈRE (instructions courtes)
// ============================================================================

const SUBJECT_CONFIGS: Record<SubjectCategory, SubjectConfig> = {
  mathematiques: {
    category: 'mathematiques',
    requiresKaTeX: true,
    recommendedCardTypes: CARD_TYPES_BY_CATEGORY.mathematiques,
    instructions: `**MATHÉMATIQUES**
- Toutes formules en KaTeX
- Calculs avec étapes intermédiaires
- Exemples numériques concrets
- Varier : calcul mental, algèbre, géométrie`
  },

  sciences: {
    category: 'sciences',
    requiresKaTeX: true,
    recommendedCardTypes: CARD_TYPES_BY_CATEGORY.sciences,
    instructions: `**SCIENCES (SVT, Physique-Chimie)**
- Vocabulaire scientifique précis
- Unités obligatoires (m, kg, s, J, mol)
- Processus en étapes ordonnées
- Classifications avec critères clairs`
  },

  francais: {
    category: 'francais',
    requiresKaTeX: false,
    recommendedCardTypes: CARD_TYPES_BY_CATEGORY.francais,
    instructions: `**FRANÇAIS**
- Règles grammaticales avec exemples
- Transformations (temps, voix, nombre)
- Textes à trous pour conjugaison/accord
- Astuce mnémotechnique si pertinent`
  },

  langues: {
    category: 'langues',
    requiresKaTeX: false,
    recommendedCardTypes: CARD_TYPES_BY_CATEGORY.langues,
    instructions: `**LANGUES VIVANTES**
- Vocabulaire : mot → traduction + contexte
- Grammaire : règle + phrase exemple
- Matching : 4-6 paires mot/traduction
- Word order : phrase mélangée à reconstruire`
  },

  'histoire-geo': {
    category: 'histoire-geo',
    requiresKaTeX: false,
    recommendedCardTypes: CARD_TYPES_BY_CATEGORY['histoire-geo'],
    instructions: `**HISTOIRE-GÉOGRAPHIE**
- Dates avec contexte (pas isolées)
- Timeline : 4-6 événements à ordonner
- Cause → effet avec explication
- Personnages associés à leur époque`
  },

  autre: {
    category: 'autre',
    requiresKaTeX: false,
    recommendedCardTypes: CARD_TYPES_BY_CATEGORY.autre,
    instructions: `**MATIÈRE GÉNÉRALE**
- Questions directes et claires
- Réponses concises
- Varier flashcard, QCM, vrai/faux`
  }
};

// ============================================================================
// MAPPING MATIÈRE → CATÉGORIE
// ============================================================================

const SUBJECT_MAPPING: Record<string, SubjectCategory> = {
  // Maths
  math: 'mathematiques', maths: 'mathematiques', mathematiques: 'mathematiques', mathématiques: 'mathematiques',
  // Sciences
  svt: 'sciences', sciences: 'sciences', biologie: 'sciences', physique: 'sciences', chimie: 'sciences',
  'physique-chimie': 'sciences', physique_chimie: 'sciences',
  // Français
  français: 'francais', francais: 'francais', lettres: 'francais', french: 'francais',
  // Langues
  anglais: 'langues', espagnol: 'langues', allemand: 'langues', italien: 'langues',
  english: 'langues', spanish: 'langues', german: 'langues', italian: 'langues',
  lv1: 'langues', lv2: 'langues',
  // Histoire-Géo
  histoire: 'histoire-geo', géographie: 'histoire-geo', geographie: 'histoire-geo',
  'histoire-géographie': 'histoire-geo', 'histoire-geo': 'histoire-geo', histoire_geo: 'histoire-geo',
  emc: 'histoire-geo', hggsp: 'histoire-geo', geo: 'histoire-geo', history: 'histoire-geo', geography: 'histoire-geo'
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

const CYCLE_INSTRUCTIONS: Record<EducationCycle, string> = {
  cycle2: `## CYCLE 2 (CP-CE2, 6-8 ans)
- Phrases courtes (max 8 mots)
- Vocabulaire simple du quotidien
- Éviter le jargon technique`,

  cycle3: `## CYCLE 3 (CM1-6ème, 9-11 ans)
- Phrases 15-20 mots max
- Vocabulaire technique introduit progressivement
- Début d'abstraction possible`,

  cycle4: `## CYCLE 4 (5ème-3ème, 12-14 ans)
- Vocabulaire scolaire standard
- Termes techniques du programme
- Raisonnement et argumentation`,

  lycee: `## LYCÉE (2nde-Terminale, 15-18 ans)
- Vocabulaire académique complet
- Précision scientifique
- Niveau baccalauréat`
};

// ============================================================================
// FONCTIONS EXPORTÉES
// ============================================================================

export function getSubjectCategory(subject: string): SubjectCategory {
  const normalized = subject.toLowerCase().trim();
  return SUBJECT_MAPPING[normalized] ?? 'autre';
}

export function getSubjectConfig(subject: string): SubjectConfig {
  return SUBJECT_CONFIGS[getSubjectCategory(subject)];
}

export function subjectRequiresKaTeX(subject: string): boolean {
  return getSubjectConfig(subject).requiresKaTeX;
}

export function getSubjectInstructions(subject: string): string {
  return getSubjectConfig(subject).instructions;
}

export function getRecommendedCardTypes(subject: string): CardType[] {
  return getSubjectConfig(subject).recommendedCardTypes;
}

export function getEducationCycle(level: EducationLevelType): EducationCycle {
  return LEVEL_TO_CYCLE[level] ?? 'cycle4';
}

export function getCycleAdaptationInstructions(cycle: EducationCycle): string {
  return CYCLE_INSTRUCTIONS[cycle];
}
