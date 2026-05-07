/**
 * Mistral chat service — Tom's primary tutoring stream.
 *
 * Backed by Mistral Small 4
 * (`mistral-small-latest`) with optional `reasoning_effort: "high"` for
 * problem-solving turns. The agent loop drives up to MAX_TOOL_ITERATIONS
 * rounds of tool calls before yielding the final answer to the client.
 *
 * The streaming surface is provider-agnostic (`ChatStreamChunk`) so the
 * orchestration layer doesn't need to know we're talking to Mistral.
 */

import type { Mistral } from '@mistralai/mistralai';
import { appConfig } from '../../config/app.config.js';
import { getMistralClient } from '../../lib/mistral-client.js';
import { studentChatGuardrails } from '../../lib/mistral-guardrails.js';
import { routeReasoningEffort } from '../../lib/mistral-reasoning.js';
import { buildSystemPrompt } from '../../config/prompts/index.js';
import { getLevelText } from '../../config/education/index.js';
import {
  optimizeConversationHistory,
  type OptimizationContext,
} from '../../utils/conversation/index.js';
import { agentTools } from './mistral-tool-declarations.js';
import { executeTool, isDeckCreatedResult } from './tool-executor.js';
import { logger } from '../../lib/observability.js';
import { withTimeout } from '../../lib/retry.js';
import type { EducationLevelType } from '../../types/index.js';
import type {
  AttachedFile,
  ChatStreamChunk,
  PronoteContext,
  StreamGenerationParams,
} from './mistral-types.js';
import {
  MAX_TOOL_ITERATIONS,
  MISTRAL_STREAM_SETUP_TIMEOUT_MS,
  MISTRAL_STREAM_CHUNK_TIMEOUT_MS,
  wrapUserMessage,
  getToolStatusLabel,
} from './mistral-helpers.js';

// Re-export types so callers can import either from this service or from
// mistral-types.ts directly.
export type {
  AttachedFile,
  HistoricalFileRef,
  StreamGenerationParams,
  ChatStreamChunk,
  PronoteContext,
} from './mistral-types.js';
export { getLearningContext } from './mistral-helpers.js';

// Mistral SDK message shape (camelCase per the official TS client).
type MistralRole = 'system' | 'user' | 'assistant' | 'tool';

interface MistralTextPart {
  type: 'text';
  text: string;
}

interface MistralImagePart {
  type: 'image_url';
  imageUrl: string;
}

type MistralContent = string | Array<MistralTextPart | MistralImagePart>;

interface MistralToolCallShape {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface MistralMessage {
  role: MistralRole;
  content: MistralContent;
  toolCalls?: MistralToolCallShape[];
  toolCallId?: string;
  name?: string;
}

class MistralChatService {
  private readonly client: Mistral;
  private readonly model: string;

  constructor() {
    this.client = getMistralClient();
    this.model = appConfig.ai.mistral?.chatModel ?? 'mistral-small-latest';
  }

  private buildSystemPromptForChat(params: {
    level: EducationLevelType;
    subject?: string;
    firstName?: string;
    cognitiveProfileSummary?: string | null;
    learningContext?: string | null;
    pronoteContext?: PronoteContext;
    intentReinforcement?: string | null;
  }): string {
    const levelText = getLevelText(params.level);
    const basePrompt = buildSystemPrompt({
      level: params.level,
      levelText,
      subject: params.subject,
      firstName: params.firstName,
    });

    const profileSection = params.cognitiveProfileSummary
      ? `\n\n## PROFIL DE L'ÉLÈVE\n${params.cognitiveProfileSummary}`
      : '';
    const learningSection = params.learningContext ? `\n\n${params.learningContext}` : '';
    const pronoteSection = this.buildPronoteSection(params.pronoteContext);

    // Turn-specific reinforcement goes LAST so it takes precedence over the
    // more general safety guidance (recency bias in instruction-following).
    const intentSection = params.intentReinforcement ? `\n\n${params.intentReinforcement}` : '';

    return basePrompt + profileSection + learningSection + pronoteSection + intentSection;
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

  private buildUserContentParts(
    text: string,
    files?: AttachedFile[],
  ): MistralContent {
    const wrapped = wrapUserMessage(text);
    const visionParts: MistralImagePart[] = [];

    if (files) {
      for (const f of files) {
        if (f.contentType !== 'image') continue;
        if (f.fileUrl) {
          visionParts.push({ type: 'image_url', imageUrl: f.fileUrl });
        } else if (f.base64) {
          // Mistral accepts data URIs in the imageUrl field per its docs.
          visionParts.push({
            type: 'image_url',
            imageUrl: `data:${f.mimeType};base64,${f.base64}`,
          });
        }
      }
    }

    if (visionParts.length === 0) {
      return wrapped;
    }
    return [{ type: 'text', text: wrapped }, ...visionParts];
  }

  private buildHistory(
    history: StreamGenerationParams['conversationHistory'],
    conversationSummary?: string | null,
  ): MistralMessage[] {
    if (!history || history.length === 0) return [];

    const context: OptimizationContext = { conversationSummary };
    const optimized = optimizeConversationHistory(history, context);

    return optimized.map<MistralMessage>((msg) => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    }));
  }

  async *generateStreamChunks(
    params: StreamGenerationParams,
  ): AsyncGenerator<ChatStreamChunk> {
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
        intentReinforcement: params.intentReinforcement,
      });

      const messages: MistralMessage[] = [{ role: 'system', content: systemPrompt }];

      messages.push(...this.buildHistory(params.conversationHistory, params.conversationSummary));

      messages.push({
        role: 'user',
        content: this.buildUserContentParts(params.content, params.files),
      });

      logger.info('Starting Mistral agent streaming', {
        userId: params.userId,
        sessionId: params.sessionId,
        subject: params.subject,
        schoolLevel: params.schoolLevel,
        historyLength: params.conversationHistory.length,
        filesCount: params.files?.length ?? 0,
        operation: 'mistral-chat:agent-start',
      });

      let fullContent = '';
      let promptTokens = 0;
      let completionTokens = 0;
      const toolsUsed: string[] = [];
      let toolCallsCount = 0;
      let iteration = 0;

      // Decide once at turn start: a turn that asks the tutor to actually
      // reason about a STEM problem in collège/lycée gets the heavier
      // thinking mode; everything else stays on `none` for conversational
      // latency. Recomputed per-turn (not per-iteration) since the routing
      // criteria don't change inside a single agent loop.
      const reasoningEffort = routeReasoningEffort({
        schoolLevel: params.schoolLevel,
        subject: params.subject,
      });

      while (iteration < MAX_TOOL_ITERATIONS) {
        const stream = await withTimeout(
          this.client.chat.stream({
            model: this.model,
            messages: messages as Parameters<typeof this.client.chat.stream>[0]['messages'],
            tools: agentTools as Parameters<typeof this.client.chat.stream>[0]['tools'],
            toolChoice: 'auto',
            temperature: appConfig.ai.mistral?.temperature ?? 0.7,
            maxTokens: appConfig.ai.mistral?.maxTokens ?? 16384,
            reasoningEffort,
            // Force one tool call per turn. Mistral parallelises by default,
            // which is fine for back-office pipelines but breaks the socratic
            // discipline of the tutor: parallel calls produce a single fused
            // assistant turn that mixes "search programs" + "create cards" +
            // "update profile" without giving the student a chance to react
            // between steps. Sequential keeps each act observable in the
            // stream and lets the agent loop re-plan after each result.
            parallelToolCalls: false,
            // Mistral's officially recommended moderation pattern. The
            // thresholds are tuned for a CP–Terminale audience: any sexual,
            // self-harm, violence, hate, dangerous, criminal, or PII signal
            // above 0.1 blocks the response (HTTP 403 with category detail).
            guardrails: studentChatGuardrails(),
          }),
          MISTRAL_STREAM_SETUP_TIMEOUT_MS,
          `mistral:stream-setup (iter ${iteration})`,
        );

        // Per-iteration accumulators. Mistral streams tool calls as deltas
        // (id + name on first chunk, arguments built up across subsequent
        // chunks), so we coalesce by index before dispatching.
        const toolCallAccum = new Map<number, MistralToolCallShape>();
        const iterator = stream[Symbol.asyncIterator]();

        while (true) {
          const step = await withTimeout(
            iterator.next(),
            MISTRAL_STREAM_CHUNK_TIMEOUT_MS,
            `mistral:stream-chunk (iter ${iteration})`,
          );
          if (step.done) break;
          const event = step.value;
          const data = event.data;
          const choice = data?.choices?.[0];
          if (!choice) continue;

          const deltaContent = choice.delta?.content;
          if (typeof deltaContent === 'string' && deltaContent.length > 0) {
            fullContent += deltaContent;
            yield {
              type: 'content' as const,
              id: messageId,
              model: this.model,
              timestamp: Date.now(),
              delta: deltaContent,
              content: fullContent,
              role: 'assistant' as const,
            };
          }

          const deltaToolCalls = choice.delta?.toolCalls;
          if (deltaToolCalls && deltaToolCalls.length > 0) {
            for (let i = 0; i < deltaToolCalls.length; i += 1) {
              const tc = deltaToolCalls[i];
              if (!tc) continue;
              const idx = i;
              const rawArgs = tc.function?.arguments;
              const argsStr =
                typeof rawArgs === 'string' ? rawArgs : rawArgs ? JSON.stringify(rawArgs) : '';
              const existing = toolCallAccum.get(idx);
              if (existing) {
                if (argsStr.length > 0) {
                  existing.function.arguments += argsStr;
                }
              } else {
                toolCallAccum.set(idx, {
                  id: tc.id ?? `call_${Date.now()}_${idx}`,
                  type: 'function',
                  function: {
                    name: tc.function?.name ?? '',
                    arguments: argsStr,
                  },
                });
              }
            }
          }

          if (data?.usage) {
            promptTokens = data.usage.promptTokens ?? promptTokens;
            completionTokens = data.usage.completionTokens ?? completionTokens;
          }
        }

        const pendingCalls = Array.from(toolCallAccum.values()).filter(
          (tc) => tc.function.name.length > 0,
        );

        if (pendingCalls.length === 0) break;

        toolCallsCount += pendingCalls.length;
        for (const call of pendingCalls) {
          if (!toolsUsed.includes(call.function.name)) {
            toolsUsed.push(call.function.name);
          }
        }

        logger.info('Agent tool calls', {
          userId: params.userId,
          sessionId: params.sessionId,
          iteration,
          toolNames: pendingCalls.map((c) => c.function.name),
          operation: 'mistral-chat:tool-calls',
        });

        yield {
          type: 'status' as const,
          id: messageId,
          model: this.model,
          timestamp: Date.now(),
          status: pendingCalls.map((c) => getToolStatusLabel(c.function.name)).join(' · '),
        };

        // Append the assistant turn that requested the tools, then dispatch.
        messages.push({
          role: 'assistant',
          content: '',
          toolCalls: pendingCalls,
        });

        const results = await Promise.all(
          pendingCalls.map((call) => {
            let parsedArgs: Record<string, unknown> = {};
            try {
              parsedArgs = JSON.parse(call.function.arguments) as Record<string, unknown>;
            } catch (err) {
              logger.warn('Tool call arguments parse failed', {
                operation: 'mistral-chat:tool-args-parse',
                toolName: call.function.name,
                _error: err instanceof Error ? err.message : String(err),
              });
            }
            return executeTool(call.function.name, parsedArgs, {
              userId: params.userId,
              schoolLevel: params.schoolLevel,
              sessionId: params.sessionId,
              userRole: params.userRole,
            });
          }),
        );

        for (const result of results) {
          if (isDeckCreatedResult(result)) {
            yield {
              type: 'deck_created' as const,
              id: messageId,
              model: this.model,
              timestamp: Date.now(),
              deck: {
                deckId: result.deckId,
                title: result.deckTitle,
                cardCount: result.cardCount,
                subject: result.subject,
              },
            };
          }
        }

        // Push tool results back into the conversation as `role: tool` messages
        // tied to the originating call id.
        for (let i = 0; i < pendingCalls.length; i += 1) {
          const call = pendingCalls[i];
          if (!call) continue;
          messages.push({
            role: 'tool',
            name: call.function.name,
            toolCallId: call.id,
            content: JSON.stringify(results[i] ?? {}),
          });
        }

        iteration += 1;
      }

      const totalTokens = promptTokens + completionTokens;

      yield {
        type: 'done' as const,
        id: messageId,
        model: this.model,
        timestamp: Date.now(),
        finishReason: 'stop' as const,
        usage: { promptTokens, completionTokens, totalTokens },
        metadata: {
          sessionId: params.sessionId,
          usedRAG: toolsUsed.includes('search_educational_content'),
          toolsUsed,
          toolCallsCount,
        },
      };

      logger.info('Agent streaming completed', {
        userId: params.userId,
        sessionId: params.sessionId,
        messageId,
        contentLength: fullContent.length,
        promptTokens,
        completionTokens,
        totalTokens,
        toolCallsCount,
        toolsUsed,
        iterations: iteration,
        durationMs: Date.now() - startTime,
        operation: 'mistral-chat:agent-complete',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const lower = errorMessage.toLowerCase();

      const isRateLimit = errorMessage.includes('429') || lower.includes('rate limit');
      const isApiKey = lower.includes('api key') || errorMessage.includes('401');
      const isQuota = lower.includes('quota');
      const isTimeout = errorMessage.includes('timed out') || errorMessage.includes('TimeoutError');
      // Mistral guardrails block returns 403 with the violated categories
      // in the body. Distinct from a generic auth 403 by the presence of
      // moderation/guardrail keywords.
      const isGuardrailBlock =
        errorMessage.includes('403') &&
        (lower.includes('guardrail') || lower.includes('moderation') || lower.includes('blocked'));

      logger.error('Agent streaming error', {
        _error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        userId: params.userId,
        sessionId: params.sessionId,
        durationMs: Date.now() - startTime,
        operation: 'mistral-chat:agent-error',
        severity: 'high' as const,
      });

      let userMessage = 'Erreur lors de la génération de la réponse. Veuillez réessayer.';
      let errorCode = 'generation_error';

      if (isGuardrailBlock) {
        userMessage = "Je ne peux pas répondre à ce message. Reformule en restant sur ton travail scolaire.";
        errorCode = 'safety_block';
      } else if (isRateLimit) {
        userMessage = 'Le service est temporairement surchargé. Réessayez dans quelques secondes.';
        errorCode = 'rate_limit';
      } else if (isApiKey) {
        userMessage = 'Erreur de configuration du service AI. Contactez le support.';
        errorCode = 'api_configuration';
      } else if (isQuota) {
        userMessage = 'Quota API dépassé. Réessayez plus tard.';
        errorCode = 'quota_exceeded';
      } else if (isTimeout) {
        userMessage = 'Le service met trop de temps à répondre. Réessayez.';
        errorCode = 'stream_timeout';
      }

      yield {
        type: 'error' as const,
        id: messageId,
        model: this.model,
        timestamp: Date.now(),
        error: { message: userMessage, code: errorCode },
      };
    }
  }
}

export const mistralChatService = new MistralChatService();
