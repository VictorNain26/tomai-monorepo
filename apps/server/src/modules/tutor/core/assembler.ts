import { assistantModelMessageSchema, pruneMessages, toolModelMessageSchema, type ModelMessage, type UserContent } from 'ai';
import { z } from 'zod';
import type { ResponseMessage } from '../../../platform/ai/client';
import { stripPromptTags, wrapUserMessage } from './fences';

/** One past message of the window. */
export interface HistoryTurn {
  role: 'user' | 'assistant';
  /** What the student saw, or wrote. */
  content: string;
  /** The assistant's response messages as the model produced them; absent on older messages. */
  modelMessages?: ResponseMessage[] | undefined;
}

// Replayable: at least one message, and the last one the assistant's. A turn cut on a tool
// result would put `user` right after `tool`, which Mistral rejects.
const replayableMessages = z
  .array(z.union([assistantModelMessageSchema, toolModelMessageSchema]))
  .min(1)
  .refine((messages) => messages.at(-1)?.role === 'assistant');

/** The response messages of a turn when they can be replayed as they are, otherwise `undefined`. */
export function replayable(value: unknown): ResponseMessage[] | undefined {
  const parsed = replayableMessages.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export interface ChatTurnParts {
  systemPrompt: string;
  /** The student's first name, fenced: it opens the window, stable for the session. */
  studentBlock: string;
  /** The exercise in progress, stable while it lasts: opening the window, it stays in the cached prefix. */
  exerciseBlock?: string | null | undefined;
  /** The texts of the session's files, in the order they were attached: they open the window too. */
  attachedFilesBlock?: string | null | undefined;
  /** The summary of the messages out of the window. */
  conversationSummary?: string | null | undefined;
  history: readonly HistoryTurn[];
  subjectBlock?: string | null | undefined;
  turnInstruction?: string | null | undefined;
  inputMode?: string | undefined;
  studentText: string;
}

export const VOICE_MARKER = "[VOCAL] Ce tour a été dicté à l'oral — réponds en style parlé, sans markdown.";

function textParts(content: UserContent) {
  return typeof content === 'string' ? [{ type: 'text' as const, text: content }] : content;
}

/** Two user messages in a row become one, as Mistral's role flow wants (an orphan student message, the summary). */
function alternate(messages: readonly ModelMessage[]): ModelMessage[] {
  const out: ModelMessage[] = [];
  for (const message of messages) {
    const last = out.at(-1);
    if (last?.role === 'user' && message.role === 'user') {
      out[out.length - 1] = {
        role: 'user',
        content:
          typeof last.content === 'string' && typeof message.content === 'string'
            ? `${last.content}\n\n${message.content}`
            : [...textParts(last.content), ...textParts(message.content)],
      };
    } else {
      out.push(message);
    }
  }
  return out;
}

/**
 * The prompt of a turn: the system prompt, the history replayed, then one user message, the roles
 * alternating as Mistral wants (https://docs.mistral.ai/studio/conversations/chat-completion/prompting).
 *
 * - The tutor replays as the model produced it; an older message, without its response kept, as
 *   its text. Only the window's last message keeps its reasoning (`pruneMessages`): Mistral says
 *   removing it degrades the model (https://docs.mistral.ai/studio/conversations/reasoning), but
 *   replaying every reasoning would bill each turn for traces of thousands of tokens.
 * - What changes from one turn to the next (subject, instruction, voice marker) goes in the turn's
 *   message, before the student's text: earlier, it would break the cache of the history.
 * - The student's name, the exercise in progress, the session's files then the summary open the
 *   window: they change only with a new exercise, a new file or a new summary.
 */
export function assembleChatPrompt(parts: ChatTurnParts): { system: string; messages: ModelMessage[] } {
  const past = pruneMessages({
    messages: parts.history.flatMap((turn): ModelMessage[] =>
      turn.role === 'user'
        ? [{ role: 'user', content: wrapUserMessage(turn.content) }]
        : (turn.modelMessages ?? [{ role: 'assistant', content: turn.content }]),
    ),
    reasoning: 'before-last-message',
    toolCalls: 'none',
    emptyMessages: 'remove',
  });
  // Untrusted text, the statement from the student included, never sits in the system prompt.
  const opening: ModelMessage[] = [
    { role: 'user' as const, content: parts.studentBlock },
    ...(parts.exerciseBlock ? [{ role: 'user' as const, content: parts.exerciseBlock }] : []),
    ...(parts.attachedFilesBlock ? [{ role: 'user' as const, content: parts.attachedFilesBlock }] : []),
    ...(parts.conversationSummary
      ? [{ role: 'user' as const, content: `<conversation_summary>\n${stripPromptTags(parts.conversationSummary)}\n</conversation_summary>` }]
      : []),
  ];

  const text = [parts.subjectBlock, parts.turnInstruction, parts.inputMode === 'voice' ? VOICE_MARKER : null, wrapUserMessage(parts.studentText)]
    .filter((block): block is string => Boolean(block))
    .join('\n\n');
  return { system: parts.systemPrompt, messages: alternate([...opening, ...past, { role: 'user', content: text }]) };
}
