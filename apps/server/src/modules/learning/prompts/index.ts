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
export { KATEX_INSTRUCTIONS,  } from './base.js';

// Matières et cycles
export {
  
  subjectRequiresKaTeX,
  getSubjectInstructions,
  getRecommendedCardTypes,
  getEducationCycle,
  getCycleAdaptationInstructions,
  
  
  
} from './by-subject.js';

// Pédagogie - Principes CSEN et extensions
export {
  
  
  
  
  
  getPedagogyPromptBlock
} from './pedagogy.js';

// Templates de cartes
export {
  
  getTemplatesForTypes,
  
} from './templates.js';

// Types réexportés
;

;
