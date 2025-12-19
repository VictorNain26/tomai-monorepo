/**
 * Index des modules de prompts pour la génération de cartes
 *
 * Architecture libre 2025:
 * - base.ts: Instructions pédagogiques et format JSON
 * - by-subject.ts: Configuration par matière et cycle
 */

// Re-export depuis les modules
export { getBasePrompt, KATEX_INSTRUCTIONS } from './base.js';
export {
  getSubjectCategory,
  subjectRequiresKaTeX,
  getSubjectInstructions,
  getRecommendedCardTypes,
  getEducationCycle,
  getCycleAdaptationInstructions,
  getSubjectConfig,
  ALL_CARD_TYPES,
  SUGGESTED_CARD_TYPES
} from './by-subject.js';

// Types réexportés
export type {
  CardType,
  SubjectCategory,
  EducationCycle
} from '../types.js';

export type { SubjectConfig } from './by-subject.js';
