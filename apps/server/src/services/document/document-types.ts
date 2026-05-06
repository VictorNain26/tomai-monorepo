import { z } from 'zod';

export type DocumentType = 'exercice' | 'cours' | 'devoir' | 'correction' | 'document' | 'non-educatif';

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

export interface RAGQueryResult {
  found: boolean;
  chunksCount: number;
  context: string;
}

export interface ExtractionResult {
  success: boolean;
  text: string;
  metadata: {
    pageCount?: number;
    wordCount: number;
    extractionMethod: 'unpdf' | 'mammoth' | 'text' | 'mistral-vision' | 'mistral-ocr';
    extractionTimeMs: number;
  };
  error?: string;
}

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
    needsRAG: boolean;
    description: string;
  };

  rag?: RAGQueryResult;

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
