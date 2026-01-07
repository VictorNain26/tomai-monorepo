// Types locaux mobile

export type { LevelId, CycleId } from '@/constants/levels';
export type { SubjectId } from '@/constants/subjects';

// Navigation types
export type RootStackParamList = {
  index: undefined;
  '(auth)/login': undefined;
  '(auth)/register': undefined;
  '(auth)/forgot-password': undefined;
  '(student)': undefined;
  '(parent)': undefined;
};

// Chat types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
  attachments?: FileAttachment[];
}

export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number;
}

// Pronote types (client-side)
export interface PronoteSession {
  isConnected: boolean;
  studentName?: string;
  schoolName?: string;
  lastSync?: Date;
}

export interface Homework {
  id: string;
  subject: string;
  description: string;
  dueDate: Date;
  done: boolean;
}

export interface Grade {
  id: string;
  subject: string;
  value: number;
  outOf: number;
  date: Date;
  comment?: string;
}
