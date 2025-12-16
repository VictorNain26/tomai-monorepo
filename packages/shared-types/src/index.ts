/**
 * TomAI - Types partagés Frontend/Backend
 * Référence unique pour éviter la duplication
 */

// =============================================================================
// TYPES AUTHENTICATION
// =============================================================================

export interface User {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  role: 'parent' | 'student';
  schoolLevel?: string;
  parentId?: string;
  isActive: boolean;
  createdAt: Date;
}

export interface AuthSession {
  id: string;
  userId: string;
  expiresAt: Date;
}

// =============================================================================
// TYPES EDUCATION
// =============================================================================

export type EducationLevel =
  | 'cp' | 'ce1' | 'ce2' | 'cm1' | 'cm2'
  | '6eme' | '5eme' | '4eme' | '3eme'
  | 'seconde' | 'premiere' | 'terminale';

export interface Subject {
  key: string;
  name: string;
  level: EducationLevel;
}

// =============================================================================
// TYPES CHAT & AI
// =============================================================================

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  frustrationLevel?: number;
  aiModel?: string;
  tokensUsed?: number;
}

export interface ChatSession {
  id: string;
  userId: string;
  subject: string;
  status: 'active' | 'completed';
  startedAt: string;
  endedAt?: string;
  messagesCount: number;
  lastActivity: string;
}

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

// =============================================================================
// TYPES PARENT/CHILD
// =============================================================================

export interface Child {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  schoolLevel: EducationLevel;
  dateOfBirth?: string;
  isActive: boolean;
  parentId: string;
  createdAt: string;
}

export interface CreateChildRequest {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  schoolLevel: EducationLevel;
  dateOfBirth?: string;
}

export interface UpdateChildRequest {
  firstName?: string;
  lastName?: string;
  schoolLevel?: EducationLevel;
  dateOfBirth?: string;
  isActive?: boolean;
}

// =============================================================================
// TYPES PROGRESS & ANALYTICS
// =============================================================================

export interface StudentProgress {
  userId: string;
  totalSessions: number;
  totalStudyTime: number;
  conceptsLearned: number;
  averageFrustration: number;
  subjectsStudied: string[];
  lastActivity?: string;
}

export interface ParentDashboard {
  parent: {
    id: string;
    name: string;
  };
  children: Child[];
  metrics: {
    totalSessions: number;
    totalStudyTime: number;
    activeChildren: number;
  };
}

// =============================================================================
// TYPES API REQUESTS/RESPONSES
// =============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

export interface ChatMessageRequest {
  content: string;
  subject: string;
  sessionId?: string;
}

export interface ChatMessageResponse {
  success: true;
  message: ChatMessage;
  sessionId: string;
  metadata: {
    provider: string;
    tokensUsed: number;
    frustrationLevel?: number;
  };
}

// =============================================================================
// TYPES VALIDATION SCHEMAS
// =============================================================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
}
