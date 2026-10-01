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
