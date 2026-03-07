import type { z } from 'zod';
import { ClassificationSchema } from './document-types.js';
import { logger } from '../../lib/observability.js';
import type { DocumentAnalysisResult } from './document-types.js';

export function parseAnalysisResponse(response: string): {
  classification: z.infer<typeof ClassificationSchema>;
  analysis: string;
} {
  try {
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1]?.trim() : response.trim();

    const parsed = JSON.parse(jsonStr ?? '{}');

    const classification = ClassificationSchema.parse(parsed.classification ?? {
      documentType: 'document',
      subject: 'inconnu',
      confidence: 'low'
    });

    return {
      classification,
      analysis: parsed.analysis ?? 'Analyse non disponible.'
    };

  } catch (error) {
    logger.warn('Failed to parse analysis response', {
      error: error instanceof Error ? error.message : String(error),
      responsePreview: response.substring(0, 200)
    });

    return {
      classification: {
        documentType: 'document',
        subject: 'inconnu',
        confidence: 'low'
      },
      analysis: response
    };
  }
}

export function parseImageAnalysisResponse(response: string): {
  classification: z.infer<typeof ClassificationSchema>;
  analysis: string;
  extractedText: string;
} {
  try {
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1]?.trim() : response.trim();

    const parsed = JSON.parse(jsonStr ?? '{}');

    const classification = ClassificationSchema.parse(parsed.classification ?? {
      documentType: 'document',
      subject: 'inconnu',
      confidence: 'low'
    });

    return {
      classification,
      analysis: parsed.analysis ?? 'Analyse non disponible.',
      extractedText: parsed.extractedText ?? ''
    };

  } catch (error) {
    logger.warn('Failed to parse image analysis response', {
      error: error instanceof Error ? error.message : String(error),
      responsePreview: response.substring(0, 200)
    });

    return {
      classification: {
        documentType: 'document',
        subject: 'inconnu',
        confidence: 'low'
      },
      analysis: response,
      extractedText: ''
    };
  }
}

export function createErrorResult(
  startTime: number,
  extractionTimeMs: number,
  errorMessage: string
): DocumentAnalysisResult {
  return {
    success: false,
    extraction: {
      text: '',
      method: 'none',
      wordCount: 0
    },
    classification: {
      documentType: 'non-educatif',
      subject: 'inconnu',
      confidence: 'low',
      needsRAG: false,
      description: 'Erreur'
    },
    analysis: '',
    metrics: {
      totalTimeMs: Date.now() - startTime,
      extractionTimeMs,
      analysisTimeMs: 0
    },
    error: errorMessage
  };
}
