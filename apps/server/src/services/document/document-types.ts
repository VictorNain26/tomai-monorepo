import { z } from 'zod';

/** @public — reachable only via Eden Treaty's inferred route return types (apps/server build:types), not a direct import; knip false positive. */
export type DocumentType = 'exercice' | 'cours' | 'devoir' | 'correction' | 'document' | 'non-educatif';

/** @public — reachable only via Eden Treaty's inferred route return types (apps/server build:types), not a direct import; knip false positive. */
export type SubjectType =
  | 'mathematiques' | 'francais' | 'anglais' | 'espagnol' | 'allemand'
  | 'histoire' | 'geographie' | 'emc' | 'svt' | 'physique-chimie'
  | 'technologie' | 'inconnu';

export const ClassificationSchema = z.object({
  documentType: z.enum(['exercice', 'cours', 'devoir', 'correction', 'document', 'non-educatif']),
  subject: z.enum([
    'mathematiques', 'francais', 'anglais', 'espagnol', 'allemand',
    'histoire', 'geographie', 'emc', 'svt', 'physique-chimie',
    'technologie', 'inconnu'
  ]),
  confidence: z.enum(['high', 'medium', 'low']),
  detectedLevel: z.string().optional()
});

export interface DocumentAnalysisResult {
  success: boolean;

  extraction: {
    text: string;
    method: string;
    wordCount: number;
  };

  classification: {
    documentType: DocumentType;
    subject: SubjectType;
    confidence: 'high' | 'medium' | 'low';
    description: string;
  };

  analysis: string;

  metrics: {
    totalTimeMs: number;
    extractionTimeMs: number;
    analysisTimeMs: number;
    tokensUsed?: number;
  };

  error?: string;
}

export interface DocumentAnalysisOptions {
  schoolLevel: import('../../types/education.types.js').EducationLevelType;
  userId: string;
  userQuestion?: string;
}
