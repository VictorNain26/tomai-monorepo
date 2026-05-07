/**
 * Public types for the Mistral chat service.
 *
 * Provider-agnostic stream chunk shape — tool calls are absorbed inside the
 * agent loop and never surfaced to consumers (only `content`, `status`,
 * `deck_created`, `done`, `error` chunks reach the SSE client).
 */

import type { EducationLevelType } from '../../types/index.js';

export interface AttachedFile {
  /** Public URL of the file (Scaleway presigned, etc.) — used for vision. */
  fileUrl?: string;
  /** Base64 data URI body — used as fallback when no public URL exists. */
  base64?: string;
  mimeType: string;
  contentType: 'image' | 'document';
}

export interface HistoricalFileRef {
  fileUrl?: string;
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
  /**
   * Raw classifier intent + confidence. Used by the agent loop to apply
   * deterministic HITL gates (CCA D1 §6c) — e.g. drop `generate_flashcards`
   * from the offered tool set when the student asked for a complete answer.
   * The intentReinforcement string is the soft (prompt-level) version of
   * the same signal; this field is the hard one.
   */
  classifiedIntent?: { intent: string; confidence: 'low' | 'medium' | 'high' } | null;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    attachedFile?: HistoricalFileRef | null;
  }>;
}

export type ChatStreamChunkType =
  | 'content'
  | 'done'
  | 'error'
  | 'status'
  | 'deck_created';

export interface ChatStreamChunk {
  type: ChatStreamChunkType;
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
