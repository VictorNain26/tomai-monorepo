import type { Mistral } from '@mistralai/mistralai';
import { appConfig } from '../../config/app.config.js';
import { logger } from '../../lib/observability.js';
import { getMistralClient } from '../../lib/mistral-client.js';
import { studentChatGuardrails } from '../../lib/mistral-guardrails.js';
import { documentExtractionService } from './document-extraction.service.js';
import { ragService } from '../rag.service.js';
import type { EducationLevelType } from '../../types/education.types.js';
import {
  buildSystemPrompt as buildDocSystemPrompt,
  buildUserPrompt as buildDocUserPrompt,
  buildImagePrompt as buildDocImagePrompt,
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

export type {
  DocumentType,
  SubjectType,
  DocumentAnalysisResult,
  DocumentAnalysisOptions,
} from './document-types.js';

class DocumentAnalysisService {
  private readonly client: Mistral;
  private readonly model: string;

  constructor() {
    this.client = getMistralClient();
    this.model = appConfig.ai.mistral?.chatModel ?? 'mistral-small-latest';

    logger.info('DocumentAnalysisService initialized with Mistral', {
      model: this.model,
      architecture: 'extraction-inline-context',
    });
  }

  async analyzeDocument(
    buffer: ArrayBuffer,
    fileName: string,
    mimeType: string,
    options: DocumentAnalysisOptions,
  ): Promise<DocumentAnalysisResult> {
    const startTime = Date.now();
    const { schoolLevel, userId, userQuestion } = options;
    const cleanMimeType = mimeType.split(';')[0]?.trim() ?? '';

    logger.info('Starting document analysis (Mistral)', {
      fileName,
      mimeType: cleanMimeType,
      schoolLevel,
      userId,
      hasQuestion: !!userQuestion,
      operation: 'document-analysis-start',
    });

    try {
      const extractionStart = Date.now();
      const extraction = await documentExtractionService.extractText(buffer, cleanMimeType, fileName);
      const extractionTimeMs = Date.now() - extractionStart;

      if (!extraction.success || !extraction.text) {
        return createErrorResult(startTime, extractionTimeMs, extraction.error ?? 'Extraction failed');
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
      const { classification, analysis, tokensUsed } = await this.analyzeWithMistral(
        extraction.text,
        ragResult.context,
        schoolLevel,
        userQuestion,
      );
      const analysisTimeMs = Date.now() - analysisStart;
      const totalTimeMs = Date.now() - startTime;

      logger.info('Document analysis completed (Mistral)', {
        fileName,
        documentType: classification.documentType,
        subject: classification.subject,
        hadRAG: ragResult.found,
        totalTimeMs,
        tokensUsed,
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
          needsRAG: classification.documentType !== 'non-educatif' && classification.subject !== 'inconnu',
          description: `Document ${classification.documentType} en ${classification.subject}`,
        },
        rag: ragResult.found ? ragResult : undefined,
        analysis,
        metrics: { totalTimeMs, extractionTimeMs, analysisTimeMs, tokensUsed },
      };
    } catch (error) {
      logger.error('Document analysis failed', {
        _error: error instanceof Error ? error.message : String(error),
        fileName,
        userId,
        operation: 'document-analysis-error',
        severity: 'high' as const,
      });
      return createErrorResult(startTime, 0, error instanceof Error ? error.message : 'Analysis failed');
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

    logger.info('Starting image analysis (Mistral vision)', {
      fileName,
      mimeType,
      schoolLevel,
      userId,
      operation: 'image-analysis-start',
    });

    try {
      const analysisStart = Date.now();
      const ragResult = await this.queryRAG(userQuestion ?? null, schoolLevel);

      const { classification, analysis, extractedText, tokensUsed } = await this.analyzeImageWithMistral(
        base64Data,
        mimeType,
        ragResult.context,
        schoolLevel,
        userQuestion,
      );

      const analysisTimeMs = Date.now() - analysisStart;
      const totalTimeMs = Date.now() - startTime;

      logger.info('Image analysis completed (Mistral)', {
        fileName,
        documentType: classification.documentType,
        subject: classification.subject,
        totalTimeMs,
        tokensUsed,
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
          needsRAG: classification.documentType !== 'non-educatif' && classification.subject !== 'inconnu',
          description: `Image ${classification.documentType} en ${classification.subject}`,
        },
        rag: ragResult.found ? ragResult : undefined,
        analysis,
        metrics: { totalTimeMs, extractionTimeMs: 0, analysisTimeMs, tokensUsed },
      };
    } catch (error) {
      logger.error('Image analysis failed', {
        _error: error instanceof Error ? error.message : String(error),
        fileName,
        userId,
        operation: 'image-analysis-error',
        severity: 'high' as const,
      });
      return createErrorResult(startTime, 0, error instanceof Error ? error.message : 'Image analysis failed');
    }
  }

  private async analyzeWithMistral(
    documentText: string,
    ragContext: string,
    schoolLevel: EducationLevelType,
    userQuestion?: string,
  ) {
    const truncatedText =
      documentText.length > 4000 ? `${documentText.substring(0, 4000)}\n...[texte tronqué]` : documentText;

    const systemPrompt = buildDocSystemPrompt(schoolLevel, ragContext, userQuestion);
    const userPrompt = buildDocUserPrompt(truncatedText, schoolLevel, userQuestion);

    const response = await this.client.chat.complete({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.5,
      maxTokens: 4096,
      // Student-uploaded documents are untrusted input — apply the same
      // moderation policy as the main chat. PDFs from a peer or a sketchy
      // online source can carry adversarial content even if the student is
      // unaware of it.
      guardrails: studentChatGuardrails(),
    });

    const tokensUsed = response.usage?.totalTokens ?? 0;
    const raw = response.choices?.[0]?.message?.content;
    const text = typeof raw === 'string' ? raw : '';
    const { classification, analysis } = parseAnalysisResponse(text);
    return { classification, analysis, tokensUsed };
  }

  private async analyzeImageWithMistral(
    base64Data: string,
    mimeType: string,
    ragContext: string,
    schoolLevel: EducationLevelType,
    userQuestion?: string,
  ) {
    const systemPrompt = buildDocSystemPrompt(schoolLevel, ragContext, userQuestion);
    const userTextPrompt = buildDocImagePrompt(schoolLevel, userQuestion);

    const response = await this.client.chat.complete({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userTextPrompt },
            { type: 'image_url', imageUrl: `data:${mimeType};base64,${base64Data}` },
          ],
        },
      ],
      temperature: 0.5,
      maxTokens: 4096,
      guardrails: studentChatGuardrails(),
    });

    const tokensUsed = response.usage?.totalTokens ?? 0;
    const raw = response.choices?.[0]?.message?.content;
    const text = typeof raw === 'string' ? raw : '';
    const { classification, analysis, extractedText } = parseImageAnalysisResponse(text);
    return { classification, analysis, extractedText, tokensUsed };
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
        .map((c, i) => `[Source ${i + 1} - Score: ${c.score.toFixed(2)}]\n${c.content}`)
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
