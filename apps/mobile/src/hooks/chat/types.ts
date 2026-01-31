/**
 * Chat Types
 *
 * Type definitions for the useChat hook.
 * Aligned with backend apps/server/src/routes/api.routes.ts
 */

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
  geminiFileId?: string;
  mimeType?: string;
  fileSizeBytes?: number;
}

/** File attachment for pending uploads (client-side) */
export interface ChatFileAttachment {
  fileId: string;
  fileName: string;
  mimeType: string;
  preview?: string;
}

/** Backend SSE stream chunk (from gemini-chat.service.ts GeminiStreamChunk) */
export interface StreamChunk {
  type: 'content' | 'done' | 'error';
  id: string;
  model?: string;
  timestamp?: number;
  delta?: string;
  content?: string;
  role?: 'assistant';
  finishReason?: 'stop' | 'length' | 'error';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: {
    sessionId?: string;
    usedRAG?: boolean;
  };
  error?: {
    message: string;
    code?: string;
  };
}

export interface UseChatOptions {
  initialSessionId?: string | null;
  subject: string;
}

export interface UseChatReturn {
  messages: ChatMessage[];
  pendingAttachments: ChatFileAttachment[];
  currentSessionId: string | null;
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  addAttachment: (attachment: ChatFileAttachment) => void;
  removeAttachment: (fileId: string) => void;
  clearPendingAttachments: () => void;
  resetSession: () => Promise<string | null>;
  stop: () => void;
}
