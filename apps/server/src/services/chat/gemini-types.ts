import type { EducationLevelType } from '../../types/index.js';

export interface AttachedFile {
  fileUri?: string;
  base64?: string;
  mimeType: string;
  contentType: 'image' | 'document';
}

export interface HistoricalFileRef {
  geminiFileId?: string;
  mimeType?: string;
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
  files?: AttachedFile[];
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    attachedFile?: HistoricalFileRef | null;
  }>;
}

export interface GeminiStreamChunk {
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
