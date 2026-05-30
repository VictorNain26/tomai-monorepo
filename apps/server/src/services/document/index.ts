/**
 * Document Services - Point d'entrée unifié
 *
 * - DocumentExtractionService: extraction texte locale (PDF, DOCX, TXT)
 * - DocumentAnalysisService: classification + analyse unifiée via Mistral
 */

export { documentExtractionService } from './document-extraction.service.js';
export type { ExtractionResult } from './document-extraction.service.js';

export { documentAnalysisService } from './document-analysis.service.js';
export type {
  DocumentType,
  SubjectType,
  DocumentAnalysisResult,
  DocumentAnalysisOptions
} from './document-analysis.service.js';
