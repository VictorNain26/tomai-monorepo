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
import { buildSystemPrompt, estimateTokens } from '../../config/prompts/index.js';
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
   */
  private buildSystemPromptForChat(params: {
    level: EducationLevelType;
    subject: string;
    firstName?: string;
    content: string;
  }): string {
    const levelText = getLevelText(params.level);

    // Détection type d'activité depuis la query
    const isExercice = this.detectExercice(params.content);
    const isProduction = this.detectProduction(params.content);

    return buildSystemPrompt({
      level: params.level,
      levelText,
      subject: params.subject,
      firstName: params.firstName,
      userQuery: params.content,
      ragContext: '', // RAG automatique via Server Tools
      isExercice,
      isProduction
    });
  }

  /**
   * Détecte si la query demande un exercice
   */
  private detectExercice(query: string): boolean {
    const exerciceKeywords = [
      'exercice', 'exo', 'entraîn', 'pratiqu', 'quiz',
      'question', 'test', 'évaluation', 'contrôle'
    ];
    const lowerQuery = query.toLowerCase();
    return exerciceKeywords.some(kw => lowerQuery.includes(kw));
  }

  /**
   * Détecte si la query demande une production écrite
   */
  private detectProduction(query: string): boolean {
    const productionKeywords = [
      'rédige', 'écris', 'dissertation', 'essai', 'texte',
      'composition', 'paragraphe', 'résumé', 'commentaire'
    ];
    const lowerQuery = query.toLowerCase();
    return productionKeywords.some(kw => lowerQuery.includes(kw));
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

      // 2. Ajouter instructions RAG tool au system prompt
      const ragToolInstructions = `

OUTIL DE RECHERCHE ÉDUCATIVE:
Tu disposes d'un outil "search_educational_content" pour rechercher dans les programmes officiels français.
- Niveau scolaire de l'élève: ${params.schoolLevel}
- Matière: ${params.subject}
IMPORTANT: Utilise TOUJOURS cet outil pour les questions éducatives afin de fournir des réponses basées sur les programmes officiels Éduscol.`;

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

      // 7. Fallback estimation si tokens non disponibles
      const totalTokens = promptTokens + completionTokens || estimateTokens(fullContent);

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
        totalTokens,
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
