export interface SessionDetails {
  id: string;
  userId: string;
  subject: string;
  startedAt: Date;
  endedAt: Date | null;
  durationMinutes: number | null;
  frustrationAvg: number | null;
  questionLevelsAvg: number | null;
  conceptsCovered: string | null;
}

export interface MessageDetails {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  frustrationLevel: number | null;
  questionLevel: number | null;
  aiModel: string | null;
  isFallback: boolean;
  timestamp: Date;
  tokensUsed: number | null;
  costEstimate: number | null;
  attachedFile?: {
    fileName: string;
    fileId?: string;
    mimeType?: string;
    fileSizeBytes?: number;
  } | null;
}

export interface UserSession {
  id: string;
  subject: string;
  startedAt: Date;
  endedAt: Date | null;
  messagesCount: number;
  lastActivity: Date;
  frustrationAvg: number;
}

export interface ConversationListItem {
  id: string;
  title: string | null;
  subject: string;
  status: string;
  messageCount: number;
  lastMessagePreview: string | null;
  lastMessageRole: 'user' | 'assistant' | null;
  lastActivityAt: Date;
  startedAt: Date;
}
