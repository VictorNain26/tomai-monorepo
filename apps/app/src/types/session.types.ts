/**
 * Session Types - Sessions d'étude et progression
 */

// Session creation response
export interface ISessionResponse {
  sessionId: string;
  subject: string;
  message: string;
}

// Session status types matching backend schema
export type SessionStatus = 'draft' | 'active' | 'paused' | 'completed' | 'abandoned' | 'timeout' | 'error';

// Session types
export interface IStudySession {
  id: string;
  userId?: string;
  studentId?: string;
  subject: string;
  status?: SessionStatus; // Session status from backend (default: 'active')
  startedAt: string; // Nom de champ backend
  startTime?: string; // Alias pour compatibilité
  createdAt?: string; // Additional alias
  endedAt?: string;
  endTime?: string; // Alias pour compatibilité
  messagesCount: number;
  avgFrustration?: number;
  frustrationAvg?: number; // Alias backend
  conceptsCovered?: string[];
  durationMinutes?: number;
  duration?: number; // Alias for duration
}

// Progress types
export interface IProgress {
  userId: string;
  subject: string;
  concept: string;
  masteryLevel: number;
  lastPractice: string;
  totalAttempts: number;
  successfulAttempts: number;
}

export interface ISubjectProgress {
  studentId?: string;
  studentName?: string;
  subject: string;
  conceptsMastered?: number;
  avgMastery?: number;
  avgSuccessRate?: number;
  totalPracticeTime?: number;
  lastPracticed?: string | null;
}

export interface ICostTracking {
  currentMonthCost: number;
  estimatedMonthlyCost: number;
  totalTokensUsed: number;
  costLimit: number;
  warningThreshold: number;
}

export interface IProgressData {
  totalSessions: number;
  totalMessages: number;
  averageFrustration: number;
  subjectProgress: ISubjectProgress[];
  recentSessions: IStudySession[];
  costTracking: ICostTracking;
  progress?: IProgress[];
  stats?: {
    totalConcepts: number;
    masteredConcepts: number;
    averageMastery: number;
  };
}

// Dashboard stats
export interface IDashboardStats {
  totalSessions: number;
  totalMessages: number;
  averageFrustration: number;
  subjectProgress: ISubjectProgress[];
  recentSessions: IStudySession[];
  costTracking: ICostTracking;
  studyDays?: number;
  totalStudyTime?: number;
  avgSessionDuration?: number;
  lastSessionDate?: string;
  subjectsStudied?: number;
}

// Session response types
export interface ISessionsResponse {
  sessions: IStudySession[];
  _data?: IStudySession[]; // Alternative backend format
}
