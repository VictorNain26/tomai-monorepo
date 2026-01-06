/**
 * Service de chat Gemini 3 Flash - @google/genai
 *
 * Token-optimized architecture:
 * - Backend manages history (limit: 10, auto-summarization)
 * - Implicit caching via stable system prompt prefix
 * - Function calling for RAG (Qdrant + Mistral embeddings)
 * - SSE streaming with content/done/error chunks
 */

import { GoogleGenAI, type FunctionDeclaration, type Part, type Content } from '@google/genai';
import { appConfig } from '../../config/app.config.js';
import { buildSystemPrompt } from '../../config/prompts/index.js';
import { getLevelText } from '../../config/education/index.js';
import { optimizeConversationHistory } from '../../utils/conversation/index.js';
import { ragService } from '../rag.service.js';
import { logger } from '../../lib/observability.js';
import type { EducationLevelType } from '../../types/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Fichier attaché au message (Gemini Files API ou fallback base64) */
export interface AttachedFile {
  /** URI Gemini Files API (préféré, TTL 48h) */
  fileUri?: string;
  /** Fallback: base64 inline */
  base64?: string;
  /** MIME type du fichier */
  mimeType: string;
  /** Type de contenu */
  contentType: 'image' | 'document';
}

/** Fichier attaché dans l'historique (référence Gemini Files API) */
export interface HistoricalFileRef {
  /** URI Gemini Files API (TTL 48h) */
  geminiFileId?: string;
  /** MIME type pour déterminer image vs document */
  mimeType?: string;
}

/** Paramètres pour génération streaming */
export interface StreamGenerationParams {
  userId: string;
  content: string;
  subject: string;
  schoolLevel: EducationLevelType;
  firstName?: string;
  sessionId: string;
  /** Fichiers attachés au message courant (images, PDFs) */
  files?: AttachedFile[];
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    /** Fichier attaché à ce message historique */
    attachedFile?: HistoricalFileRef | null;
  }>;
}

/** SSE StreamChunk types (frontend compatibility) */
export interface GeminiStreamChunk {
  type: 'content' | 'done' | 'error';
  id: string;
  model: string;
  timestamp: number;
  // Content chunk fields
  delta?: string;
  content?: string;
  role?: 'assistant';
  // Done chunk fields
  finishReason?: 'stop' | 'length' | 'error';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  // Error chunk fields
  error?: {
    message: string;
    code?: string;
  };
  // TomAI custom metadata
  metadata?: {
    sessionId: string;
    usedRAG: boolean;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// RAG FUNCTION DECLARATION
// ═══════════════════════════════════════════════════════════════════════════

const ragSearchDeclaration: FunctionDeclaration = {
  name: 'search_educational_content',
  description: `Recherche dans les programmes officiels français (Éduscol).
Utilise cet outil pour trouver des informations précises sur les contenus éducatifs.
Retourne des extraits des programmes officiels avec leur source et pertinence.
IMPORTANT: Toujours utiliser avant de répondre à une question scolaire.`,
  parametersJsonSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'La question ou le sujet à rechercher dans les programmes officiels'
      },
      niveau: {
        type: 'string',
        enum: [
          'cp', 'ce1', 'ce2', 'cm1', 'cm2',
          'sixieme', 'cinquieme', 'quatrieme', 'troisieme',
          'seconde', 'premiere', 'terminale'
        ],
        description: "Le niveau scolaire de l'élève"
      },
      matiere: {
        type: 'string',
        description: 'La matière scolaire (mathematiques, francais, histoire, etc.)'
      },
      limit: {
        type: 'number',
        description: 'Nombre maximum de résultats (1-10, défaut: 5)'
      }
    },
    required: ['query', 'niveau', 'matiere']
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════

class GeminiChatService {
  private readonly ai: GoogleGenAI;
  private readonly model: string;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: appConfig.ai.gemini.apiKey ?? '' });
    this.model = appConfig.ai.gemini.model;
  }

  /**
   * Construit le system prompt pour le chat socratique
   */
  private buildSystemPromptForChat(params: {
    level: EducationLevelType;
    subject: string;
    firstName?: string;
  }): string {
    const levelText = getLevelText(params.level);
    const basePrompt = buildSystemPrompt({
      level: params.level,
      levelText,
      subject: params.subject,
      firstName: params.firstName
    });

    // Ajouter instructions RAG tool
    return basePrompt + `

## OUTIL DE RECHERCHE
Tu disposes de l'outil "search_educational_content". Utilise-le silencieusement.`;
  }

  /**
   * Convertit les fichiers en Parts Gemini
   */
  private buildFileParts(files?: AttachedFile[]): Part[] {
    if (!files || files.length === 0) return [];

    const parts: Part[] = [];
    for (const file of files) {
      if (file.fileUri) {
        // Gemini Files API URI (préféré)
        parts.push({
          fileData: {
            fileUri: file.fileUri,
            mimeType: file.mimeType
          }
        });
      } else if (file.base64) {
        // Fallback base64 inline
        parts.push({
          inlineData: {
            data: file.base64,
            mimeType: file.mimeType
          }
        });
      }
    }
    return parts;
  }

  /**
   * Construit l'historique de conversation au format Gemini Content[]
   */
  private buildConversationHistory(
    history: StreamGenerationParams['conversationHistory']
  ): Content[] {
    if (!history || history.length === 0) return [];

    type HistoryMessage = StreamGenerationParams['conversationHistory'][number];
    const optimized = optimizeConversationHistory(history) as HistoryMessage[];

    return optimized.map(msg => {
      const role = msg.role === 'assistant' ? 'model' : 'user';
      const parts: Part[] = [{ text: msg.content }];

      // Ajouter fichier si présent (contexte visuel persistant)
      if (msg.role === 'user' && msg.attachedFile?.geminiFileId) {
        parts.push({
          fileData: {
            fileUri: msg.attachedFile.geminiFileId,
            mimeType: msg.attachedFile.mimeType ?? 'application/octet-stream'
          }
        });
      }

      return { role, parts };
    });
  }

  /**
   * Exécute le RAG tool et retourne le résultat
   */
  private async executeRagSearch(args: {
    query: string;
    niveau: string;
    matiere: string;
    limit?: number;
  }): Promise<object> {
    const startTime = Date.now();

    try {
      const isAvailable = await ragService.isAvailable();
      if (!isAvailable) {
        return {
          found: false,
          context: '',
          resultsCount: 0,
          averageScore: 0,
          chunks: [],
          searchTimeMs: Date.now() - startTime
        };
      }

      const result = await ragService.hybridSearch({
        query: args.query,
        niveau: args.niveau as EducationLevelType,
        matiere: args.matiere,
        limit: args.limit ?? 5
      });

      return {
        found: result.semanticChunks.length > 0,
        context: result.context,
        resultsCount: result.semanticChunks.length,
        averageScore: result.averageSimilarity,
        bestMatchTitle: result.bestMatchTitle,
        bestMatchDomaine: result.bestMatchDomaine,
        chunks: result.semanticChunks,
        searchTimeMs: Date.now() - startTime
      };
    } catch (error) {
      logger.error('RAG search failed', {
        _error: error instanceof Error ? error.message : String(error),
        query: args.query.substring(0, 50),
        operation: 'gemini-chat:rag-error',
        severity: 'high' as const
      });

      return {
        found: false,
        context: '',
        resultsCount: 0,
        averageScore: 0,
        chunks: [],
        searchTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Génère un AsyncGenerator de chunks streaming
   * Format SSE compatible frontend
   */
  async *generateStreamChunks(params: StreamGenerationParams): AsyncGenerator<GeminiStreamChunk> {
    const startTime = Date.now();
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      // 1. Construire le system prompt
      const systemPrompt = this.buildSystemPromptForChat({
        level: params.schoolLevel,
        subject: params.subject,
        firstName: params.firstName
      });

      // 2. Construire l'historique
      const history = this.buildConversationHistory(params.conversationHistory);

      // 3. Construire les parts du message utilisateur (texte + fichiers)
      const userParts: Part[] = [{ text: params.content }];
      const fileParts = this.buildFileParts(params.files);
      userParts.push(...fileParts);

      logger.info('Starting Gemini chat streaming', {
        userId: params.userId,
        sessionId: params.sessionId,
        subject: params.subject,
        schoolLevel: params.schoolLevel,
        historyLength: history.length,
        filesCount: params.files?.length ?? 0,
        operation: 'gemini-chat:start'
      });

      // 4. Créer la session chat avec tools
      const chat = this.ai.chats.create({
        model: this.model,
        config: {
          systemInstruction: systemPrompt,
          tools: [{ functionDeclarations: [ragSearchDeclaration] }]
        },
        history
      });

      // 5. Envoyer le message et streamer la réponse
      let fullContent = '';
      let toolCallsCount = 0;
      let promptTokens = 0;
      let completionTokens = 0;

      // Première passe: envoyer le message
      const stream = await chat.sendMessageStream({ message: userParts });

      // Buffer pour accumuler les function calls
      let pendingFunctionCall: { name: string; args: Record<string, unknown> } | null = null;

      for await (const chunk of stream) {
        // Vérifier si c'est un function call
        if (chunk.functionCalls && chunk.functionCalls.length > 0) {
          const fc = chunk.functionCalls[0];
          pendingFunctionCall = {
            name: fc.name ?? '',
            args: fc.args as Record<string, unknown>
          };
          continue;
        }

        // Streamer le texte
        const text = chunk.text ?? '';
        if (text) {
          fullContent += text;
          yield {
            type: 'content',
            id: messageId,
            model: this.model,
            timestamp: Date.now(),
            delta: text,
            content: fullContent,
            role: 'assistant'
          };
        }

        // Capturer usage si disponible
        if (chunk.usageMetadata) {
          promptTokens = chunk.usageMetadata.promptTokenCount ?? 0;
          completionTokens = chunk.usageMetadata.candidatesTokenCount ?? 0;
        }
      }

      // 6. Si function call demandé, l'exécuter et continuer
      if (pendingFunctionCall && pendingFunctionCall.name === 'search_educational_content') {
        toolCallsCount++;

        logger.info('RAG tool called', {
          userId: params.userId,
          sessionId: params.sessionId,
          toolName: pendingFunctionCall.name,
          operation: 'gemini-chat:tool-call'
        });

        // Exécuter la recherche RAG
        const ragResult = await this.executeRagSearch(
          pendingFunctionCall.args as {
            query: string;
            niveau: string;
            matiere: string;
            limit?: number;
          }
        );

        // Envoyer le résultat au modèle et streamer la réponse finale
        const finalStream = await chat.sendMessageStream({
          message: [{
            functionResponse: {
              name: pendingFunctionCall.name,
              response: ragResult as Record<string, unknown>
            }
          }]
        });

        for await (const chunk of finalStream) {
          const text = chunk.text ?? '';
          if (text) {
            fullContent += text;
            yield {
              type: 'content',
              id: messageId,
              model: this.model,
              timestamp: Date.now(),
              delta: text,
              content: fullContent,
              role: 'assistant'
            };
          }

          // Capturer usage final
          if (chunk.usageMetadata) {
            promptTokens += chunk.usageMetadata.promptTokenCount ?? 0;
            completionTokens += chunk.usageMetadata.candidatesTokenCount ?? 0;
          }
        }
      }

      // 7. Calculer tokens totaux
      const totalTokens = promptTokens + completionTokens;

      // 8. Yield événement 'done'
      yield {
        type: 'done',
        id: messageId,
        model: this.model,
        timestamp: Date.now(),
        finishReason: 'stop',
        usage: {
          promptTokens,
          completionTokens,
          totalTokens
        },
        metadata: {
          sessionId: params.sessionId,
          usedRAG: toolCallsCount > 0
        }
      };

      logger.info('Streaming completed', {
        userId: params.userId,
        sessionId: params.sessionId,
        messageId,
        contentLength: fullContent.length,
        promptTokens,
        completionTokens,
        totalTokens,
        toolCallsCount,
        usedRAG: toolCallsCount > 0,
        durationMs: Date.now() - startTime,
        operation: 'gemini-chat:complete'
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Detect specific error types
      const isRateLimit = errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate limit');
      const isApiKey = errorMessage.toLowerCase().includes('api key') || errorMessage.includes('401');
      const isQuota = errorMessage.toLowerCase().includes('quota');

      logger.error('Streaming error', {
        _error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        userId: params.userId,
        sessionId: params.sessionId,
        durationMs: Date.now() - startTime,
        operation: 'gemini-chat:error',
        severity: 'high' as const
      });

      // User-friendly error message
      let userMessage = 'Erreur lors de la génération de la réponse. Veuillez réessayer.';
      let errorCode = 'generation_error';

      if (isRateLimit) {
        userMessage = 'Le service est temporairement surchargé. Réessayez dans quelques secondes.';
        errorCode = 'rate_limit';
      } else if (isApiKey) {
        userMessage = 'Erreur de configuration du service AI. Contactez le support.';
        errorCode = 'api_configuration';
      } else if (isQuota) {
        userMessage = 'Quota API dépassé. Réessayez plus tard.';
        errorCode = 'quota_exceeded';
      }

      yield {
        type: 'error',
        id: messageId,
        model: this.model,
        timestamp: Date.now(),
        error: {
          message: userMessage,
          code: errorCode
        }
      };
    }
  }
}

// Instance singleton
export const geminiChatService = new GeminiChatService();
