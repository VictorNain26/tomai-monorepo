/**
 * Index des modules de prompts pour la génération de cartes
 *
 * Architecture Meta-Planning 2025:
 * - deck-planner.prompt.ts: Phase 1 - Planification de la structure
 * - base.ts: Phase 2 - Génération des cartes selon le plan
 * - by-subject.ts: Configuration par matière et cycle
 */

// Meta-planning prompts (Phase 1)
export { buildDeckPlannerPrompt } from './deck-planner.prompt.js';

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
export type { DeckPlannerPromptOptions } from './deck-planner.prompt.js';
