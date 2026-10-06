/**
 * Index des modules de prompts pour la génération de cartes
 *
 * - base.ts: Instructions KaTeX et contenu enrichi
 * - by-subject.ts: Configuration par matière et cycle
 * - pedagogy.ts: Principes CSEN + extensions scientifiques documentées
 */

export { KATEX_INSTRUCTIONS } from './base.js';

export {
  subjectRequiresKaTeX,
  getSubjectInstructions,
  getRecommendedCardTypes,
  getEducationCycle,
  getCycleAdaptationInstructions,
} from './by-subject.js';

export { getPedagogyPromptBlock } from './pedagogy.js';
