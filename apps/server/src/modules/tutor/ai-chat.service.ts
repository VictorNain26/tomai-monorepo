/**
 * AiChatService — chat streaming on Vercel AI SDK `streamText`.
 *
 * Runs the agentic loop (stream, collect tool calls, execute them, push
 * results back, loop) via `streamText`'s built-in tool loop. This service is
 * intentionally thin: assembling the prompt and configuring the call is all
 * it does — no parsing, no manual iteration.
 *
 * Prompt cache
 *   `promptCacheKey` = the chat session id, as Mistral recommends for
 *   multi-turn conversations: each turn resends the same prefix (system
 *   prompt + history), so turn N+1 reads turn N's prefix from cache.
 */

import {
  streamText,
  isStepCount,
  type ToolSet,
  type LanguageModel,
} from 'ai';
import { mistralProvider } from '../../platform/ai/provider.js';
import type { MistralLanguageModelChatOptions } from '@ai-sdk/mistral';
import { routeReasoningEffort } from './mistral-reasoning.js';
import { logger } from '../../platform/observability/logger.js';
import { buildSystemPrompt, generateSubjectBlock } from './prompts/index.js';
import { levelLabel } from '../../lib/education-levels.js';
import type { SubjectFamily } from '../../lib/subjects.js';
import { optimizeConversationHistory } from './conversation-optimizer.js';
import { assembleChatPrompt, type HistoryTurn } from './chat-message-assembler.js';
import {
  wrapAttachedFiles,
  MAX_TOOL_ITERATIONS,
} from './mistral-helpers.js';
import { calculateBudget, truncateToTokenBudget } from './token-budget.service.js';
import { env } from '../../platform/config/env.js';
import type { TurnUsage } from './turn-usage.js';
import type { TurnAnalysis } from './turn-analysis.service.js';
import { exerciseBlock, type ExerciseSheet } from './exercise-sheet.js';
import type { EducationLevelType } from '../../types/index.js';
import type { AttachedFileForPrompt } from '../documents/index.js';

/** Bump whenever content under modules/tutor/prompts/** or shared/pedagogy/** changes. */
const PROMPT_VERSION = '2026-10-06';

/** @public — reachable only via the typed client's inferred route return types (apps/server build:types), not a direct import; knip false positive. */
export interface StreamGenerationParams {
  userId: string;
  content: string;
  subject?: SubjectFamily | undefined;
  schoolLevel: EducationLevelType;
  firstName?: string | undefined;
  sessionId: string;
  conversationSummary?: string | null | undefined;
  /**
   * The texts read from the session's files, in the order they were attached: fenced
   * `<attached_file>` blocks that open the window, never inside the student message.
   */
  attachedFiles?: AttachedFileForPrompt[] | undefined;
  /**
   * Turn-specific reinforcement block derived from the turn analysis, in
   * the turn's user message (e.g. on "solve this for me" requests).
   */
  turnInstruction?: string | null | undefined;
  /** The turn's analysis: reasoning routing and the flashcards' approval. */
  turnAnalysis?: TurnAnalysis | undefined;
  /** The exercise in progress: its statement and notions open the window. */
  exerciseSheet?: ExerciseSheet | null | undefined;
  /** The turn instruction is the exercise's contract: the turn writes without reasoning. */
  contracted?: boolean | undefined;
  /**
   * Input channel declared by the user's gesture (mic vs keyboard), never
   * inferred by the model. When 'voice', a turn note is injected so Tom answers
   * in a spoken style. Defaults to 'text'.
   */
  inputMode?: 'text' | 'voice' | undefined;
  conversationHistory: HistoryTurn[];
}

export interface ChatStreamParams extends StreamGenerationParams {
  tools: ToolSet;
  /** Counts the turn's usage as it goes, so that a cut or failed turn is counted too. */
  usage?: TurnUsage | undefined;
  /**
   * Test seam: inject a mock `LanguageModel` (e.g. `MockLanguageModelV4`
   * from `ai/test`) instead of the real Mistral provider. Never set in
   * production call sites.
   */
  model?: LanguageModel | undefined;
}

function flashcardsApproval(analysis: TurnAnalysis | undefined) {
  if (analysis?.wantsFlashcards) return 'approved';
  return analysis?.error === undefined
    ? { type: 'denied' as const, reason: "L'élève n'a pas demandé de cartes : propose-les-lui, sans les créer." }
    : { type: 'denied' as const, reason: "Les cartes ne peuvent pas être créées à ce tour : si l'élève en a demandé, dis-le-lui et propose de réessayer." };
}

/**
 * Streams the assistant's response for one chat turn, running the agentic
 * tool loop internally (`stopWhen: isStepCount(MAX_TOOL_ITERATIONS)`).
 */
export function streamChat(params: ChatStreamParams) {
  const systemPrompt = buildSystemPrompt({
    level: params.schoolLevel,
    levelText: levelLabel(params.schoolLevel),
    firstName: params.firstName,
  });

  const conversationSummary = params.conversationSummary
    ? truncateToTokenBudget(params.conversationSummary, calculateBudget().summaryMaxTokens).text
    : params.conversationSummary;

  const { system, messages } = assembleChatPrompt({
    systemPrompt,
    exerciseBlock: params.exerciseSheet ? exerciseBlock(params.exerciseSheet) : null,
    conversationSummary,
    history: optimizeConversationHistory(params.conversationHistory, { conversationSummary: params.conversationSummary }),
    subjectBlock: generateSubjectBlock(params.subject),
    attachedFilesBlock: params.attachedFiles?.length ? wrapAttachedFiles(params.attachedFiles) : null,
    turnInstruction: params.turnInstruction,
    inputMode: params.inputMode,
    studentText: params.content,
  });

  params.usage?.prompt(`${system}\n${JSON.stringify(messages)}`);

  const reasoningEffort = routeReasoningEffort({
    schoolLevel: params.schoolLevel,
    subject: params.subject,
    analysis: params.turnAnalysis,
    contracted: params.contracted,
  });

  const model = params.model ?? mistralProvider()(env.MISTRAL_MODEL);

  logger.info('Chat stream started', {
    operation: 'chat-stream:start',
    sessionId: params.sessionId,
    model: env.MISTRAL_MODEL,
    promptVersion: PROMPT_VERSION,
    reasoningEffort,
  });

  return streamText({
    model,
    instructions: system,
    messages,
    tools: params.tools,
    // Cards are made when the student asks for them or accepts them, as the turn analysis read
    // it; denied, the call returns to the model with the reason.
    toolApproval: { generate_flashcards: flashcardsApproval(params.turnAnalysis) },
    prepareStep: ({ steps, stepNumber }) => {
      if (!('generate_flashcards' in params.tools)) return undefined;
      // Asked or accepted: the code makes the call, the model does not decide it (S4, 2026-10-05,
      // Small 4 refused confirmed cards on a rule no instruction gives).
      if (params.turnAnalysis?.wantsFlashcards) {
        return stepNumber === 0 ? { toolChoice: { type: 'tool', toolName: 'generate_flashcards' } } : undefined;
      }
      // Denial holds for the whole turn: a model that calls again would only spend steps.
      return steps.some((step) => step.toolCalls.some((call) => call.toolName === 'generate_flashcards'))
        ? { activeTools: Object.keys(params.tools).filter((name) => name !== 'generate_flashcards') }
        : undefined;
    },
    stopWhen: isStepCount(MAX_TOOL_ITERATIONS),
    temperature: env.MISTRAL_TEMPERATURE,
    // No output cap on a reasoning turn: the thinking counts in completion_tokens and a cap
    // would cut the answer after it; the stream timeout bounds the turn.
    ...(reasoningEffort === 'high' ? {} : { maxOutputTokens: env.MISTRAL_MAX_TOKENS }),
    maxRetries: env.MISTRAL_RETRY_ATTEMPTS,
    providerOptions: {
      mistral: {
        parallelToolCalls: false,
        reasoningEffort,
        promptCacheKey: params.sessionId,
      } satisfies MistralLanguageModelChatOptions,
    },
    telemetry: { functionId: 'chat-stream', recordInputs: false, recordOutputs: false },
    timeout: env.CHAT_STREAM_TIMEOUT_MS,
    onLanguageModelCallStart: () => { params.usage?.callStarted(); },
    onChunk: ({ chunk }) => {
      if (chunk.type === 'text-delta' || chunk.type === 'reasoning-delta') params.usage?.delta(chunk.text);
    },
    onLanguageModelCallEnd: ({ usage }) => { params.usage?.callEnded(usage); },
    onError: ({ error }) => {
      logger.error('Chat stream failed', { operation: 'chat-stream:error', sessionId: params.sessionId, err: error, severity: 'high' as const });
    },
  });
}
