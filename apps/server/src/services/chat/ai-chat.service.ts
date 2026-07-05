/**
 * AiChatService — chat streaming on Vercel AI SDK `streamText`.
 *
 * Replaces the manual agentic loop in `mistral-chat.service.ts` (lines
 * 200-379: fetch a stream, collect tool calls, execute them, push results
 * back, loop) with `streamText`'s built-in tool loop. This service is
 * intentionally thin: assembling the prompt and configuring the call is all
 * it does — no parsing, no manual iteration.
 *
 * Prompt cache
 *   Same `prompt_cache_key` scheme as the legacy service: one key shared by
 *   every student so the stable system-prompt prefix gets Mistral's 90 %
 *   cached-tokens discount. `PROMPT_CACHE_VERSION` MUST stay in sync with the
 *   constant of the same name in `mistral-chat.service.ts` until that service
 *   is retired.
 */

import {
  streamText,
  isStepCount,
  type ToolSet,
  type ModelMessage,
  type LanguageModel,
  type TextPart,
  type FilePart,
} from 'ai';
import { mistralProvider } from '../../lib/ai/provider.js';
import { routeReasoningEffort } from '../../lib/ai/mistral-reasoning.js';
import { buildSystemPrompt } from '../../config/prompts/index.js';
import { getLevelText } from '../../config/education/index.js';
import { optimizeConversationHistory } from '../../utils/conversation/index.js';
import { assembleChatMessages } from './chat-message-assembler.js';
import {
  wrapUserMessage,
  wrapPronoteData,
  wrapStudentContext,
  wrapAttachedFiles,
  MAX_TOOL_ITERATIONS,
} from './mistral-helpers.js';
import { calculateBudget, truncateToTokenBudget } from './token-budget.service.js';
import { env } from '../../config/env.js';
import type { MistralMessage, MistralContentPart } from '../../lib/ai/mistral-client.js';
import type { StreamGenerationParams, AttachedFile } from './chat-streaming-types.js';

/** Bump whenever content under config/prompts/** or shared/pedagogy/** changes. */
const PROMPT_CACHE_VERSION = '2026-06-14-voicefmt';

export interface ChatStreamParams extends StreamGenerationParams {
  tools: ToolSet;
  /**
   * Test seam: inject a mock `LanguageModel` (e.g. `MockLanguageModelV4`
   * from `ai/test`) instead of the real Mistral provider. Never set in
   * production call sites.
   */
  model?: LanguageModel;
}

function buildSystemPromptForChat(params: {
  level: StreamGenerationParams['schoolLevel'];
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

function buildHistoryMessages(
  history: StreamGenerationParams['conversationHistory'],
  conversationSummary?: string | null,
): MistralMessage[] {
  if (!history || history.length === 0) return [];

  const optimized = optimizeConversationHistory(history, { conversationSummary });

  return optimized
    .filter(
      (msg): msg is typeof msg & { role: 'assistant' | 'user'; content: string } =>
        msg.role !== 'system' && msg.content !== null && msg.content !== undefined,
    )
    .map((msg): MistralMessage => {
      if (msg.role === 'assistant') {
        return { role: 'assistant', content: msg.content };
      }
      return { role: 'user', content: wrapUserMessage(msg.content) };
    });
}

function buildUserContent(content: string, files?: AttachedFile[]): string | MistralContentPart[] {
  const wrapped = wrapUserMessage(content);
  if (!files || files.length === 0) return wrapped;

  const imageParts = files
    .filter((f) => f.contentType === 'image' && f.base64)
    .map((f) => ({
      type: 'image_url' as const,
      imageUrl: { url: `data:${f.mimeType};base64,${f.base64}` },
    }));

  if (imageParts.length === 0) return wrapped;
  return [{ type: 'text' as const, text: wrapped }, ...imageParts];
}

function requireStringContent(content: unknown, role: 'system' | 'assistant'): string {
  if (typeof content !== 'string') {
    throw new Error(`Expected plain string content for "${role}" message in AI SDK conversion`);
  }
  return content;
}

function toUserPart(part: MistralContentPart): TextPart | FilePart {
  if (part.type === 'text') return { type: 'text', text: part.text };
  const url = typeof part.imageUrl === 'string' ? part.imageUrl : part.imageUrl.url;
  return { type: 'file', mediaType: 'image', data: new URL(url) };
}

/**
 * Converts the vendor-neutral `MistralMessage[]` assembly into AI SDK
 * `{ system, messages }`. Split out because `streamText` rejects a `system`
 * role inside `messages` by default (`allowSystemInMessages: false`) — the
 * system prompt must travel through the dedicated `system` option instead.
 * `assembleChatMessages` always puts the system prompt first (see its own
 * doc comment), so this never silently drops a system message elsewhere in
 * the array.
 */
function toModelPrompt(messages: MistralMessage[]): { system: string; messages: ModelMessage[] } {
  const [first, ...rest] = messages;
  if (!first || first.role !== 'system') {
    throw new Error('Expected the first assembled message to carry the system prompt');
  }
  return {
    system: requireStringContent(first.content, 'system'),
    messages: rest.map(toModelMessage),
  };
}

function toModelMessage(message: MistralMessage): ModelMessage {
  if (message.role === 'assistant') {
    return { role: 'assistant', content: requireStringContent(message.content, 'assistant') };
  }
  if (message.role === 'user') {
    const content = message.content as string | MistralContentPart[];
    return {
      role: 'user',
      content: typeof content === 'string' ? content : content.map(toUserPart),
    };
  }
  // assembleChatMessages only ever emits system/user/assistant — a 'tool' or
  // second 'system' message would mean a caller bypassed the assembler.
  throw new Error(`Unsupported message role for AI SDK conversion: ${message.role}`);
}

/**
 * Streams the assistant's response for one chat turn, running the agentic
 * tool loop internally (`stopWhen: isStepCount(MAX_TOOL_ITERATIONS)`).
 */
export function streamChat(params: ChatStreamParams): ReturnType<typeof streamText> {
  const systemPrompt = buildSystemPromptForChat({
    level: params.schoolLevel,
    subject: params.subject,
    firstName: params.firstName,
  });

  const userContent = buildUserContent(params.content, params.files);
  const pronoteBlock = wrapPronoteData(params.pronoteContext);
  const studentContextBlock = wrapStudentContext(params.cognitiveProfileSummary, params.learningContext);
  const attachedFilesBlock = params.attachedFiles?.length
    ? wrapAttachedFiles(params.attachedFiles)
    : '';
  const historyMessages = buildHistoryMessages(params.conversationHistory, params.conversationSummary);

  const truncatedSummary = params.conversationSummary
    ? truncateToTokenBudget(params.conversationSummary, calculateBudget().summaryMaxTokens).text
    : params.conversationSummary;

  const { system, messages } = toModelPrompt(
    assembleChatMessages({
      systemPrompt,
      conversationSummary: truncatedSummary,
      historyMessages,
      studentContextBlock,
      pronoteBlock,
      attachedFilesBlock,
      intentReinforcement: params.intentReinforcement,
      inputMode: params.inputMode,
      userContent,
    }),
  );

  const reasoningEffort = routeReasoningEffort({
    schoolLevel: params.schoolLevel,
    subject: params.subject,
    intent: params.classifiedIntent?.intent,
  });

  const cacheKey = `chat-${PROMPT_CACHE_VERSION}`;
  const model = params.model ?? mistralProvider(cacheKey)(env.MISTRAL_MODEL);

  return streamText({
    model,
    system,
    messages,
    tools: params.tools,
    stopWhen: isStepCount(MAX_TOOL_ITERATIONS),
    temperature: env.MISTRAL_TEMPERATURE,
    maxOutputTokens: env.MISTRAL_MAX_TOKENS,
    providerOptions: {
      mistral: {
        parallelToolCalls: false,
        reasoningEffort,
      },
    },
    telemetry: {
      isEnabled: true,
      functionId: 'chat-stream',
    },
    abortSignal: AbortSignal.timeout(env.CHAT_STREAM_TIMEOUT_MS),
  });
}
