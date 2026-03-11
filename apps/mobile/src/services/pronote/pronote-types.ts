export interface QrCodeData {
  jeton: string;
  login: string;
  url: string;
}

export interface PronoteMetadata {
  instanceUrl: string;
  username: string;
  deviceUuid: string;
  accountKind: 6 | 7 | 8; // pawnote AccountKind: STUDENT=6, PARENT=7, TEACHER=8
}

export interface PronoteResource {
  name: string;
  id: string;
  className?: string;
}

export interface PronoteHomework {
  id: string;
  subject: string;
  description: string;
  dueDate: string;
  done: boolean;
  difficulty: number;
  estimatedMinutes?: number;
}

export interface PronoteGrade {
  id: string;
  subject: string;
  value: number | null;
  outOf: number;
  coefficient: number;
  date: string;
  description: string;
  average?: number;
  max?: number;
  min?: number;
}

export interface PronoteTimetableEntry {
  id: string;
  subject?: string;
  teacherNames: string[];
  classrooms: string[];
  startDate: string;
  endDate: string;
  canceled: boolean;
  status?: string;
}

export interface PronoteConnectionResult {
  success: boolean;
  error?: string;
  resources?: PronoteResource[];
  accountKind?: 6 | 7 | 8;
}

export interface PronoteChatContext {
  homework?: PronoteHomework[];
  recentGrades?: PronoteGrade[];
  todayTimetable?: PronoteTimetableEntry[];
}
