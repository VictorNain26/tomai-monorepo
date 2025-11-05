export interface IProgress {
  userId: string;
  subject: string;
  concept: string;
  masteryLevel: number;
  lastPractice: string;
  totalAttempts: number;
  successfulAttempts: number;
  totalPracticeTime?: number;
  successRate?: number;
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
  recentSessions: import('./chat.types').IStudySession[];
  costTracking: ICostTracking;
  progress?: IProgress[];
  stats?: {
    totalConcepts: number;
    masteredConcepts: number;
    averageMastery: number;
  };
}

export interface IDashboardStats {
  totalSessions: number;
  totalMessages: number;
  averageFrustration: number;
  subjectProgress: ISubjectProgress[];
  recentSessions: import('./chat.types').IStudySession[];
  costTracking: ICostTracking;
  studyDays?: number;
  totalStudyTime?: number;
  avgSessionDuration?: number;
  lastSessionDate?: string;
  subjectsStudied?: number;
}

export interface IMetrics {
  studentId: string;
  studentName: string;
  schoolLevel?: string;
  age: number;
  totalSessions: number;
  studyDays: number;
  avgSessionDuration: number;
  avgFrustration: number;
  subjectsStudied: number;
  totalStudyTime: number;
  lastSessionDate?: string;
}

export interface IGlobalMetrics {
  totalStudents: number;
  totalSessions: number;
  totalMessages: number;
  avgFrustration: number;
  totalStudyTime: number;
  avgSessionDuration: number;
  totalConceptsMastered: number;
  avgMasteryLevel: number;
}

export interface IProgressResponse {
  progress: ISubjectProgress[];
}

export interface IMetricsResponse {
  metrics: IMetrics[];
}
