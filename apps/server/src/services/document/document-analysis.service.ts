/**
 * Document Analysis Service — Mistral stack (Phase 2B).
 *
 * Text path  : extraction (PDF/docx via document-extraction.service) + RAG
 *              context + mistral-medium-latest analysis (single completion,
 *              prompt-cached system instruction).
 * Image path : multimodal Mistral medium (vision fusioné Pixtral, cf
 *              ADR-0001 §D7). Photo encodée base64 → `image_url` part inline.
 *
 * Pas de prompt cache sur le user message (contenu variable par fichier).
 * Cache key = système + version pour amortir le préfixe pédagogique stable.
 */

import { generateText, type MistralMessage } from '../../lib/ai/mistral-client.js';
import { logger } from '../../lib/observability.js';
import { documentExtractionService } from './document-extraction.service.js';
import { ragService } from '../rag.service.js';
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
  RAGQueryResult,
} from './document-types.js';
import {
  parseAnalysisResponse,
  parseImageAnalysisResponse,
  createErrorResult,
} from './document-parsers.js';

// Re-export types for backward compatibility
export type {
  DocumentType,
  SubjectType,
  DocumentAnalysisResult,
  DocumentAnalysisOptions,
} from './document-types.js';

const ANALYSIS_MODEL = 'mistral-medium-latest';
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

      const ragResult = await this.queryRAG(extraction.text, schoolLevel);

      const analysisStart = Date.now();
      const { classification, analysis } = await this.analyzeText(
        extraction.text,
        ragResult.context,
        schoolLevel,
        userQuestion,
      );
      const analysisTimeMs = Date.now() - analysisStart;
      const totalTimeMs = Date.now() - startTime;

      logger.info('Document analysis completed (mistral)', {
        fileName,
        documentType: classification.documentType,
        subject: classification.subject,
        hadRAG: ragResult.found,
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
          needsRAG:
            classification.documentType !== 'non-educatif' &&
            classification.subject !== 'inconnu',
          description: `Document ${classification.documentType} en ${classification.subject}`,
        },
        rag: ragResult.found ? ragResult : undefined,
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
      // No OCR text upfront — use the user question as RAG query if present,
      // otherwise skip RAG (the previous "document scolaire image" string
      // returned irrelevant top-k that biased the pedagogical framing).
      const ragResult = await this.queryRAG(userQuestion ?? null, schoolLevel);

      const { classification, analysis, extractedText } = await this.analyzeImageWithVision(
        base64Data,
        mimeType,
        ragResult.context,
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
          needsRAG:
            classification.documentType !== 'non-educatif' &&
            classification.subject !== 'inconnu',
          description: `Image ${classification.documentType} en ${classification.subject}`,
        },
        rag: ragResult.found ? ragResult : undefined,
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
    ragContext: string,
    schoolLevel: EducationLevelType,
    userQuestion?: string,
  ) {
    const truncatedText =
      documentText.length > 4000
        ? documentText.substring(0, 4000) + '\n...[texte tronqué]'
        : documentText;

    const systemPrompt = buildDocSystemPrompt(schoolLevel, ragContext, userQuestion);
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
    ragContext: string,
    schoolLevel: EducationLevelType,
    userQuestion?: string,
  ) {
    const systemPrompt = buildDocSystemPrompt(schoolLevel, ragContext, userQuestion);
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

  private async queryRAG(
    queryText: string | null,
    schoolLevel: EducationLevelType,
  ): Promise<RAGQueryResult> {
    if (!queryText || queryText.trim().length < 10) {
      return { found: false, chunksCount: 0, context: '' };
    }

    try {
      const isAvailable = await ragService.isAvailable();
      if (!isAvailable) {
        logger.warn('RAG service unavailable for document analysis', {
          operation: 'document-analysis:rag-unavailable',
        });
        return { found: false, chunksCount: 0, context: '' };
      }

      const truncated = queryText.length > 500 ? queryText.substring(0, 500) : queryText;

      // Matière omise volontairement : le document peut être en histoire,
      // français, sciences… La similarité vectorielle filtre.
      const response = await ragService.hybridSearch({
        query: truncated,
        niveau: schoolLevel,
        limit: 5,
        minSimilarity: 0.6,
      });

      if (response.semanticChunks.length === 0) {
        return { found: false, chunksCount: 0, context: '' };
      }

      const context = response.semanticChunks
        .map((c, i) => `[Source ${i + 1} - Score: ${c.score.toFixed(2)}]\n${c.text}`)
        .join('\n\n---\n\n');

      return { found: true, chunksCount: response.semanticChunks.length, context };
    } catch (error) {
      logger.warn('RAG query failed, continuing without context', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { found: false, chunksCount: 0, context: '' };
    }
  }
}

export const documentAnalysisService = new DocumentAnalysisService();
