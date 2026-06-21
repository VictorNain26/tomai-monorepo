export interface ChildInfo {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  schoolLevel: string;
  dateOfBirth?: string;
  isActive: boolean;
  parentId: string;
  role: 'student';
  createdAt: string;
  hasPronote: boolean;
}

export interface ParentDashboardMetrics {
  studentId: string;
  studentName: string;
  schoolLevel: string;
  age: number;
  totalSessions: number;
  studyDays: number;
  avgSessionDuration: number;
  avgFrustration: number;
  subjectsStudied: number;
  totalStudyTime: number;
  lastSessionDate: Date | null;
}

export interface StudentProgress {
  studentId: string;
  studentName: string;
  subject: string;
  conceptsMastered: number;
  avgMastery: number;
  avgSuccessRate: number;
  totalPracticeTime: number;
  lastPracticed: Date | null;
}

export interface SessionSummary {
  id: string;
  subject: string;
  startTime: Date;
  endTime: Date | null;
  messagesCount: number;
  avgFrustration: number;
}

export interface SessionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  frustrationLevel: number | null;
  createdAt: Date;
  aiModel: string | null;
  tokensUsed: number | null;
}
