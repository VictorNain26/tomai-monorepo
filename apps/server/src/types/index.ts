import type { userRoleEnum } from '../db/schema';

// Type pour le rôle utilisateur
type UserRole = typeof userRoleEnum.enumValues[number];

// Elysia Context User interface pour l'authentification
export interface ElysiaAuthenticatedUser {
  id: string;
  username?: string | null;
  email?: string | null;
  name?: string | null;
  role: UserRole;
  firstName?: string | null;
  lastName?: string | null;
  schoolLevel?: string | null;
  dateOfBirth?: string | null;
  parentId?: string | null;
}

// Types AI - Basic (used for internal chat)
export interface IAIMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  frustrationLevel?: number;
}

// Types AI - Extended (from ai.types.ts)
export type {
  IAIMessage as IAIMessageExtended,
  GenerationParams,
  AIResponse,
  AIStreamResponseWithTokens
} from './ai.types.js';

// Types Education - Harmonisés avec schema PostgreSQL
export type EducationLevelType =
  | 'cp' | 'ce1' | 'ce2' | 'cm1' | 'cm2'
  | 'sixieme' | 'cinquieme' | 'quatrieme' | 'troisieme'
  | 'seconde' | 'premiere' | 'terminale';

export type EducationCycleType = 'cycle1' | 'cycle2' | 'cycle3' | 'cycle4' | 'lycee';

export type SchoolSubjectType = string; // Flexible pour toutes les matières

export type DocumentStatusType = 'valide' | 'draft' | 'archive';

export type DocumentTypeType = 'programme' | 'ressource' | 'evaluation';

export type ComplexityLevelType = '1' | '2' | '3' | '4' | '5';

// Types Chat
export interface StudySession {
  id: string;
  userId: string;
  subject: string;
  status: 'active' | 'completed';
  startedAt: Date;
  endedAt?: Date;
  messagesCount: number;
  lastActivity: Date;
  frustrationAvg?: number;
}

// Types Parent/Child
export interface Child {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  schoolLevel: EducationLevelType;
  dateOfBirth?: Date;
  isActive: boolean;
  parentId: string;
}

export interface CreateChildData {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  schoolLevel: EducationLevelType;
  dateOfBirth?: Date;
}

// Types Progress
export interface StudentStats {
  totalSessions: number;
  totalStudyTime: number;
  conceptsLearned: number;
  averageFrustration: number;
  averageSessionDuration: number;
  subjectsStudied: number;
  lastSessionDate?: Date;
  weeklyActivity: number;
  monthlyActivity: number;
}

// Better Auth session interface
export interface BetterAuthSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  impersonatedBy?: string;
  activeOrganizationId?: string;
  [key: string]: unknown;
}

// Context Elysia pour les plugins
export interface ElysiaAuthContext {
  user?: ElysiaAuthenticatedUser;
  session?: BetterAuthSession;
}

// Types pour les logs et observabilité
export interface LogContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  action?: string;
  metadata?: Record<string, unknown>;
  // Propriétés spécifiques ajoutées
  messageLength?: number;
  role?: string;
  lastActivity?: Date;
  [key: string]: unknown;
}

// Types pour les données JSON génériques
export type JsonValue = 
  | string 
  | number 
  | boolean 
  | null 
  | { [key: string]: JsonValue } 
  | JsonValue[];

export type JsonObject = { [key: string]: JsonValue };

// Types pour les réponses d'API externes
export interface ApiResponse<T = unknown> {
  data?: T;
  _error?: string;
  status?: number;
  headers?: Record<string, string>;
}

// Types pour les objets de configuration
export interface ConfigObject {
  [key: string]: string | number | boolean | ConfigObject | ConfigObject[];
}

// Types pour les erreurs avec contexte
export interface ErrorWithContext extends Error {
  context?: Record<string, unknown>;
  code?: string;
  statusCode?: number;
}

// Types Chapitres/Curriculum - Structure hiérarchique RAG
export interface SubChapter {
  id: string;
  name: string;
  topics: string[];
  topicsCount: number;
}

export interface Chapter {
  id: string;
  name: string;
  subChapters: SubChapter[];
  subChaptersCount: number;
  topicsCount: number;
}

export interface ChaptersHierarchy {
  niveau: EducationLevelType;
  matiere: string;
  matiereLabel: string;
  chapters: Chapter[];
  totalChapters: number;
  totalSubChapters: number;
  totalTopics: number;
}


// Global environment variables types pour Bun
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      DATABASE_URL?: string;
      BETTER_AUTH_SECRET: string;
      BETTER_AUTH_URL?: string;
      // AI Services — Mistral 100% (chat + embeddings + STT + TTS + OCR).
      MISTRAL_API_KEY: string;
      MISTRAL_CHAT_MODEL?: string;
      MISTRAL_REASONING_MODEL?: string;
      MISTRAL_AUX_MODEL?: string;
      MISTRAL_TRANSCRIBE_MODEL?: string;
      MISTRAL_TTS_MODEL?: string;
      MAX_TOKENS_PER_RESPONSE?: string;
      DAILY_REQUEST_LIMIT?: string;
      CACHE_DURATION?: string;
      FRONTEND_URL?: string;
      PORT?: string;
    }
  }
}

export {};