/**
 * Index des modules de prompts pour la génération de cartes
 *
 * Architecture Single-Phase 2025:
 * - base.ts: Instructions KaTeX et contenu enrichi
 * - by-subject.ts: Configuration par matière et cycle
 * - pedagogy.ts: Principes CSEN + extensions scientifiques documentées
 * - templates.ts: Templates de cartes par type
 */

// Base - KaTeX et contenu enrichi
export { KATEX_INSTRUCTIONS, RICH_CONTENT_INSTRUCTIONS } from './base.js';

// Matières et cycles
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

// Pédagogie - Principes CSEN et extensions
export {
  CSEN_FOUR_PILLARS,
  CSEN_PRINCIPLES_PROMPT,
  SCIENTIFIC_EXTENSIONS,
  OPTIONAL_FIELDS_PROMPT,
  STRUCTURE_RECOMMENDATIONS,
  getPedagogyPromptBlock
} from './pedagogy.js';

// Templates de cartes
export {
  CARD_TEMPLATES,
  getTemplatesForTypes,
  isValidCardType
} from './templates.js';

// Types réexportés
export type {
  CardType,
  SubjectCategory,
  EducationCycle
} from '../types.js';

export type { SubjectConfig } from './by-subject.js';
