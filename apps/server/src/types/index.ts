import type { userRoleEnum, SchoolLevel } from '../db/schema';

// Type pour le rôle utilisateur
type UserRole = typeof userRoleEnum.enumValues[number];

// Utilisateur authentifié injecté par requireUser / requireParent
export interface AuthenticatedUser {
  id: string;
  username?: string | null;
  email?: string | null;
  name?: string | null;
  role: UserRole;
  firstName?: string | null;
  lastName?: string | null;
  schoolLevel?: string | null;
  dateOfBirth?: string | null;
}

// Single source of truth: derived from the DB `school_level` enum.
export type EducationLevelType = SchoolLevel;

// Variables read straight from process.env; everything else goes through
// platform/config/env.ts. https://bun.com/docs/runtime/environment-variables
declare module 'bun' {
  interface Env {
    DATABASE_URL?: string;
    MISTRAL_API_KEY?: string;
  }
}

export {};