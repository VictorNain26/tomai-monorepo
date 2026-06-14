import type { userRoleEnum, SchoolLevel } from '../db/schema';

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

// Single source of truth: derived from the DB `school_level` enum.
export type EducationLevelType = SchoolLevel;

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
      // AI Services — stack 100 % Mistral souveraine EU (Phase 2B closed)
      MISTRAL_API_KEY?: string;     // Chat, embeddings épisodique, TTS/STT Voxtral
      AI_SERVICE_URL?: string;       // BGE-M3 micro-service (apps/ai-service)
      AI_SERVICE_TOKEN?: string;     // Bearer token for ai-service auth
      MAX_TOKENS_PER_RESPONSE?: string;
      DAILY_REQUEST_LIMIT?: string;
      CACHE_DURATION?: string;
      FRONTEND_URL?: string;
      PORT?: string;
    }
  }
}

export {};