/**
 * Document Services - Point d'entrée unifié
 *
 * - DocumentExtractionService: extraction texte locale (PDF, DOCX, TXT)
 * - DocumentAnalysisService: classification + analyse unifiée via Mistral
 */

;
;

export { documentAnalysisService } from './document-analysis.service.js';
export type {
  
  
  DocumentAnalysisResult,
  
} from './document-analysis.service.js';
