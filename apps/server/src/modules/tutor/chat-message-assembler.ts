import {
  assistantModelMessageSchema,
  pruneMessages,
  toolModelMessageSchema,
  type AssistantModelMessage,
  type ModelMessage,
  type ToolModelMessage,
  type UserContent,
} from 'ai';
import { z } from 'zod';
import { stripPromptTags, wrapUserMessage } from './mistral-helpers.js';

/** What `streamText` returns as `responseMessages`: the assistant's messages and the tool results. */
export type ResponseMessage = AssistantModelMessage | ToolModelMessage;

/** One past message of the window. */
export interface HistoryTurn {
  role: 'user' | 'assistant';
  /** What the student saw, or wrote. */
  content: string;
  timestamp: string;
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
  /** The exercise in progress, stable while it lasts: opening the window, it stays in the cached prefix. */
  exerciseBlock?: string | null | undefined;
  /** The texts of the session's files, in the order they were attached: they open the window too. */
  attachedFilesBlock?: string | null | undefined;
  /** Résumé DÉJÀ tronqué au budget (ou null/undefined si aucun). */
  conversationSummary?: string | null | undefined;
  history: readonly HistoryTurn[];
  subjectBlock?: string | null | undefined;
  turnInstruction?: string | null | undefined;
  inputMode?: string | undefined;
  studentText: string;
}

const VOICE_MARKER = "[VOCAL] Ce tour a été dicté à l'oral — réponds en style parlé, sans markdown.";

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
        content: typeof last.content === 'string' && typeof message.content === 'string'
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
 * Assemble le prompt d'un tour pour `streamText` : le prompt système, l'historique rejoué, puis
 * un seul message `user`, les rôles alternant comme le veut Mistral
 * (https://docs.mistral.ai/studio/conversations/chat-completion/prompting).
 *
 * - L'assistant se rejoue tel que le modèle l'a produit, appels d'outils compris ; un message
 *   ancien, sans réponse gardée, en texte. Seul le dernier message de la fenêtre garde son
 *   raisonnement (`pruneMessages`) : Mistral dit qu'en retirer dégrade le modèle
 *   (https://docs.mistral.ai/studio/conversations/reasoning), mais rejouer tous les
 *   raisonnements ferait payer chaque tour de la séance pour des traces de plusieurs milliers
 *   de tokens.
 * - Ce qui change d'un tour à l'autre (matière, contexte de l'élève, consigne, marqueur vocal)
 *   va dans le message du tour, avant le texte de l'élève : placé plus tôt, il casserait le
 *   cache de l'historique.
 * - L'exercice en cours, les fichiers de la séance puis le résumé ouvrent la fenêtre : ils ne
 *   changent qu'avec un nouvel exercice, un nouveau fichier ou une relance du résumé.
 */
export function assembleChatPrompt(parts: ChatTurnParts): { system: string; messages: ModelMessage[] } {
  const past = pruneMessages({
    messages: parts.history.flatMap((turn): ModelMessage[] => (turn.role === 'user'
      ? [{ role: 'user', content: wrapUserMessage(turn.content) }]
      : turn.modelMessages ?? [{ role: 'assistant', content: turn.content }])),
    reasoning: 'before-last-message',
    toolCalls: 'none',
    emptyMessages: 'remove',
  });
  // Untrusted text, the statement from the student included, never sits in the system prompt.
  const opening: ModelMessage[] = [
    ...(parts.exerciseBlock ? [{ role: 'user' as const, content: parts.exerciseBlock }] : []),
    ...(parts.attachedFilesBlock ? [{ role: 'user' as const, content: parts.attachedFilesBlock }] : []),
    ...(parts.conversationSummary
      ? [{ role: 'user' as const, content: `<conversation_summary>\n${stripPromptTags(parts.conversationSummary)}\n</conversation_summary>` }]
      : []),
  ];

  const text = [
    parts.subjectBlock,
    parts.turnInstruction,
    parts.inputMode === 'voice' ? VOICE_MARKER : null,
    wrapUserMessage(parts.studentText),
  ].filter((block): block is string => Boolean(block)).join('\n\n');
  return { system: parts.systemPrompt, messages: alternate([...opening, ...past, { role: 'user', content: text }]) };
}
