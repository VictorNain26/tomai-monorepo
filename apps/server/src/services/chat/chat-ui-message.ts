import type { UIMessage } from 'ai';
import type { TomChatTools } from './chat-tools.js';

/**
 * Payload for the `deck-created` transient data part, emitted when
 * `generate_flashcards` persists a new deck.
 */
export interface DeckCreatedData {
  deckId: string;
  title: string;
  cardCount: number;
  subject: string;
}

/** Data parts Tom can push into the UI message stream. */
export type TomDataParts = {
  'deck-created': DeckCreatedData;
};

/** Per-message metadata surfaced to the client (RAG usage, tools invoked). */
export interface TomMetadata {
  usedRAG?: boolean;
  toolsUsed?: string[];
  /**
   * Hint for the client: false when the answer holds a diagram/code/table
   * (not worth reading aloud). Boolean, not string.
   */
  speakable?: boolean;
}

/** Tom's UIMessage shape: metadata + data parts + typed tool set. */
export type TomChatMessage = UIMessage<TomMetadata, TomDataParts, TomChatTools>;

/**
 * Extracts the plain text content out of a `UIMessage.parts` array,
 * concatenating every `text` part in order. Used both for the incoming
 * client message (server is authoritative: only the last `UIMessage` is
 * sent, its text still needs sanitisation before hitting the model) and for
 * the outgoing `responseMessage` handed to `onFinish` (no `TextStreamPart`
 * equivalent survives past `streamText` — the UI message is the only
 * post-stream source of the final text).
 *
 * Defensive against `unknown` input: the wire payload is validated as
 * `t.Unknown()` (its shape is the AI SDK's, not ours to re-validate at the
 * HTTP boundary), so this never assumes a part actually looks like a
 * `TextUIPart`.
 */
export function extractTextFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return '';
  return parts
    .filter(
      (part): part is { type: 'text'; text: string } =>
        typeof part === 'object' &&
        part !== null &&
        (part as { type?: unknown }).type === 'text' &&
        typeof (part as { text?: unknown }).text === 'string',
    )
    .map(part => part.text)
    .join('');
}
