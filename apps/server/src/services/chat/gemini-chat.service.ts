import { GoogleGenAI, ThinkingLevel, type Part, type Content } from '@google/genai';
import { appConfig } from '../../config/app.config.js';
import { buildSystemPrompt } from '../../config/prompts/index.js';
import { getLevelText } from '../../config/education/index.js';
import { optimizeConversationHistory, type OptimizationContext } from '../../utils/conversation/index.js';
import { agentToolDeclarations } from './tool-declarations.js';
import { executeTool } from './tool-executor.js';
import { logger } from '../../lib/observability.js';
import type { EducationLevelType } from '../../types/index.js';
import type { StreamGenerationParams, GeminiStreamChunk, AttachedFile, PronoteContext } from './gemini-types.js';
import { MAX_TOOL_ITERATIONS, THINKING_LEVEL_MAP, getToolStatusLabel } from './gemini-helpers.js';

// Re-export types and helpers for backward compatibility
export type { AttachedFile, HistoricalFileRef, StreamGenerationParams, GeminiStreamChunk } from './gemini-types.js';
export { getLearningContext } from './gemini-helpers.js';

class GeminiChatService {
  private readonly ai: GoogleGenAI;
  private readonly model: string;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: appConfig.ai.gemini.apiKey ?? '' });
    this.model = appConfig.ai.gemini.model;
  }

  private buildSystemPromptForChat(params: {
    level: EducationLevelType;
    subject?: string;
    firstName?: string;
    cognitiveProfileSummary?: string | null;
    learningContext?: string | null;
    pronoteContext?: PronoteContext;
  }): string {
    const levelText = getLevelText(params.level);
    const basePrompt = buildSystemPrompt({
      level: params.level,
      levelText,
      subject: params.subject,
      firstName: params.firstName
    });

    const profileSection = params.cognitiveProfileSummary
      ? `\n\n## PROFIL DE L'ÉLÈVE\n${params.cognitiveProfileSummary}`
      : '';

    const learningSection = params.learningContext
      ? `\n\n${params.learningContext}`
      : '';

    const pronoteSection = this.buildPronoteSection(params.pronoteContext);

    return basePrompt + profileSection + learningSection + pronoteSection;
  }

  private buildPronoteSection(pronoteContext?: PronoteContext): string {
    if (!pronoteContext) return '';

    const parts: string[] = [];
    if (pronoteContext.homework?.length) {
      parts.push(`DEVOIRS DE LA SEMAINE:\n${JSON.stringify(pronoteContext.homework)}`);
    }
    if (pronoteContext.recentGrades?.length) {
      parts.push(`DERNIERES NOTES:\n${JSON.stringify(pronoteContext.recentGrades)}`);
    }
    if (pronoteContext.todayTimetable?.length) {
      parts.push(`EDT DU JOUR:\n${JSON.stringify(pronoteContext.todayTimetable)}`);
    }

    if (parts.length === 0) return '';
    return `\n\n## DONNEES PRONOTE (contexte eleve)\n${parts.join('\n\n')}`;
  }

  private buildFileParts(files?: AttachedFile[]): Part[] {
    if (!files || files.length === 0) return [];

    const parts: Part[] = [];
    for (const file of files) {
      if (file.fileUri) {
        parts.push({ fileData: { fileUri: file.fileUri, mimeType: file.mimeType } });
      } else if (file.base64) {
        parts.push({ inlineData: { data: file.base64, mimeType: file.mimeType } });
      }
    }
    return parts;
  }

  private buildConversationHistory(
    history: StreamGenerationParams['conversationHistory'],
    conversationSummary?: string | null
  ): Content[] {
    if (!history || history.length === 0) return [];

    const context: OptimizationContext = { conversationSummary };
    const optimized = optimizeConversationHistory(history, context);

    return optimized.map(msg => {
      const role = msg.role === 'assistant' ? 'model' : 'user';
      const parts: Part[] = [{ text: msg.content }];
      return { role, parts };
    });
  }

  async *generateStreamChunks(params: StreamGenerationParams): AsyncGenerator<GeminiStreamChunk> {
    const startTime = Date.now();
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      const systemPrompt = this.buildSystemPromptForChat({
        level: params.schoolLevel,
        subject: params.subject,
        firstName: params.firstName,
        cognitiveProfileSummary: params.cognitiveProfileSummary,
        learningContext: params.learningContext,
        pronoteContext: params.pronoteContext,
      });

      const history = this.buildConversationHistory(params.conversationHistory, params.conversationSummary);

      const userParts: Part[] = [{ text: params.content }];
      const fileParts = this.buildFileParts(params.files);
      userParts.push(...fileParts);

      logger.info('Starting Gemini agent streaming', {
        userId: params.userId, sessionId: params.sessionId,
        subject: params.subject, schoolLevel: params.schoolLevel,
        historyLength: history.length, filesCount: params.files?.length ?? 0,
        operation: 'gemini-chat:agent-start'
      });

      const chat = this.ai.chats.create({
        model: this.model,
        config: {
          systemInstruction: systemPrompt,
          tools: [{ functionDeclarations: agentToolDeclarations }],
          thinkingConfig: {
            thinkingLevel: THINKING_LEVEL_MAP[appConfig.ai.gemini.thinkingLevel] ?? ThinkingLevel.LOW,
          }
        },
        history
      });

      let fullContent = '';
      let promptTokens = 0;
      let completionTokens = 0;
      const toolsUsed: string[] = [];
      let toolCallsCount = 0;
      let iteration = 0;

      let nextMessage: Part[] | Part[][] = userParts;

      while (iteration < MAX_TOOL_ITERATIONS) {
        const stream = await chat.sendMessageStream({ message: nextMessage });

        const pendingCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

        for await (const chunk of stream) {
          if (chunk.functionCalls && chunk.functionCalls.length > 0) {
            for (const fc of chunk.functionCalls) {
              pendingCalls.push({
                name: fc.name ?? '',
                args: (fc.args as Record<string, unknown>) ?? {}
              });
            }
            continue;
          }

          const text = chunk.text ?? '';
          if (text) {
            fullContent += text;
            yield {
              type: 'content' as const, id: messageId, model: this.model,
              timestamp: Date.now(), delta: text, content: fullContent,
              role: 'assistant' as const
            };
          }

          if (chunk.usageMetadata) {
            promptTokens = chunk.usageMetadata.promptTokenCount ?? promptTokens;
            completionTokens += chunk.usageMetadata.candidatesTokenCount ?? 0;
          }
        }

        if (pendingCalls.length === 0) break;

        toolCallsCount += pendingCalls.length;
        for (const call of pendingCalls) {
          if (!toolsUsed.includes(call.name)) {
            toolsUsed.push(call.name);
          }
        }

        logger.info('Agent tool calls', {
          userId: params.userId, sessionId: params.sessionId,
          iteration, toolNames: pendingCalls.map(c => c.name),
          operation: 'gemini-chat:tool-calls'
        });

        yield {
          type: 'status' as const, id: messageId, model: this.model,
          timestamp: Date.now(),
          status: pendingCalls.map(c => getToolStatusLabel(c.name)).join(' · ')
        };

        const results = await Promise.all(
          pendingCalls.map(call =>
            executeTool(call.name, call.args, {
              userId: params.userId, schoolLevel: params.schoolLevel,
              sessionId: params.sessionId, userRole: params.userRole,
            })
          )
        );

        for (const result of results) {
          const r = result as Record<string, unknown>;
          if (r.deckId && r.generated) {
            yield {
              type: 'deck_created' as const, id: messageId, model: this.model,
              timestamp: Date.now(),
              deck: {
                deckId: r.deckId as string, title: r.deckTitle as string,
                cardCount: r.cardCount as number, subject: r.subject as string,
              },
            };
          }
        }

        nextMessage = results.map((result, i) => ({
          functionResponse: {
            name: pendingCalls[i].name,
            response: result as Record<string, unknown>
          }
        }));

        iteration++;
      }

      const totalTokens = promptTokens + completionTokens;

      yield {
        type: 'done' as const, id: messageId, model: this.model,
        timestamp: Date.now(), finishReason: 'stop' as const,
        usage: { promptTokens, completionTokens, totalTokens },
        metadata: {
          sessionId: params.sessionId,
          usedRAG: toolsUsed.includes('search_educational_content'),
          toolsUsed, toolCallsCount
        }
      };

      logger.info('Agent streaming completed', {
        userId: params.userId, sessionId: params.sessionId, messageId,
        contentLength: fullContent.length, promptTokens, completionTokens,
        totalTokens, toolCallsCount, toolsUsed, iterations: iteration,
        durationMs: Date.now() - startTime, operation: 'gemini-chat:agent-complete'
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      const isRateLimit = errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate limit');
      const isApiKey = errorMessage.toLowerCase().includes('api key') || errorMessage.includes('401');
      const isQuota = errorMessage.toLowerCase().includes('quota');

      logger.error('Agent streaming error', {
        _error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        userId: params.userId, sessionId: params.sessionId,
        durationMs: Date.now() - startTime,
        operation: 'gemini-chat:agent-error', severity: 'high' as const
      });

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
        type: 'error' as const, id: messageId, model: this.model,
        timestamp: Date.now(),
        error: { message: userMessage, code: errorCode }
      };
    }
  }
}

export const geminiChatService = new GeminiChatService();
