/**
 * Document Analysis Service - TanStack AI Architecture 2025
 *
 * Architecture optimisée extraction + inline context:
 * - TOUJOURS extraire le texte localement (unpdf, mammoth)
 * - Envoyer le texte extrait + image inline à l'AI
 * - Un seul appel unifié pour classification + analyse
 *
 * Avantages vs Files API:
 * - Pas de stockage externe (privacy)
 * - Latence réduite (pas de polling)
 * - Contrôle total du contexte
 * - Meilleure gestion des erreurs
 */

import { chat } from '@tanstack/ai';
import type { GeminiImageMimeType } from '@tanstack/ai-gemini';
import { z } from 'zod';
import { geminiAdapter, AI_MODELS } from '../../lib/ai/index.js';
import { logger } from '../../lib/observability.js';
import { documentExtractionService } from './document-extraction.service.js';
import { ragService } from '../rag.service.js';
import type { EducationLevelType } from '../../types/education.types.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES & SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

/** Types de documents supportés */
export type DocumentType = 'exercice' | 'cours' | 'devoir' | 'correction' | 'document' | 'non-educatif';

/** Matières scolaires */
export type SubjectType =
  | 'mathematiques' | 'francais' | 'anglais' | 'espagnol' | 'allemand'
  | 'histoire' | 'geographie' | 'emc' | 'svt' | 'physique-chimie'
  | 'technologie' | 'inconnu';

/** Schema Zod pour la classification */
const ClassificationSchema = z.object({
  documentType: z.enum(['exercice', 'cours', 'devoir', 'correction', 'document', 'non-educatif']),
  subject: z.enum([
    'mathematiques', 'francais', 'anglais', 'espagnol', 'allemand',
    'histoire', 'geographie', 'emc', 'svt', 'physique-chimie',
    'technologie', 'inconnu'
  ]),
  confidence: z.enum(['high', 'medium', 'low']),
  detectedLevel: z.string().optional()
});

/** Résultat RAG interne */
interface RAGQueryResult {
  found: boolean;
  chunksCount: number;
  context: string;
}

/** Résultat complet d'analyse de document */
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

/** Options d'analyse */
export interface DocumentAnalysisOptions {
  schoolLevel: EducationLevelType;
  userId: string;
  userQuestion?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Service d'analyse de documents - Architecture TanStack AI
 */
class DocumentAnalysisService {
  constructor() {
    logger.info('DocumentAnalysisService initialized with TanStack AI', {
      model: AI_MODELS.chat,
      architecture: 'extraction-inline-context'
    });
  }

  /**
   * Analyse complète d'un document (PDF, DOCX, TXT)
   * Architecture unifiée : Extraction locale → RAG → Analyse TanStack AI
   */
  async analyzeDocument(
    buffer: ArrayBuffer,
    fileName: string,
    mimeType: string,
    options: DocumentAnalysisOptions
  ): Promise<DocumentAnalysisResult> {
    const startTime = Date.now();
    const { schoolLevel, userId, userQuestion } = options;
    const cleanMimeType = mimeType.split(';')[0]?.trim() ?? '';

    logger.info('Starting document analysis (TanStack AI)', {
      fileName,
      mimeType: cleanMimeType,
      schoolLevel,
      userId,
      hasQuestion: !!userQuestion,
      operation: 'document-analysis-start'
    });

    try {
      // ════════════════════════════════════════════════════════════════════
      // ÉTAPE 1: EXTRACTION LOCALE (Best Practice 2025)
      // ════════════════════════════════════════════════════════════════════
      const extractionStart = Date.now();
      const extraction = await documentExtractionService.extractText(buffer, cleanMimeType, fileName);
      const extractionTimeMs = Date.now() - extractionStart;

      if (!extraction.success || !extraction.text) {
        return this.createErrorResult(startTime, extractionTimeMs, extraction.error ?? 'Extraction failed');
      }

      logger.info('Document text extracted', {
        fileName,
        wordCount: extraction.metadata.wordCount,
        method: extraction.metadata.extractionMethod,
        extractionTimeMs,
        operation: 'document-extraction-complete'
      });

      // ════════════════════════════════════════════════════════════════════
      // ÉTAPE 2: RAG QUERY (Contexte programmes officiels)
      // ════════════════════════════════════════════════════════════════════
      const ragResult = await this.queryRAG(extraction.text, schoolLevel);

      // ════════════════════════════════════════════════════════════════════
      // ÉTAPE 3: ANALYSE UNIFIÉE VIA TANSTACK AI
      // Classification + Analyse pédagogique en un seul appel
      // ════════════════════════════════════════════════════════════════════
      const analysisStart = Date.now();
      const { classification, analysis, tokensUsed } = await this.analyzeWithTanStackAI(
        extraction.text,
        ragResult.context,
        schoolLevel,
        userQuestion
      );
      const analysisTimeMs = Date.now() - analysisStart;

      const totalTimeMs = Date.now() - startTime;

      logger.info('Document analysis completed (TanStack AI)', {
        fileName,
        documentType: classification.documentType,
        subject: classification.subject,
        hadRAG: ragResult.found,
        totalTimeMs,
        tokensUsed,
        operation: 'document-analysis-complete'
      });

      return {
        success: true,
        extraction: {
          text: extraction.text,
          method: extraction.metadata.extractionMethod,
          wordCount: extraction.metadata.wordCount
        },
        classification: {
          ...classification,
          needsRAG: classification.documentType !== 'non-educatif' && classification.subject !== 'inconnu',
          description: `Document ${classification.documentType} en ${classification.subject}`
        },
        rag: ragResult.found ? ragResult : undefined,
        analysis,
        metrics: {
          totalTimeMs,
          extractionTimeMs,
          analysisTimeMs,
          tokensUsed
        }
      };

    } catch (error) {
      logger.error('Document analysis failed', {
        _error: error instanceof Error ? error.message : String(error),
        fileName,
        userId,
        operation: 'document-analysis-error',
        severity: 'high' as const
      });

      return this.createErrorResult(
        startTime,
        0,
        error instanceof Error ? error.message : 'Analysis failed'
      );
    }
  }

  /**
   * Analyse d'une image via TanStack AI multimodal
   */
  async analyzeImage(
    base64Data: string,
    mimeType: string,
    fileName: string,
    options: DocumentAnalysisOptions
  ): Promise<DocumentAnalysisResult> {
    const startTime = Date.now();
    const { schoolLevel, userId, userQuestion } = options;

    logger.info('Starting image analysis (TanStack AI multimodal)', {
      fileName,
      mimeType,
      schoolLevel,
      userId,
      operation: 'image-analysis-start'
    });

    try {
      // ════════════════════════════════════════════════════════════════════
      // ÉTAPE 1: EXTRACTION OCR + ANALYSE via Vision multimodale
      // ════════════════════════════════════════════════════════════════════
      const analysisStart = Date.now();

      // Query RAG avec un terme générique pour images
      const ragResult = await this.queryRAG('document scolaire image', schoolLevel);

      // Analyse multimodale avec image inline
      const { classification, analysis, extractedText, tokensUsed } = await this.analyzeImageWithTanStackAI(
        base64Data,
        mimeType,
        ragResult.context,
        schoolLevel,
        userQuestion
      );

      const analysisTimeMs = Date.now() - analysisStart;
      const totalTimeMs = Date.now() - startTime;

      logger.info('Image analysis completed (TanStack AI)', {
        fileName,
        documentType: classification.documentType,
        subject: classification.subject,
        totalTimeMs,
        tokensUsed,
        operation: 'image-analysis-complete'
      });

      return {
        success: true,
        extraction: {
          text: extractedText,
          method: 'tanstack-ai-vision',
          wordCount: extractedText.split(/\s+/).filter(w => w.length > 0).length
        },
        classification: {
          ...classification,
          needsRAG: classification.documentType !== 'non-educatif' && classification.subject !== 'inconnu',
          description: `Image ${classification.documentType} en ${classification.subject}`
        },
        rag: ragResult.found ? ragResult : undefined,
        analysis,
        metrics: {
          totalTimeMs,
          extractionTimeMs: 0, // Extraction incluse dans l'appel vision
          analysisTimeMs,
          tokensUsed
        }
      };

    } catch (error) {
      logger.error('Image analysis failed', {
        _error: error instanceof Error ? error.message : String(error),
        fileName,
        userId,
        operation: 'image-analysis-error',
        severity: 'high' as const
      });

      return this.createErrorResult(startTime, 0, error instanceof Error ? error.message : 'Image analysis failed');
    }
  }

  /**
   * Analyse unifiée via TanStack AI (texte uniquement)
   */
  private async analyzeWithTanStackAI(
    documentText: string,
    ragContext: string,
    schoolLevel: EducationLevelType,
    userQuestion?: string
  ): Promise<{
    classification: z.infer<typeof ClassificationSchema>;
    analysis: string;
    tokensUsed: number;
  }> {
    const truncatedText = documentText.length > 4000
      ? documentText.substring(0, 4000) + '\n...[texte tronqué]'
      : documentText;

    const systemPrompt = this.buildSystemPrompt(schoolLevel, ragContext, userQuestion);
    const userPrompt = this.buildUserPrompt(truncatedText, schoolLevel, userQuestion);

    let fullContent = '';
    let tokensUsed = 0;

    const stream = chat({
      adapter: geminiAdapter,
      model: AI_MODELS.chat as 'gemini-2.5-flash',
      messages: [
        { role: 'user', content: userPrompt }
      ],
      systemPrompts: [systemPrompt],
      providerOptions: {
        generationConfig: {
          topK: 40
        }
      }
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content') {
        fullContent += chunk.delta ?? '';
      }
      if (chunk.type === 'done' && chunk.usage) {
        tokensUsed = chunk.usage.totalTokens ?? 0;
      }
    }

    // Parser la réponse JSON
    const { classification, analysis } = this.parseAnalysisResponse(fullContent);

    return { classification, analysis, tokensUsed };
  }

  /**
   * Analyse image via TanStack AI multimodal
   */
  private async analyzeImageWithTanStackAI(
    base64Data: string,
    mimeType: string,
    ragContext: string,
    schoolLevel: EducationLevelType,
    userQuestion?: string
  ): Promise<{
    classification: z.infer<typeof ClassificationSchema>;
    analysis: string;
    extractedText: string;
    tokensUsed: number;
  }> {
    const systemPrompt = this.buildSystemPrompt(schoolLevel, ragContext, userQuestion);
    const userTextPrompt = this.buildImagePrompt(schoolLevel, userQuestion);

    let fullContent = '';
    let tokensUsed = 0;

    // Message multimodal avec image inline (TanStack AI format)
    const stream = chat({
      adapter: geminiAdapter,
      model: AI_MODELS.chat as 'gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', content: userTextPrompt },
            {
              type: 'image',
              source: { type: 'data', value: base64Data },
              metadata: { mimeType: mimeType as GeminiImageMimeType }
            }
          ]
        }
      ],
      systemPrompts: [systemPrompt],
      providerOptions: {
        generationConfig: {
          topK: 40
        }
      }
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content') {
        fullContent += chunk.delta ?? '';
      }
      if (chunk.type === 'done' && chunk.usage) {
        tokensUsed = chunk.usage.totalTokens ?? 0;
      }
    }

    // Parser la réponse JSON
    const { classification, analysis, extractedText } = this.parseImageAnalysisResponse(fullContent);

    return { classification, analysis, extractedText, tokensUsed };
  }

  /**
   * Query RAG via ragService (appels directs Qdrant/Mistral)
   */
  private async queryRAG(
    documentText: string,
    schoolLevel: EducationLevelType
  ): Promise<RAGQueryResult> {
    try {
      // Vérifier disponibilité
      const isAvailable = await ragService.isAvailable();
      if (!isAvailable) {
        logger.warn('RAG service unavailable for document analysis', {
          operation: 'document-analysis:rag-unavailable',
        });
        return { found: false, chunksCount: 0, context: '' };
      }

      const queryText = documentText.length > 500
        ? documentText.substring(0, 500)
        : documentText;

      // Recherche avec matière générique (sera déterminée par le RAG)
      const response = await ragService.hybridSearch({
        query: queryText,
        niveau: schoolLevel,
        matiere: 'mathematiques', // Fallback, le reranking corrigera
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
        error: error instanceof Error ? error.message : String(error)
      });
      return { found: false, chunksCount: 0, context: '' };
    }
  }

  /**
   * Construction du prompt système
   */
  private buildSystemPrompt(
    schoolLevel: EducationLevelType,
    ragContext: string,
    userQuestion?: string
  ): string {
    const levelNames: Record<EducationLevelType, string> = {
      cp: 'CP', ce1: 'CE1', ce2: 'CE2', cm1: 'CM1', cm2: 'CM2',
      sixieme: '6ème', cinquieme: '5ème', quatrieme: '4ème', troisieme: '3ème',
      seconde: 'Seconde', premiere: 'Première', terminale: 'Terminale'
    };

    const levelText = levelNames[schoolLevel] ?? schoolLevel;

    let prompt = `Tu es Tom, tuteur pédagogique expert pour élèves français de ${levelText}.

## FORMAT DE RÉPONSE OBLIGATOIRE
Tu DOIS répondre UNIQUEMENT avec un JSON valide au format suivant:
\`\`\`json
{
  "classification": {
    "documentType": "exercice|cours|devoir|correction|document|non-educatif",
    "subject": "mathematiques|francais|anglais|espagnol|allemand|histoire|geographie|emc|svt|physique-chimie|technologie|inconnu",
    "confidence": "high|medium|low",
    "detectedLevel": "niveau détecté ou null"
  },
  "extractedText": "texte complet extrait (pour images uniquement)",
  "analysis": "ton analyse pédagogique complète ici"
}
\`\`\`

## RÈGLES PÉDAGOGIQUES
- Utilise l'enseignement EXPLICITE pour les définitions
- Notation KaTeX ($$formule$$) pour les mathématiques
- Ton professionnel et bienveillant
- Pour les exercices: guide par questions socratiques, NE DONNE PAS la solution directement
- Pour les cours: explique les concepts clés avec exemples`;

    if (ragContext) {
      prompt += `

## PROGRAMMES OFFICIELS (RÉFÉRENCE)
${ragContext}

**IMPORTANT**: Base ton analyse sur ces programmes officiels.`;
    }

    if (userQuestion) {
      prompt += `

## QUESTION DE L'ÉLÈVE
${userQuestion}

Réponds à cette question en priorité dans ton analyse.`;
    }

    return prompt;
  }

  /**
   * Construction du prompt utilisateur pour texte
   */
  private buildUserPrompt(
    documentText: string,
    schoolLevel: EducationLevelType,
    userQuestion?: string
  ): string {
    let prompt = `Analyse ce document et réponds au format JSON demandé.

## DOCUMENT
"""
${documentText}
"""

Niveau de l'élève: ${schoolLevel}`;

    if (userQuestion) {
      prompt += `\n\nQuestion spécifique: ${userQuestion}`;
    }

    return prompt;
  }

  /**
   * Construction du prompt pour analyse d'image
   */
  private buildImagePrompt(
    schoolLevel: EducationLevelType,
    userQuestion?: string
  ): string {
    let prompt = `Analyse cette image et réponds au format JSON demandé.

TÂCHE:
1. Extrais TOUT le texte visible (OCR)
2. Classifie le document (type + matière)
3. Fournis une analyse pédagogique adaptée

Niveau de l'élève: ${schoolLevel}`;

    if (userQuestion) {
      prompt += `\n\nQuestion spécifique de l'élève: ${userQuestion}`;
    }

    return prompt;
  }

  /**
   * Parse la réponse d'analyse texte
   */
  private parseAnalysisResponse(response: string): {
    classification: z.infer<typeof ClassificationSchema>;
    analysis: string;
  } {
    try {
      // Extraire le JSON du markdown si présent
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
        analysis: response // Utiliser la réponse brute comme analyse
      };
    }
  }

  /**
   * Parse la réponse d'analyse image
   */
  private parseImageAnalysisResponse(response: string): {
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

  /**
   * Crée un résultat d'erreur
   */
  private createErrorResult(
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
}

// Singleton export
export const documentAnalysisService = new DocumentAnalysisService();
