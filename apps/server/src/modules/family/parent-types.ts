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
  subjectsStudied: number;
  lastSessionDate: Date | null;
}
