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
  type FilePart,
} from 'ai';
import { mistralProvider } from '../../platform/ai/provider.js';
import type { MistralLanguageModelChatOptions } from '@ai-sdk/mistral';
import { routeReasoningEffort } from './mistral-reasoning.js';
import { logger } from '../../platform/observability/logger.js';
import { buildSystemPrompt, generateSubjectBlock } from './prompts/index.js';
import { getLevelText } from '../../config/education/index.js';
import { optimizeConversationHistory } from './conversation-optimizer.js';
import { assembleChatPrompt, type ResponseMessage } from './chat-message-assembler.js';
import {
  wrapStudentContext,
  wrapAttachedFiles,
  MAX_TOOL_ITERATIONS,
} from './mistral-helpers.js';
import { calculateBudget, truncateToTokenBudget } from './token-budget.service.js';
import { env } from '../../platform/config/env.js';
import type { EducationLevelType } from '../../types/index.js';
import type { AttachedFileForPrompt } from '../documents/index.js';

/** Bump whenever content under modules/tutor/prompts/** or shared/pedagogy/** changes. */
const PROMPT_VERSION = '2026-10-04';

export interface AttachedFile {
  /** Inline base64 payload for multimodal user messages (Mistral vision). */
  base64?: string | undefined;
  mimeType: string;
  contentType: 'image' | 'document';
}

interface HistoricalFileRef {
  mimeType?: string;
}

interface ClassifiedIntent {
  intent: string;
  confidence: 'low' | 'medium' | 'high';
  error?: string;
}

/** @public — reachable only via the typed client's inferred route return types (apps/server build:types), not a direct import; knip false positive. */
export interface StreamGenerationParams {
  userId: string;
  content: string;
  subject?: string | undefined;
  schoolLevel: EducationLevelType;
  firstName?: string | undefined;
  sessionId: string;
  cognitiveProfileSummary?: string | null | undefined;
  learningContext?: string | null | undefined;
  conversationSummary?: string | null | undefined;
  files?: AttachedFile[] | undefined;
  /**
   * Attached-document analyses (OCR of the student's files). Injected as a
   * SEPARATE `<attached_file>` fenced block, never concatenated into the
   * student message — otherwise stripPromptTags would remove the fence.
   */
  attachedFiles?: AttachedFileForPrompt[] | undefined;
  /**
   * Turn-specific reinforcement block injected by the intent classifier, in
   * the turn's user message (e.g. on "solve this for me" requests).
   */
  intentReinforcement?: string | null | undefined;
  /** Classified intent for reasoning effort routing. */
  classifiedIntent?: ClassifiedIntent | undefined;
  /**
   * Input channel declared by the user's gesture (mic vs keyboard), never
   * inferred by the model. When 'voice', a turn note is injected so Tom answers
   * in a spoken style. Defaults to 'text'.
   */
  inputMode?: 'text' | 'voice' | undefined;
  conversationHistory: {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    /** The assistant's response messages as the model produced them; absent on older messages. */
    modelMessages?: ResponseMessage[] | undefined;
    attachedFile?: HistoricalFileRef | null;
  }[];
}

export interface ChatStreamParams extends StreamGenerationParams {
  tools: ToolSet;
  /**
   * Test seam: inject a mock `LanguageModel` (e.g. `MockLanguageModelV4`
   * from `ai/test`) instead of the real Mistral provider. Never set in
   * production call sites.
   */
  model?: LanguageModel | undefined;
}

function imageParts(files?: AttachedFile[]): FilePart[] {
  return (files ?? [])
    .filter((f): f is AttachedFile & { base64: string } => f.contentType === 'image' && f.base64 !== undefined && f.base64 !== '')
    .map((f) => ({ type: 'file', mediaType: 'image', data: new URL(`data:${f.mimeType};base64,${f.base64}`) }));
}

/**
 * Streams the assistant's response for one chat turn, running the agentic
 * tool loop internally (`stopWhen: isStepCount(MAX_TOOL_ITERATIONS)`).
 */
export function streamChat(params: ChatStreamParams) {
  const systemPrompt = buildSystemPrompt({
    level: params.schoolLevel,
    levelText: getLevelText(params.schoolLevel),
    firstName: params.firstName,
  });

  const conversationSummary = params.conversationSummary
    ? truncateToTokenBudget(params.conversationSummary, calculateBudget().summaryMaxTokens).text
    : params.conversationSummary;

  const { system, messages } = assembleChatPrompt({
    systemPrompt,
    conversationSummary,
    history: optimizeConversationHistory(params.conversationHistory, { conversationSummary: params.conversationSummary }),
    subjectBlock: generateSubjectBlock(params.subject),
    studentContextBlock: wrapStudentContext(params.cognitiveProfileSummary, params.learningContext),
    attachedFilesBlock: params.attachedFiles?.length ? wrapAttachedFiles(params.attachedFiles) : null,
    intentReinforcement: params.intentReinforcement,
    inputMode: params.inputMode,
    studentText: params.content,
    images: imageParts(params.files),
  });

  const reasoningEffort = routeReasoningEffort({
    schoolLevel: params.schoolLevel,
    subject: params.subject,
    intent: params.classifiedIntent?.intent,
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
    system,
    messages,
    tools: params.tools,
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
    abortSignal: AbortSignal.timeout(env.CHAT_STREAM_TIMEOUT_MS),
  });
}
