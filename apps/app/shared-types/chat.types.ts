export interface IMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: string;
  sessionId?: string;
  frustrationLevel?: number;
  concept?: string;
  aiModel?: string;
  isFallback?: boolean;
  tokensUsed?: number;
  estimatedCost?: number;
  metadata?: {
    provider?: string;
    questionLevel?: number;
    frustrationLevel?: number;
    aiModelDetails?: {
      name?: string;
      tier?: string;
    };
  };
}

export interface IChatMessage {
  content: string;
  subject: string;
  sessionId: string;
  frustrationLevel: number;
}

export interface IChatResponse {
  message: IMessage;
  sessionId: string;
}

export interface IStudySession {
  id: string;
  userId?: string;
  subject: string;
  startedAt: string;
  endedAt?: string;
  messagesCount: number;
  avgFrustration?: number;
  frustrationAvg?: number;
  conceptsCovered?: string[];
  durationMinutes?: number;
}

export interface ISessionRequest {
  subject: string;
}

export interface ISessionResponse {
  sessionId: string;
  subject: string;
  message: string;
}

export interface ISessionsResponse {
  sessions: IStudySession[];
  data?: IStudySession[];
}

export interface ISessionHistoryResponse {
  history: IMessage[];
  messages?: IMessage[];
}
