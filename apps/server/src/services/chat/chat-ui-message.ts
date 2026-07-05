import type { UIMessage } from 'ai';
import type { TomChatTools } from './chat-tools.js';

/**
 * Payload for the `deck-created` transient data part, emitted when
 * `generate_flashcards` persists a new deck (mirrors the legacy
 * `ChatStreamChunk.deck` shape in `chat-streaming-types.ts`).
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
}

/** Tom's UIMessage shape: metadata + data parts + typed tool set. */
export type TomChatMessage = UIMessage<TomMetadata, TomDataParts, TomChatTools>;
