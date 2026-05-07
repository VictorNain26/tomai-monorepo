/**
 * Mistral agent loop — extracted from `mistral-chat.service.ts` (constitution
 * 400-line cap). Drives up to `MAX_TOOL_ITERATIONS` rounds of provider
 * streaming, accumulates tool-call deltas, dispatches tools sequentially
 * (`parallelToolCalls: false`), and yields provider-agnostic `ChatStreamChunk`
 * events. Behaviour is bit-for-bit identical to the prior inline impl:
 * timeouts, guardrails, reasoning routing, the HITL flashcard gate on
 * "solve-this-for-me" turns, the system-prompt leak detector, and the
 * `pendingCalls.length === 0` termination condition are all preserved.
 *
 * The wrapper service owns system-prompt assembly + history + multimodal user
 * content, plus the top-level try/catch that classifies SDK errors into typed
 * `error` chunks (rate-limit, quota, guardrail block, timeout, …).
 */

import type { Mistral } from '@mistralai/mistralai';
import { appConfig } from '../../config/app.config.js';
import { studentChatGuardrails } from '../../lib/mistral-guardrails.js';
import { logger } from '../../lib/observability.js';
import { withTimeout } from '../../lib/retry.js';
import type { EducationLevelType } from '../../types/index.js';
import { agentTools } from './mistral-tool-declarations.js';
import { executeTool, isDeckCreatedResult } from './tool-executor.js';
import type { ChatStreamChunk } from './mistral-types.js';
import {
  MAX_TOOL_ITERATIONS,
  MISTRAL_STREAM_SETUP_TIMEOUT_MS,
  MISTRAL_STREAM_CHUNK_TIMEOUT_MS,
  getToolStatusLabel,
  detectSystemPromptLeak,
} from './mistral-helpers.js';

// Mistral SDK message shape (camelCase per the official TS client). Mirrors
// the local types in `mistral-chat.service.ts`; kept in this module so the
// agent loop stays self-contained.
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

export interface MistralMessage {
  role: MistralRole;
  content: MistralContent;
  toolCalls?: MistralToolCallShape[];
  toolCallId?: string;
  name?: string;
}

type MistralStreamMessages = Parameters<Mistral['chat']['stream']>[0]['messages'];
type MistralStreamTools = Parameters<Mistral['chat']['stream']>[0]['tools'];
type MistralReasoningEffort = NonNullable<
  Parameters<Mistral['chat']['stream']>[0]['reasoningEffort']
>;

export interface RunAgentLoopParams {
  /** Mistral SDK client (already configured with auth + base URL). */
  client: Mistral;
  /** Provider model id, e.g. `mistral-small-latest`. */
  model: string;
  /** Mutable conversation array — system + history + user + tool turns. */
  messages: MistralMessage[];
  /** Stable id propagated on every emitted chunk. */
  messageId: string;
  /** Per-turn reasoning effort routed by `routeReasoningEffort`. */
  reasoningEffort: MistralReasoningEffort;
  /** Classifier intent — drives the HITL flashcard gate (CCA D1 §6c). */
  classifiedIntent?: { intent: string; confidence: 'low' | 'medium' | 'high' } | null;
  userId: string;
  sessionId: string;
  schoolLevel: EducationLevelType;
  userRole: 'student' | 'parent';
}

export interface AgentLoopOutcome {
  fullContent: string;
  promptTokens: number;
  completionTokens: number;
  toolsUsed: string[];
  toolCallsCount: number;
  iterations: number;
  /**
   * `true` when the loop short-circuited via the prompt-leak detector. The
   * caller has already received the `safety_block` error chunk and must NOT
   * emit a `done` chunk on top of it.
   */
  aborted: boolean;
}

interface AgentLoopState {
  fullContent: string;
  promptTokens: number;
  completionTokens: number;
  toolsUsed: string[];
  toolCallsCount: number;
  iteration: number;
}

/**
 * Apply the deterministic HITL gate: when the classifier flags a
 * "solve-this-for-me" intent with non-low confidence, strip
 * `generate_flashcards` from the offered tool set so the model cannot bypass
 * the soft prompt-level reinforcement by generating a deck containing the
 * answer.
 */
function selectOfferedTools(
  classifiedIntent: RunAgentLoopParams['classifiedIntent'],
  userId: string,
  sessionId: string,
): typeof agentTools {
  const isHardSolveIntent =
    classifiedIntent?.intent === 'solve-this-for-me' && classifiedIntent.confidence !== 'low';
  if (!isHardSolveIntent) return agentTools;

  logger.info('HITL gate: dropping generate_flashcards for solve-intent', {
    userId,
    sessionId,
    confidence: classifiedIntent?.confidence,
    operation: 'mistral-chat:hitl-gate',
  });
  return agentTools.filter((t) => t.function.name !== 'generate_flashcards');
}

/** Coalesce a tool-call delta into the per-iteration accumulator. */
function accumulateToolCallDelta(
  accum: Map<number, MistralToolCallShape>,
  idx: number,
  tc: { id?: string | null; function?: { name?: string | null; arguments?: unknown } },
): void {
  const rawArgs = tc.function?.arguments;
  const argsStr =
    typeof rawArgs === 'string' ? rawArgs : rawArgs ? JSON.stringify(rawArgs) : '';
  const existing = accum.get(idx);
  if (existing) {
    if (argsStr.length > 0) existing.function.arguments += argsStr;
    return;
  }
  accum.set(idx, {
    id: tc.id ?? `call_${Date.now()}_${idx}`,
    type: 'function',
    function: {
      name: tc.function?.name ?? '',
      arguments: argsStr,
    },
  });
}

/**
 * Run the streaming + tool-use loop. Yields provider-agnostic chunks
 * (`content`, `status`, `deck_created`, `error`); the caller is responsible
 * for emitting the terminal `done` chunk using the returned `AgentLoopOutcome`.
 *
 * The function does not catch SDK errors — exceptions bubble up so the wrapper
 * service can classify them (rate-limit, quota, guardrail block, timeout) and
 * emit the right `error` chunk code.
 */
export async function* runAgentLoop(
  params: RunAgentLoopParams,
): AsyncGenerator<ChatStreamChunk, AgentLoopOutcome> {
  const { client, model, messages, messageId, reasoningEffort, userId, sessionId } = params;

  const offeredTools = selectOfferedTools(params.classifiedIntent, userId, sessionId);

  const state: AgentLoopState = {
    fullContent: '',
    promptTokens: 0,
    completionTokens: 0,
    toolsUsed: [],
    toolCallsCount: 0,
    iteration: 0,
  };

  while (state.iteration < MAX_TOOL_ITERATIONS) {
    const stream = await withTimeout(
      client.chat.stream({
        model,
        messages: messages as MistralStreamMessages,
        tools: offeredTools as MistralStreamTools,
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
      `mistral:stream-setup (iter ${state.iteration})`,
    );

    // Per-iteration accumulator. Mistral streams tool calls as deltas
    // (id + name on first chunk, arguments built up across subsequent
    // chunks), so we coalesce by index before dispatching.
    const toolCallAccum = new Map<number, MistralToolCallShape>();
    const iterator = stream[Symbol.asyncIterator]();

    while (true) {
      const step = await withTimeout(
        iterator.next(),
        MISTRAL_STREAM_CHUNK_TIMEOUT_MS,
        `mistral:stream-chunk (iter ${state.iteration})`,
      );
      if (step.done) break;
      const event = step.value;
      const data = event.data;
      const choice = data?.choices?.[0];
      if (!choice) continue;

      const deltaContent = choice.delta?.content;
      if (typeof deltaContent === 'string' && deltaContent.length > 0) {
        state.fullContent += deltaContent;
        // Layer-3 prompt-injection defense: catch a leak of the system
        // prompt structural tags before it reaches the student. We
        // surface a generic safety_block error and break out of the
        // stream — same UX as a guardrail trip — rather than silently
        // letting the leaked content render. High-severity log so
        // monitoring catches the (rare) hit and we can audit prompts.
        const leak = detectSystemPromptLeak(state.fullContent);
        if (leak) {
          logger.error('System prompt leak detected in stream output', {
            _error: `Leaked marker: ${leak}`,
            userId,
            sessionId,
            contentLength: state.fullContent.length,
            operation: 'mistral-chat:prompt-leak',
            severity: 'high' as const,
          });
          yield {
            type: 'error' as const,
            id: messageId,
            model,
            timestamp: Date.now(),
            error: {
              message:
                "Je ne peux pas répondre à ce message. Reformule en restant sur ton travail scolaire.",
              code: 'safety_block',
            },
          };
          return {
            fullContent: state.fullContent,
            promptTokens: state.promptTokens,
            completionTokens: state.completionTokens,
            toolsUsed: state.toolsUsed,
            toolCallsCount: state.toolCallsCount,
            iterations: state.iteration,
            aborted: true,
          };
        }
        yield {
          type: 'content' as const,
          id: messageId,
          model,
          timestamp: Date.now(),
          delta: deltaContent,
          content: state.fullContent,
          role: 'assistant' as const,
        };
      }

      const deltaToolCalls = choice.delta?.toolCalls;
      if (deltaToolCalls && deltaToolCalls.length > 0) {
        for (let i = 0; i < deltaToolCalls.length; i += 1) {
          const tc = deltaToolCalls[i];
          if (!tc) continue;
          accumulateToolCallDelta(toolCallAccum, i, tc);
        }
      }

      if (data?.usage) {
        state.promptTokens = data.usage.promptTokens ?? state.promptTokens;
        state.completionTokens = data.usage.completionTokens ?? state.completionTokens;
      }
    }

    const pendingCalls = Array.from(toolCallAccum.values()).filter(
      (tc) => tc.function.name.length > 0,
    );

    if (pendingCalls.length === 0) break;

    state.toolCallsCount += pendingCalls.length;
    for (const call of pendingCalls) {
      if (!state.toolsUsed.includes(call.function.name)) {
        state.toolsUsed.push(call.function.name);
      }
    }

    logger.info('Agent tool calls', {
      userId,
      sessionId,
      iteration: state.iteration,
      toolNames: pendingCalls.map((c) => c.function.name),
      operation: 'mistral-chat:tool-calls',
    });

    yield {
      type: 'status' as const,
      id: messageId,
      model,
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
          model,
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

    state.iteration += 1;
  }

  return {
    fullContent: state.fullContent,
    promptTokens: state.promptTokens,
    completionTokens: state.completionTokens,
    toolsUsed: state.toolsUsed,
    toolCallsCount: state.toolCallsCount,
    iterations: state.iteration,
    aborted: false,
  };
}
