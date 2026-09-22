/**
 * Document Analysis Service — Mistral stack (Phase 2B).
 *
 * Text path  : extraction (PDF/docx via document-extraction.service) +
 *              single completion (prompt-cached system instruction).
 * Image path : multimodal chat model, photo encodée base64 → `image_url` part inline.
 *
 * Pas de prompt cache sur le user message (contenu variable par fichier).
 * Cache key = système + version pour amortir le préfixe pédagogique stable.
 */

import { generateText, type MistralMessage } from '../../lib/ai/mistral-client.js';
import { logger } from '../../lib/observability.js';
import { env } from '../../config/env.js';
import { documentExtractionService } from './document-extraction.service.js';
import type { EducationLevelType } from '../../types/education.types.js';
import {
  buildSystemPrompt as buildDocSystemPrompt,
  buildUserPrompt as buildDocUserPrompt,
  buildImagePrompt as buildDocImagePrompt,
  DOCUMENT_PROMPT_VERSION,
} from './document-prompts.js';
import type {
  DocumentAnalysisResult,
  DocumentAnalysisOptions,
} from './document-types.js';
import {
  parseAnalysisResponse,
  parseImageAnalysisResponse,
  createErrorResult,
} from './document-parsers.js';

// Re-export types for backward compatibility
export type {
  
  
  DocumentAnalysisResult,
  
} from './document-types.js';

const ANALYSIS_MODEL = env.MISTRAL_MODEL;
const ANALYSIS_TEMPERATURE = 0.2;
const ANALYSIS_MAX_TOKENS = 2048;
const ANALYSIS_TIMEOUT_MS = 45_000;

class DocumentAnalysisService {
  async analyzeDocument(
    buffer: ArrayBuffer,
    fileName: string,
    mimeType: string,
    options: DocumentAnalysisOptions,
  ): Promise<DocumentAnalysisResult> {
    const startTime = Date.now();
    const { schoolLevel, userId, userQuestion } = options;
    const cleanMimeType = mimeType.split(';')[0]?.trim() ?? '';

    logger.info('Starting document analysis (mistral)', {
      fileName,
      mimeType: cleanMimeType,
      schoolLevel,
      userId,
      hasQuestion: !!userQuestion,
      operation: 'document-analysis-start',
    });

    try {
      const extractionStart = Date.now();
      const extraction = await documentExtractionService.extractText(
        buffer,
        cleanMimeType,
        fileName,
      );
      const extractionTimeMs = Date.now() - extractionStart;

      if (!extraction.success || !extraction.text) {
        return createErrorResult(
          startTime,
          extractionTimeMs,
          extraction.error ?? 'Extraction failed',
        );
      }

      logger.info('Document text extracted', {
        fileName,
        wordCount: extraction.metadata.wordCount,
        method: extraction.metadata.extractionMethod,
        extractionTimeMs,
        operation: 'document-extraction-complete',
      });

      const analysisStart = Date.now();
      const { classification, analysis } = await this.analyzeText(
        extraction.text,
        schoolLevel,
        userQuestion,
      );
      const analysisTimeMs = Date.now() - analysisStart;
      const totalTimeMs = Date.now() - startTime;

      logger.info('Document analysis completed (mistral)', {
        fileName,
        documentType: classification.documentType,
        subject: classification.subject,
        totalTimeMs,
        operation: 'document-analysis-complete',
      });

      return {
        success: true,
        extraction: {
          text: extraction.text,
          method: extraction.metadata.extractionMethod,
          wordCount: extraction.metadata.wordCount,
        },
        classification: {
          ...classification,
          description: `Document ${classification.documentType} en ${classification.subject}`,
        },
        analysis,
        metrics: { totalTimeMs, extractionTimeMs, analysisTimeMs, tokensUsed: 0 },
      };
    } catch (error) {
      logger.error('Document analysis failed', {
        _error: error instanceof Error ? error.message : String(error),
        fileName,
        userId,
        operation: 'document-analysis-error',
        severity: 'high' as const,
      });
      return createErrorResult(
        startTime,
        0,
        error instanceof Error ? error.message : 'Analysis failed',
      );
    }
  }

  async analyzeImage(
    base64Data: string,
    mimeType: string,
    fileName: string,
    options: DocumentAnalysisOptions,
  ): Promise<DocumentAnalysisResult> {
    const startTime = Date.now();
    const { schoolLevel, userId, userQuestion } = options;

    logger.info('Starting image analysis (mistral multimodal)', {
      fileName,
      mimeType,
      schoolLevel,
      userId,
      operation: 'image-analysis-start',
    });

    try {
      const analysisStart = Date.now();
      const { classification, analysis, extractedText } = await this.analyzeImageWithVision(
        base64Data,
        mimeType,
        schoolLevel,
        userQuestion,
      );

      const analysisTimeMs = Date.now() - analysisStart;
      const totalTimeMs = Date.now() - startTime;

      logger.info('Image analysis completed (mistral)', {
        fileName,
        documentType: classification.documentType,
        subject: classification.subject,
        totalTimeMs,
        operation: 'image-analysis-complete',
      });

      return {
        success: true,
        extraction: {
          text: extractedText,
          method: 'mistral-vision',
          wordCount: extractedText.split(/\s+/).filter((w) => w.length > 0).length,
        },
        classification: {
          ...classification,
          description: `Image ${classification.documentType} en ${classification.subject}`,
        },
        analysis,
        metrics: { totalTimeMs, extractionTimeMs: 0, analysisTimeMs, tokensUsed: 0 },
      };
    } catch (error) {
      logger.error('Image analysis failed', {
        _error: error instanceof Error ? error.message : String(error),
        fileName,
        userId,
        operation: 'image-analysis-error',
        severity: 'high' as const,
      });
      return createErrorResult(
        startTime,
        0,
        error instanceof Error ? error.message : 'Image analysis failed',
      );
    }
  }

  private async analyzeText(
    documentText: string,
    schoolLevel: EducationLevelType,
    userQuestion?: string,
  ) {
    const truncatedText =
      documentText.length > 4000
        ? documentText.substring(0, 4000) + '\n...[texte tronqué]'
        : documentText;

    const systemPrompt = buildDocSystemPrompt(schoolLevel, userQuestion);
    const userPrompt = buildDocUserPrompt(truncatedText, schoolLevel, userQuestion);

    const messages: MistralMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const responseText = await generateText({
      model: ANALYSIS_MODEL,
      messages,
      temperature: ANALYSIS_TEMPERATURE,
      maxTokens: ANALYSIS_MAX_TOKENS,
      promptCacheKey: `document-analysis-text-${DOCUMENT_PROMPT_VERSION}-${schoolLevel}`,
      timeoutMs: ANALYSIS_TIMEOUT_MS,
    });

    return parseAnalysisResponse(responseText);
  }

  private async analyzeImageWithVision(
    base64Data: string,
    mimeType: string,
    schoolLevel: EducationLevelType,
    userQuestion?: string,
  ) {
    const systemPrompt = buildDocSystemPrompt(schoolLevel, userQuestion);
    const userTextPrompt = buildDocImagePrompt(schoolLevel, userQuestion);
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    const messages: MistralMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: userTextPrompt },
          { type: 'image_url', imageUrl: { url: dataUrl } },
        ],
      },
    ];

    const responseText = await generateText({
      model: ANALYSIS_MODEL,
      messages,
      temperature: ANALYSIS_TEMPERATURE,
      maxTokens: ANALYSIS_MAX_TOKENS,
      promptCacheKey: `document-analysis-image-${DOCUMENT_PROMPT_VERSION}-${schoolLevel}`,
      timeoutMs: ANALYSIS_TIMEOUT_MS,
    });

    return parseImageAnalysisResponse(responseText);
  }
}

export const documentAnalysisService = new DocumentAnalysisService();
