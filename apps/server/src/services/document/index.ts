/**
 * Document Services — point d'entrée unifié.
 *
 * Architecture Mistral :
 * - DocumentExtractionService : extraction texte locale (PDF, DOCX, TXT)
 * - DocumentAnalysisService : classification + analyse via Mistral Small 4 (vision incluse)
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
