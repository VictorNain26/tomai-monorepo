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
 * Paramètres pour génération streaming
 */
export interface StreamGenerationParams {
  userId: string;
  content: string;
  subject: string;
  schoolLevel: EducationLevelType;
  firstName?: string;
  sessionId: string;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
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
 * Message TanStack AI pour conversation history
 */
interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
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
   * Best Practice 2025 : L'IA décide du mode (direct/socratique/exercice) via le prompt
   */
  private buildSystemPromptForChat(params: {
    level: EducationLevelType;
    subject: string;
    firstName?: string;
    content: string;
  }): string {
    const levelText = getLevelText(params.level);

    // L'IA décide automatiquement du mode approprié via generateAdaptiveRules()
    // Plus de détection par mots-clés - Best Practice 2025
    return buildSystemPrompt({
      level: params.level,
      levelText,
      subject: params.subject,
      firstName: params.firstName,
      userQuery: params.content,
      ragContext: '' // RAG automatique via Server Tools
    });
  }

  /**
   * Construit l'historique de conversation au format TanStack AI
   */
  private buildConversationHistory(
    conversationHistory: StreamGenerationParams['conversationHistory']
  ): AIMessage[] {
    if (!conversationHistory || conversationHistory.length === 0) {
      return [];
    }

    const optimizedHistory = optimizeConversationHistory(conversationHistory);

    return optimizedHistory.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    })) as AIMessage[];
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
      // 1. Construire le system prompt (RAG automatique via tools)
      const systemPrompt = this.buildSystemPromptForChat({
        level: params.schoolLevel,
        subject: params.subject,
        firstName: params.firstName,
        content: params.content
      });

      // 2. Instructions RAG tool (utilisation silencieuse)
      // Les règles de transparence sont dans identity.ts (source unique)
      const ragToolInstructions = `

## OUTIL DE RECHERCHE
Tu disposes de l'outil "search_educational_content". Utilise-le silencieusement.`;

      const fullSystemPrompt = systemPrompt + ragToolInstructions;

      // 3. Construire l'historique de conversation
      const history = this.buildConversationHistory(params.conversationHistory);

      // 4. Ajouter le message utilisateur actuel
      const messages: AIMessage[] = [
        ...history,
        { role: 'user', content: params.content }
      ];

      logger.info('Starting TanStack AI streaming with RAG tool', {
        userId: params.userId,
        sessionId: params.sessionId,
        subject: params.subject,
        schoolLevel: params.schoolLevel,
        messagesCount: messages.length,
        operation: 'streaming:start'
      });

      // 5. Lancer le streaming TanStack AI avec Server Tools
      // Note: maxOutputTokens configuré via appConfig (16384, Gemini 2.5 Flash supports 65536)
      // TanStack AI @tanstack/ai-gemini v0.0.3 types limitées - topK seul supporté
      const stream = chat({
        adapter: geminiAdapter,
        model: model as 'gemini-2.5-flash',
        messages,
        systemPrompts: [fullSystemPrompt],
        tools: [ragSearchTool], // RAG automatique - L'AI décide quand chercher
        providerOptions: {
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

      logger.error('Streaming generation error', {
        _error: errorMessage,
        userId: params.userId,
        sessionId: params.sessionId,
        durationMs: Date.now() - startTime,
        operation: 'streaming:error',
        severity: 'medium' as const
      });

      // Yield erreur au format TanStack AI Protocol
      yield {
        type: 'error',
        id: messageId,
        model,
        timestamp: Date.now(),
        error: {
          message: 'Erreur lors de la génération de la réponse. Veuillez réessayer.',
          code: 'generation_error'
        }
      };
    }
  }
}

// Instance singleton
export const streamingService = new StreamingService();
