/**
 * Service de streaming SSE - TanStack AI Protocol 2025
 *
 * Architecture 100% TanStack AI:
 * - Protocole SSE standard TanStack AI (content/done/error)
 * - Compatible @tanstack/ai-react useChat hook
 * - RAG automatique via Server Tools (l'AI décide quand chercher)
 *
 * Format chunks (TanStack AI Protocol):
 * - { type: 'content', id, model, timestamp, delta, content, role }
 * - { type: 'done', id, model, timestamp, finishReason, usage }
 * - { type: 'error', id, model, timestamp, error: { message, code } }
 */

import { chat } from '@tanstack/ai';
import { geminiAdapter, AI_MODELS } from '../../lib/ai/index.js';
import { ragSearchTool } from '../../lib/ai/tools/rag-search.tool.js';
import { buildSystemPrompt } from '../../config/prompts/index.js';
import { getLevelText } from '../../config/education/index.js';
import { optimizeConversationHistory } from '../../utils/conversation/index.js';
import { logger } from '../../lib/observability.js';
import type { EducationLevelType } from '../../types/index.js';

/**
 * Fichier attaché au message (Gemini Files API ou fallback base64)
 */
export interface AttachedFile {
  /** URI Gemini Files API (préféré, TTL 48h) */
  fileUri?: string;
  /** Fallback: base64 inline */
  base64?: string;
  /** MIME type du fichier */
  mimeType: string;
  /** Type de contenu pour TanStack AI */
  contentType: 'image' | 'document';
}

/**
 * Paramètres pour génération streaming
 */
/**
 * Fichier attaché dans l'historique (référence Gemini Files API)
 * Utilisé pour maintenir le contexte visuel sur plusieurs messages
 */
export interface HistoricalFileRef {
  /** URI Gemini Files API (TTL 48h) */
  geminiFileId?: string;
  /** MIME type pour déterminer image vs document */
  mimeType?: string;
}

export interface StreamGenerationParams {
  userId: string;
  content: string;
  subject: string;
  schoolLevel: EducationLevelType;
  firstName?: string;
  sessionId: string;
  /** Fichiers attachés au message courant (images, PDFs via Gemini Files API) */
  files?: AttachedFile[];
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    /** Fichier attaché à ce message historique (contexte visuel persistant) */
    attachedFile?: HistoricalFileRef | null;
  }>;
}

/**
 * TanStack AI Protocol - StreamChunk types
 * Compatible avec @tanstack/ai-react useChat hook
 */
export interface TanStackStreamChunk {
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
  // TomAI custom metadata (sent with 'done' chunk)
  metadata?: {
    sessionId: string;
    usedRAG: boolean; // true si l'AI a utilisé le tool RAG
  };
}

/**
 * Content part pour messages multimodaux TanStack AI Gemini
 * Format: { type: 'text', content: string } pour texte (Gemini adapter)
 */
type ContentPart =
  | { type: 'text'; content: string }
  | { type: 'image'; source: { type: 'url'; value: string } | { type: 'data'; value: string }; metadata?: { mimeType: string } }
  | { type: 'document'; source: { type: 'url'; value: string } | { type: 'data'; value: string }; metadata?: { mimeType: string } };

/**
 * Message TanStack AI pour conversation history
 * Support texte simple ou multimodal (content parts)
 */
interface AIMessage {
  role: 'user' | 'assistant';
  content: string | ContentPart[];
}

/**
 * Service de streaming SSE - TanStack AI Pattern
 * RAG automatique via Server Tools - L'AI décide quand chercher
 */
class StreamingService {
  private readonly provider = 'TanStack AI + Gemini';

  /**
   * Construit le system prompt pour le chat socratique avec RAG automatique
   * Le RAG est géré via Server Tools - L'AI décide quand chercher
   * Architecture LearnLM 2025: Prompt optimisé ~700 tokens
   */
  private buildSystemPromptForChat(params: {
    level: EducationLevelType;
    subject: string;
    firstName?: string;
  }): string {
    const levelText = getLevelText(params.level);

    // Architecture LearnLM v3: Plus de userQuery dans le system prompt
    // Le mode adaptatif est géré dynamiquement par les règles
    return buildSystemPrompt({
      level: params.level,
      levelText,
      subject: params.subject,
      firstName: params.firstName
      // ragContext non fourni = RAG automatique via Server Tools
    });
  }

  /**
   * Construit les content parts pour un message avec fichiers
   * Utilise fileUri (Gemini Files API) en priorité, fallback base64
   */
  private buildMultimodalContent(text: string, files?: AttachedFile[]): string | ContentPart[] {
    if (!files || files.length === 0) {
      return text;
    }

    const parts: ContentPart[] = [{ type: 'text', content: text }];

    for (const file of files) {
      // Priorité: fileUri (Gemini Files API, 48h TTL) > base64 inline
      const source = file.fileUri
        ? { type: 'url' as const, value: file.fileUri }
        : file.base64
          ? { type: 'data' as const, value: file.base64 }
          : null;

      if (!source) continue;

      if (file.contentType === 'image') {
        parts.push({
          type: 'image',
          source,
          metadata: { mimeType: file.mimeType }
        });
      } else if (file.contentType === 'document') {
        parts.push({
          type: 'document',
          source,
          metadata: { mimeType: file.mimeType }
        });
      }
    }

    return parts.length === 1 ? text : parts;
  }

  /**
   * Construit l'historique de conversation au format TanStack AI
   * Inclut les fichiers des messages précédents pour maintenir le contexte visuel
   * Best Practice 2026: L'élève peut poser des questions sur une image précédente
   */
  private buildConversationHistory(
    conversationHistory: StreamGenerationParams['conversationHistory']
  ): AIMessage[] {
    if (!conversationHistory || conversationHistory.length === 0) {
      return [];
    }

    // optimizeConversationHistory préserve les propriétés additionnelles (attachedFile)
    // mais son typage IAIMessage[] ne les expose pas - on utilise le type d'entrée
    type HistoryMessage = StreamGenerationParams['conversationHistory'][number];
    const optimizedHistory = optimizeConversationHistory(conversationHistory) as HistoryMessage[];

    return optimizedHistory.map(msg => {
      const role = msg.role === 'assistant' ? 'assistant' : 'user';

      // Messages assistant: toujours text-only
      if (role === 'assistant') {
        return { role, content: msg.content };
      }

      // Messages user: vérifier s'il y a un fichier attaché
      const file = msg.attachedFile;
      if (!file?.geminiFileId) {
        return { role, content: msg.content };
      }

      // Créer content parts multimodaux pour message avec fichier
      const contentType = this.getContentTypeFromMime(file.mimeType);
      const parts: ContentPart[] = [
        { type: 'text', content: msg.content }
      ];

      // Ajouter le fichier Gemini (URI valide 48h)
      if (contentType === 'image') {
        parts.push({
          type: 'image',
          source: { type: 'url', value: file.geminiFileId },
          metadata: { mimeType: file.mimeType ?? 'image/jpeg' }
        });
      } else {
        parts.push({
          type: 'document',
          source: { type: 'url', value: file.geminiFileId },
          metadata: { mimeType: file.mimeType ?? 'application/pdf' }
        });
      }

      return { role, content: parts };
    }) as AIMessage[];
  }

  /**
   * Détermine le type de contenu à partir du MIME type
   */
  private getContentTypeFromMime(mimeType?: string): 'image' | 'document' {
    if (!mimeType) return 'document';
    return mimeType.startsWith('image/') ? 'image' : 'document';
  }

  /**
   * Génère un AsyncGenerator de TanStackStreamChunk
   * Format protocole TanStack AI - compatible avec @tanstack/ai-react useChat
   *
   * RAG automatique via Server Tools:
   * L'AI décide automatiquement quand utiliser le tool search_educational_content
   */
  async *generateStreamChunks(params: StreamGenerationParams): AsyncGenerator<TanStackStreamChunk> {
    const startTime = Date.now();
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const model = AI_MODELS.chat;

    try {
      // 1. Construire le system prompt (LearnLM v3, ~700 tokens)
      const systemPrompt = this.buildSystemPromptForChat({
        level: params.schoolLevel,
        subject: params.subject,
        firstName: params.firstName
      });

      // 2. Instructions RAG tool (utilisation silencieuse)
      // Les règles de transparence sont dans identity.ts (source unique)
      const ragToolInstructions = `

## OUTIL DE RECHERCHE
Tu disposes de l'outil "search_educational_content". Utilise-le silencieusement.`;

      const fullSystemPrompt = systemPrompt + ragToolInstructions;

      // 3. Construire l'historique de conversation (avec fichiers multimodaux)
      const history = this.buildConversationHistory(params.conversationHistory);

      // 4. Ajouter le message utilisateur actuel (avec fichiers si présents)
      const currentUserContent = this.buildMultimodalContent(params.content, params.files);
      const messages: AIMessage[] = [
        ...history,
        { role: 'user', content: currentUserContent }
      ];

      // Compter les fichiers pour le logging
      const filesCount = params.files?.length ?? 0;
      const hasMultimodal = filesCount > 0;

      logger.info('Starting TanStack AI streaming with RAG tool', {
        userId: params.userId,
        sessionId: params.sessionId,
        subject: params.subject,
        schoolLevel: params.schoolLevel,
        messagesCount: messages.length,
        filesCount,
        hasMultimodal,
        operation: 'streaming:start'
      });

      // 5. Lancer le streaming TanStack AI avec Server Tools
      // Note: maxOutputTokens configuré via appConfig (16384, Gemini 2.5 Flash supports 65536)
      // Type assertion pour compatibilité avec types internes TanStack AI Gemini
      const stream = chat({
        adapter: geminiAdapter,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: messages as any, // Content parts compatibles avec Gemini multimodal
        systemPrompts: [fullSystemPrompt],
        tools: [ragSearchTool], // RAG automatique - L'AI décide quand chercher
        modelOptions: {
          generationConfig: {
            topK: 40
          }
        }
      });

      let fullContent = '';
      let promptTokens = 0;
      let completionTokens = 0;
      let toolCallsCount = 0;

      // 6. Itérer sur les chunks TanStack AI et transformer en protocole standard
      for await (const chunk of stream) {
        if (chunk.type === 'content') {
          const delta = chunk.delta ?? '';
          fullContent += delta;

          // Yield chunk au format TanStack AI Protocol
          yield {
            type: 'content',
            id: messageId,
            model,
            timestamp: Date.now(),
            delta,
            content: fullContent,
            role: 'assistant'
          };
        }

        // Capturer les tool calls (RAG automatique)
        if (chunk.type === 'tool_call') {
          toolCallsCount++;
          logger.info('RAG tool called by AI', {
            userId: params.userId,
            sessionId: params.sessionId,
            toolName: chunk.toolCall.function.name,
            operation: 'streaming:tool-call'
          });
        }

        // Capturer les tokens du chunk final TanStack AI
        if (chunk.type === 'done' && chunk.usage) {
          promptTokens = chunk.usage.promptTokens ?? 0;
          completionTokens = chunk.usage.completionTokens ?? 0;
        }

        // Gérer les erreurs du stream TanStack AI
        if (chunk.type === 'error') {
          throw new Error(chunk.error?.message ?? 'Streaming error');
        }
      }

      // 7. Calculer tokens totaux (Gemini fournit les valeurs exactes via TanStack AI)
      // Fallback: estimation simple si Gemini ne retourne pas les tokens (rare)
      const hasRealTokenCount = promptTokens > 0 || completionTokens > 0;
      const totalTokens = hasRealTokenCount
        ? promptTokens + completionTokens
        : Math.ceil(fullContent.length / 4); // Approximation: 1 token ≈ 4 chars FR

      // 8. Yield événement 'done' au format TanStack AI Protocol
      yield {
        type: 'done',
        id: messageId,
        model,
        timestamp: Date.now(),
        finishReason: 'stop',
        usage: {
          promptTokens,
          completionTokens,
          totalTokens
        },
        // TomAI metadata - sera extrait par le frontend
        metadata: {
          sessionId: params.sessionId,
          usedRAG: toolCallsCount > 0 // RAG automatique via tool calls
        }
      };

      logger.info('Streaming completed (TanStack AI Protocol + Server Tools)', {
        userId: params.userId,
        sessionId: params.sessionId,
        messageId,
        contentLength: fullContent.length,
        promptTokens,
        completionTokens,
        totalTokens,
        tokenSource: hasRealTokenCount ? 'gemini' : 'estimated',
        toolCallsCount,
        usedRAG: toolCallsCount > 0,
        durationMs: Date.now() - startTime,
        operation: 'streaming:complete'
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      // Detect specific error types for better user feedback
      const isRateLimit = errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate limit');
      const isApiKey = errorMessage.toLowerCase().includes('api key') || errorMessage.includes('401');
      const isModelNotFound = errorMessage.toLowerCase().includes('model not found') || errorMessage.includes('404');
      const isQuota = errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('exceeded');

      logger.error('Streaming generation error', {
        _error: errorMessage,
        stack: errorStack,
        userId: params.userId,
        sessionId: params.sessionId,
        subject: params.subject,
        schoolLevel: params.schoolLevel,
        durationMs: Date.now() - startTime,
        operation: 'streaming:error',
        errorType: isRateLimit ? 'rate_limit' : isApiKey ? 'api_key' : isModelNotFound ? 'model_not_found' : isQuota ? 'quota' : 'unknown',
        severity: 'high' as const
      });

      // User-friendly error message based on error type
      let userMessage = 'Erreur lors de la génération de la réponse. Veuillez réessayer.';
      let errorCode = 'generation_error';

      if (isRateLimit) {
        userMessage = 'Le service est temporairement surchargé. Réessayez dans quelques secondes.';
        errorCode = 'rate_limit';
      } else if (isApiKey) {
        userMessage = 'Erreur de configuration du service AI. Contactez le support.';
        errorCode = 'api_configuration';
      } else if (isModelNotFound) {
        userMessage = 'Le modèle AI n\'est pas disponible. Contactez le support.';
        errorCode = 'model_unavailable';
      } else if (isQuota) {
        userMessage = 'Quota API dépassé. Réessayez plus tard.';
        errorCode = 'quota_exceeded';
      }

      // Yield erreur au format TanStack AI Protocol
      // NOTE: Actual error details are logged server-side, NOT sent to client
      yield {
        type: 'error',
        id: messageId,
        model,
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
export const streamingService = new StreamingService();
