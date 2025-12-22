/**
 * Index des modules de prompts pour la génération de cartes
 *
 * Architecture Single-Phase 2025:
 * - base.ts: Instructions KaTeX et contenu enrichi
 * - by-subject.ts: Configuration par matière et cycle
 */

// Shared constants
export { KATEX_INSTRUCTIONS, RICH_CONTENT_INSTRUCTIONS } from './base.js';
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
