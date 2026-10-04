import { assistantModelMessageSchema, toolModelMessageSchema, type AssistantModelMessage, type FilePart, type ModelMessage, type TextPart, type ToolModelMessage } from 'ai';
import { z } from 'zod';
import { stripPromptTags, wrapUserMessage } from './mistral-helpers.js';

/** What `streamText` returns as `responseMessages`: the assistant's messages and the tool results. */
export type ResponseMessage = AssistantModelMessage | ToolModelMessage;

const storedResponseMessages = z.array(z.union([assistantModelMessageSchema, toolModelMessageSchema]));

/**
 * The response messages stored with an assistant message, validated since they go back to the
 * model as they are: `undefined` when there are none (an older message), `null` when the stored
 * value is unreadable.
 */
export function parseStoredResponseMessages(value: unknown): ResponseMessage[] | null | undefined {
  if (value === null || value === undefined) return undefined;
  const parsed = storedResponseMessages.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** One past message of the window, as stored. */
interface HistoryTurn {
  role: 'user' | 'assistant';
  /** What the student saw, or wrote. */
  content: string;
  /** The assistant's response messages as the model produced them, reasoning and tool calls included. */
  modelMessages?: ResponseMessage[] | undefined;
}

export interface ChatTurnParts {
  systemPrompt: string;
  /** Résumé DÉJÀ tronqué au budget (ou null/undefined si aucun). */
  conversationSummary?: string | null | undefined;
  history: HistoryTurn[];
  subjectBlock?: string | null | undefined;
  studentContextBlock?: string | null | undefined;
  attachedFilesBlock?: string | null | undefined;
  intentReinforcement?: string | null | undefined;
  inputMode?: string | undefined;
  studentText: string;
  images?: FilePart[] | undefined;
}

const VOICE_MARKER = "[VOCAL] Ce tour a été dicté à l'oral — réponds en style parlé, sans markdown.";

function summaryBlock(summary: string): string {
  return `<conversation_summary>\n${stripPromptTags(summary)}\n</conversation_summary>`;
}

/**
 * The past messages: the student's text fenced, the assistant's response messages replayed as
 * the model produced them (Mistral: « always replay the full assistant message (including
 * `ThinkChunk`) », https://docs.mistral.ai/studio/conversations/reasoning), an older message
 * without them as its text.
 */
function historyMessages(history: readonly HistoryTurn[]): ModelMessage[] {
  return history.flatMap((turn): ModelMessage[] => {
    if (turn.role === 'user') return [{ role: 'user', content: wrapUserMessage(turn.content) }];
    return turn.modelMessages ?? [{ role: 'assistant', content: turn.content }];
  });
}

/**
 * Assemble le prompt d'un tour pour `streamText` : le prompt système, l'historique rejoué, puis
 * un seul message `user`, comme le veut l'alternance des rôles de Mistral
 * (https://docs.mistral.ai/studio/conversations/chat-completion/prompting). Ce qui change d'un
 * tour à l'autre (matière, contexte de l'élève, fichiers, consigne, marqueur vocal) va dans ce
 * message, avant le texte de l'élève : placé plus tôt, il casserait le cache de l'historique.
 * Le résumé rejoint le premier message de l'élève de la fenêtre, le précède quand elle s'ouvre
 * sur l'assistant, ou va dans le message courant quand elle est vide.
 */
export function assembleChatPrompt(parts: ChatTurnParts): { system: string; messages: ModelMessage[] } {
  const past = historyMessages(parts.history);
  const [first, ...rest] = past;
  const summary = parts.conversationSummary ? summaryBlock(parts.conversationSummary) : null;
  const firstText = first?.role === 'user' && typeof first.content === 'string' ? first.content : null;
  let window = past;
  if (summary !== null && firstText !== null) window = [{ role: 'user', content: `${summary}\n\n${firstText}` }, ...rest];
  // A window that opens on the assistant gets the summary before it, so that the roles alternate.
  else if (summary !== null && past.length > 0) window = [{ role: 'user', content: summary }, ...past];

  const text = [
    past.length === 0 ? summary : null,
    parts.subjectBlock,
    parts.studentContextBlock,
    parts.attachedFilesBlock,
    parts.intentReinforcement,
    parts.inputMode === 'voice' ? VOICE_MARKER : null,
    wrapUserMessage(parts.studentText),
  ].filter((block): block is string => Boolean(block)).join('\n\n');
  const images = parts.images ?? [];
  const content: string | (TextPart | FilePart)[] = images.length > 0 ? [{ type: 'text', text }, ...images] : text;

  return { system: parts.systemPrompt, messages: [...window, { role: 'user', content }] };
}
