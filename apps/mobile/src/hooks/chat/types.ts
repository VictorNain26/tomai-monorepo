/**
 * Chat Types
 *
 * Type definitions for the useChat hook. Server-facing shapes are derived from
 * the Eden contract (single source of truth); UI-only shapes are local.
 */

import { getTreaty, type ResponseData } from '@repo/api';

type ChatApi = ReturnType<typeof getTreaty>['api']['chat'];

/** Conversation list item — derived from `GET /api/chat/conversations`. */
export type Conversation = ResponseData<ChatApi['conversations']['get']>['conversations'][number];

/** Backend chat history message (GET /api/chat/session/:id/history) */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string; // ISO string from backend
  aiModel?: string | null;
  attachedFile?: AttachedFileInfo | null;
}

/** Backend attachedFile structure (from messages table JSONB) */
export interface AttachedFileInfo {
  fileName: string;
  fileId?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  /** Local image preview URI (client-side only, not persisted) */
  preview?: string;
}

/** File attachment for pending uploads (client-side) */
export interface ChatFileAttachment {
  fileId: string;
  fileName: string;
  mimeType: string;
  preview?: string;
}

/** Deck created during chat via generate_flashcards tool */
export interface CreatedDeck {
  deckId: string;
  title: string;
  cardCount: number;
  subject: string;
}

export interface UseChatOptions {
  initialSessionId?: string | null;
}

export interface UseChatReturn {
  messages: ChatMessage[];
  pendingAttachments: ChatFileAttachment[];
  createdDecks: CreatedDeck[];
  currentSessionId: string | null;
  isLoading: boolean;
  isStreaming: boolean;
  isOnline: boolean;
  streamStatus: string | null;
  error: string | null;
  sendMessage: (content: string) => void;
  retry: () => void;
  addAttachment: (attachment: ChatFileAttachment) => void;
  removeAttachment: (fileId: string) => void;
  clearPendingAttachments: () => void;
  clearCreatedDecks: () => void;
  resetSession: () => Promise<string | null>;
  stop: () => void;
}
