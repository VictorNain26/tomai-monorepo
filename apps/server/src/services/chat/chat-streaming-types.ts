import type { EducationLevelType } from '../../types/index.js';

/**
 * Chat streaming wire types — vendor-neutral. Renamed from `gemini-types.ts`
 * when the chat path moved to Mistral (Phase 2B). The shape covers Mistral's
 * SSE streaming response: text deltas, tool calls, final usage and metadata.
 */

export interface AttachedFile {
  /** Inline base64 payload for multimodal user messages (Mistral vision). */
  base64?: string;
  mimeType: string;
  contentType: 'image' | 'document';
}

export interface HistoricalFileRef {
  mimeType?: string;
}

export interface PronoteContext {
  homework?: Array<{ subject: string; description: string; dueDate: string; done: boolean }>;
  recentGrades?: Array<{ subject: string; value: number | null; outOf: number; date: string }>;
  todayTimetable?: Array<{ subject: string; startDate: string; endDate: string; canceled: boolean }>;
}

export interface StreamGenerationParams {
  userId: string;
  content: string;
  subject?: string;
  schoolLevel: EducationLevelType;
  firstName?: string;
  sessionId: string;
  cognitiveProfileSummary?: string | null;
  learningContext?: string | null;
  conversationSummary?: string | null;
  userRole: 'student' | 'parent';
  pronoteContext?: PronoteContext;
  files?: AttachedFile[];
  /**
   * Turn-specific reinforcement block injected by the intent classifier.
   * When non-null, prepended to the system prompt to force a stricter
   * socratic stance (e.g. on "solve this for me" requests).
   */
  intentReinforcement?: string | null;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    attachedFile?: HistoricalFileRef | null;
  }>;
}

export interface ChatStreamChunk {
  type: 'content' | 'done' | 'error' | 'status' | 'deck_created';
  id: string;
  model: string;
  timestamp: number;
  delta?: string;
  content?: string;
  role?: 'assistant';
  finishReason?: 'stop' | 'length' | 'error';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: {
    message: string;
    code?: string;
  };
  status?: string;
  deck?: {
    deckId: string;
    title: string;
    cardCount: number;
    subject: string;
  };
  metadata?: {
    sessionId: string;
    usedRAG: boolean;
    toolsUsed: string[];
    toolCallsCount: number;
  };
}
