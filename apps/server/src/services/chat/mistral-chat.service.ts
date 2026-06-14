/**
 * MistralChatService — main chat orchestrator (Phase 2B core).
 *
 * Streams the assistant response from Mistral
 * with tool support, runs the agentic loop (model -> tool calls -> tool results
 * -> model), and emits a uniform `ChatStreamChunk` sequence consumed by
 * `chat-orchestration.service.ts`.
 *
 * Model
 *   `mistral-medium-latest` — sweet spot for agentic chat with tools, native
 *   streaming, and multimodal vision in the same model (Pixtral fusion).
 *
 * A future iteration can route to `magistral-small-latest` on detected
 * "complex math reasoning" turns (ADR-0001 D2). Not done here to keep the
 * migration diff focused on parity.
 *
 * Tools
 *   Plain JSON Schema tools (tool-declarations.ts), passed to the model as
 *   `tools: agentTools`. The model returns `tool_calls` events on the stream;
 *   we collect them, call `executeTool(name, args, ctx)` from tool-executor,
 *   then feed the JSON-serialised results back as `role: 'tool'` messages.
 *
 * Prompt cache
 *   `prompt_cache_key = "chat-<promptVersion>-<schoolLevel>-<userRole>"` so the
 *   stable system prompt prefix gets the 90% cached-tokens discount across
 *   turns of the same school level and role. Bump the prompt version constant
 *   whenever the system prompt template changes.
 */

import { chatStream, type MistralMessage, type MistralToolCall, type MistralContentPart } from '../../lib/ai/mistral-client.js';
import { routeReasoningEffort } from '../../lib/ai/mistral-reasoning.js';
import { detectSystemPromptLeak } from '../../lib/ai/mistral-guardrails.js';
import { buildSystemPrompt } from '../../config/prompts/index.js';
import { getLevelText } from '../../config/education/index.js';
import { optimizeConversationHistory, type OptimizationContext } from '../../utils/conversation/index.js';
import { agentTools } from './tool-declarations.js';
import { executeTool, isDeckCreatedResult } from './tool-executor.js';
import { logger } from '../../lib/observability.js';
import { withTimeout } from '../../lib/retry.js';
import type { EducationLevelType } from '../../types/index.js';
import type {
  StreamGenerationParams,
  ChatStreamChunk,
  AttachedFile,
} from './chat-streaming-types.js';
import {
  MAX_TOOL_ITERATIONS,
  CHAT_STREAM_SETUP_TIMEOUT_MS,
  CHAT_STREAM_CHUNK_TIMEOUT_MS,
  wrapUserMessage,
  wrapPronoteData,
  wrapStudentContext,
  wrapAttachedFiles,
  wrapCurriculumToolResult,
  getToolStatusLabel,
} from './mistral-helpers.js';

const MODEL = 'mistral-medium-latest';
const TEMPERATURE = 0.6;
const MAX_TOKENS = 1024;
// Bump this constant whenever content under config/prompts/** or shared/pedagogy/**
// changes — otherwise Mistral serves the stale cached prefix.
const PROMPT_CACHE_VERSION = '2026-06-14-viz';

class MistralChatService {
  private buildSystemPromptForChat(params: {
    level: EducationLevelType;
    subject?: string;
    firstName?: string;
  }): string {
    const levelText = getLevelText(params.level);
    return buildSystemPrompt({
      level: params.level,
      levelText,
      subject: params.subject,
      firstName: params.firstName,
    });
  }

  private buildHistoryMessages(
    history: StreamGenerationParams['conversationHistory'],
    conversationSummary?: string | null,
  ): MistralMessage[] {
    if (!history || history.length === 0) return [];

    const context: OptimizationContext = { conversationSummary };
    const optimized = optimizeConversationHistory(history, context);

    return optimized
      .filter((msg): msg is typeof msg & { role: 'assistant' | 'user'; content: string } =>
        msg.role !== 'system' && msg.content !== null && msg.content !== undefined
      )
      .map((msg): MistralMessage => {
        if (msg.role === 'assistant') {
          // AssistantMessage from SDK type — role forced to "assistant"
          return { role: 'assistant', content: msg.content, toolCalls: undefined };
        }
        // Past user turns are stored raw (chat-orchestration persists request.content
        // unwrapped) — re-fence them so an injection in an earlier turn stays inert.
        return { role: 'user', content: wrapUserMessage(msg.content) };
      });
  }

  private buildUserContent(content: string, files?: AttachedFile[]): string | MistralContentPart[] {
    const wrapped = wrapUserMessage(content);
    if (!files || files.length === 0) return wrapped;

    // Multimodal turn: text + image_url parts. Document analyses (OCR) are
    // injected as a separate <attached_file> block (attachedFilesBlock), so we
    // only attach image bytes here.
    const imageParts = files
      .filter((f) => f.contentType === 'image' && f.base64)
      .map((f) => ({
        type: 'image_url' as const,
        imageUrl: { url: `data:${f.mimeType};base64,${f.base64}` },
      }));

    if (imageParts.length === 0) return wrapped;
    return [{ type: 'text' as const, text: wrapped }, ...imageParts];
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
      });

      const userContent = this.buildUserContent(params.content, params.files);
      const pronoteBlock = wrapPronoteData(params.pronoteContext);
      const studentContextBlock = wrapStudentContext(params.cognitiveProfileSummary, params.learningContext);
      const attachedFilesBlock = params.attachedFiles?.length
        ? wrapAttachedFiles(params.attachedFiles)
        : '';
      const historyMessages = this.buildHistoryMessages(params.conversationHistory, params.conversationSummary);

      // The agentic loop appends assistant + tool messages to this array as it iterates.
      const messages: MistralMessage[] = [
        { role: 'system' as const, content: systemPrompt },
        ...historyMessages,
        ...(studentContextBlock ? [{ role: 'user' as const, content: studentContextBlock }] : []),
        ...(pronoteBlock ? [{ role: 'user' as const, content: pronoteBlock }] : []),
        ...(attachedFilesBlock ? [{ role: 'user' as const, content: attachedFilesBlock }] : []),
        // Turn-specific pedagogical reinforcement injected as a trusted server-side
        // instruction, placed just before the student message so it takes precedence
        // (recency bias). Not wrapped in <student_message> — this is not student input.
        ...(params.intentReinforcement
          ? [{ role: 'user' as const, content: `[Consigne pour ce tour]\n${params.intentReinforcement}` }]
          : []),
        { role: 'user' as const, content: userContent },
      ];

      const promptCacheKey =
        `chat-${PROMPT_CACHE_VERSION}-${params.schoolLevel}-${params.userRole}`;

      // Route reasoning effort based on school level, STEM subject, and student intent.
      // This decides whether to use costly reasoning mode (high) or fast mode (none).
      const reasoningEffort = routeReasoningEffort({
        schoolLevel: params.schoolLevel,
        subject: params.subject,
        intent: params.classifiedIntent?.intent,
      });

      logger.info('Starting Mistral chat streaming', {
        userId: params.userId,
        sessionId: params.sessionId,
        subject: params.subject,
        schoolLevel: params.schoolLevel,
        historyLength: historyMessages.length,
        filesCount: params.files?.length ?? 0,
        reasoningEffort,
        operation: 'mistral-chat:agent-start',
      });

      let fullContent = '';
      const toolsUsed: string[] = [];
      let toolCallsCount = 0;
      let iteration = 0;
      const usageTotal = { promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedTokens: 0 };

      while (iteration < MAX_TOOL_ITERATIONS) {
        // Each iteration is a fresh stream from Mistral with the current
        // message list. Mistral does not have a stateful "session" — we resend
        // the running conversation.
        const stream = chatStream({
          model: MODEL,
          messages,
          temperature: TEMPERATURE,
          maxTokens: MAX_TOKENS,
          tools: agentTools,
          promptCacheKey,
          parallelToolCalls: false,
        });

        // Collect text + tool calls for this turn.
        let assistantText = '';
        const pendingCalls: MistralToolCall[] = [];
        const iterator = stream[Symbol.asyncIterator]();
        const firstStep = await withTimeout(
          iterator.next(),
          CHAT_STREAM_SETUP_TIMEOUT_MS,
          `mistral:stream-setup (iter ${iteration})`,
        );
        let step = firstStep;
        while (!step.done) {
          const chunk = step.value;
          if (chunk.type === 'text' && chunk.text) {
            assistantText += chunk.text;
            fullContent += chunk.text;

            // CCA Sprint 1 safety: detect system prompt leaks in the accumulated output.
            // Log at high severity but don't block the stream (silent failures are worse).
            const leakMarker = detectSystemPromptLeak(fullContent);
            if (leakMarker) {
              logger.error('System prompt leak detected in generated content', {
                _error: `Leaked marker: ${leakMarker}`,
                userId: params.userId,
                sessionId: params.sessionId,
                operation: 'mistral-chat:prompt-leak',
                severity: 'high' as const,
                leakMarker,
                contentLength: fullContent.length,
              });
            }

            yield {
              type: 'content' as const,
              id: messageId,
              model: MODEL,
              timestamp: Date.now(),
              delta: chunk.text,
              content: fullContent,
              role: 'assistant' as const,
            };
          } else if (chunk.type === 'tool_call' && chunk.toolCall) {
            pendingCalls.push({
              id: chunk.toolCall.id,
              type: 'function' as const,
              function: { name: chunk.toolCall.name, arguments: chunk.toolCall.arguments },
            });
          } else if (chunk.type === 'done') {
            if (chunk.usage) {
              // Chaque itération de la boucle agentique est un appel Mistral
              // distinct — on additionne les usages de toutes les itérations.
              usageTotal.promptTokens += chunk.usage.promptTokens;
              usageTotal.completionTokens += chunk.usage.completionTokens;
              usageTotal.totalTokens += chunk.usage.totalTokens;
              usageTotal.cachedTokens += chunk.usage.cachedTokens;
            } else {
              // Un stream sans usage redeviendrait un quota silencieusement
              // mort (cause du bug d'origine) — rendre le trou observable.
              logger.warn('Mistral stream completed without usage metadata', {
                userId: params.userId,
                sessionId: params.sessionId,
                iteration,
                operation: 'mistral-chat:missing-usage',
              });
            }
          }

          step = await withTimeout(
            iterator.next(),
            CHAT_STREAM_CHUNK_TIMEOUT_MS,
            `mistral:stream-chunk (iter ${iteration})`,
          );
        }

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
          model: MODEL,
          timestamp: Date.now(),
          status: pendingCalls.map((c) => getToolStatusLabel(c.function.name)).join(' · '),
        };

        // Add the assistant turn (text + tool_calls) to history then execute.
        messages.push({
          role: 'assistant',
          content: assistantText,
          toolCalls: pendingCalls,
        });

        const results = await Promise.all(
          pendingCalls.map((call) => {
            let args: Record<string, unknown> = {};
            try {
              args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
            } catch (err) {
              logger.warn('Tool call arguments JSON parse failed', {
                operation: 'mistral-chat:tool-args',
                toolName: call.function.name,
                _error: err instanceof Error ? err.message : String(err),
              });
            }
            return executeTool(call.function.name, args, {
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
              model: MODEL,
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

        // Feed every tool result back as a `tool` message keyed by call id.
        for (let i = 0; i < pendingCalls.length; i++) {
          const call = pendingCalls[i];
          if (!call) continue;
          const result = results[i] ?? {};
          // The curriculum corpus is third-party data — fence its text so a
          // poisoned chunk cannot be read as an instruction. Other tool results
          // are server-owned and stay as plain JSON.
          const content =
            call.function.name === 'search_educational_content'
              ? wrapCurriculumToolResult(result)
              : JSON.stringify(result);
          messages.push({
            role: 'tool',
            content,
            toolCallId: call.id,
            name: call.function.name,
          });
        }

        iteration++;
      }

      yield {
        type: 'done' as const,
        id: messageId,
        model: MODEL,
        timestamp: Date.now(),
        finishReason: 'stop' as const,
        usage: usageTotal,
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
        toolCallsCount,
        toolsUsed,
        iterations: iteration,
        durationMs: Date.now() - startTime,
        operation: 'mistral-chat:agent-complete',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      const isRateLimit =
        errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate limit');
      const isApiKey =
        errorMessage.toLowerCase().includes('api key') || errorMessage.includes('401');
      const isQuota = errorMessage.toLowerCase().includes('quota');
      const isTimeout =
        errorMessage.includes('timed out') || errorMessage.includes('TimeoutError');

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

      if (isRateLimit) {
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
        model: MODEL,
        timestamp: Date.now(),
        error: { message: userMessage, code: errorCode },
      };
    }
  }
}

export const mistralChatService = new MistralChatService();
