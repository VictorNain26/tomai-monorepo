import type { EducationLevelType } from '../../types/index.js';
import type { AttachedFileForPrompt } from './file-context-types.js';

/**
 * Chat streaming wire types — vendor-neutral. The shape covers Mistral's
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

export interface ClassifiedIntent {
  intent: string;
  confidence: 'low' | 'medium' | 'high';
  error?: string;
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
   * Attached-document analyses (OCR of the student's files). Injected as a
   * SEPARATE `<attached_file>` fenced block, never concatenated into the
   * student message — otherwise stripPromptTags would remove the fence.
   */
  attachedFiles?: AttachedFileForPrompt[];
  /**
   * Turn-specific reinforcement block injected by the intent classifier.
   * When non-null, prepended to the system prompt to force a stricter
   * socratic stance (e.g. on "solve this for me" requests).
   */
  intentReinforcement?: string | null;
  /** Classified intent for reasoning effort routing (CCA Sprint 1). */
  classifiedIntent?: ClassifiedIntent;
  /**
   * Input channel declared by the user's gesture (mic vs keyboard), never
   * inferred by the model. When 'voice', a turn note is injected so Tom answers
   * in a spoken style. Defaults to 'text'.
   */
  inputMode?: 'text' | 'voice';
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
  /** Forme synchronisée avec ChatStreamChunk.usage de mistral-client.ts. */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cachedTokens: number;
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
    /**
     * Hint for the client: false when the answer holds a Mermaid diagram, a
     * code block or a table (not worth reading aloud) so the client shows it
     * instead of speaking it. KaTeX formulas stay speakable (normalizeForSpeech
     * verbalizes them). A hint, never an order — the user stays in control.
     */
    speakable?: boolean;
  };
}
