/**
 * Document Services - Point d'entrée unifié
 *
 * Architecture TanStack AI 2025:
 * - DocumentExtractionService: Extraction texte locale (PDF, DOCX, TXT)
 * - DocumentAnalysisService: Classification + Analyse unifiée avec TanStack AI
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
