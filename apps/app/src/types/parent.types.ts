/**
 * Parent Types - LV2, gestion enfants et métriques parent
 */

import type { EducationLevelType } from './education.types';
import type { IStudySession, ISubjectProgress } from './session.types';

// ======================================
// LV2 (Langue Vivante 2) Types
// ======================================

/** Options LV2 disponibles - à partir de 5ème */
export type Lv2Option = 'espagnol' | 'allemand' | 'italien';

/** Niveaux où la LV2 est disponible */
export const LV2_ELIGIBLE_LEVELS: EducationLevelType[] = [
  'cinquieme', 'quatrieme', 'troisieme',
  'seconde', 'premiere', 'terminale'
];

/** Vérifie si un niveau scolaire permet la LV2 */
export function isLv2EligibleLevel(level?: string): boolean {
  return level ? LV2_ELIGIBLE_LEVELS.includes(level as EducationLevelType) : false;
}

// ======================================
// Parent Dashboard Types
// ======================================

export interface IChild {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  schoolLevel?: string;
  selectedLv2?: Lv2Option | null; // LV2 choisie (espagnol, allemand, italien)
  dateOfBirth?: string;
  age?: number;
  studySessions?: IStudySession[];
  totalSessions?: number;
  totalMinutes?: number;
  createdAt?: string;
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

// ======================================
// Child Management API Types
// ======================================

export interface IUpdateChildRequest {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  schoolLevel?: EducationLevelType;
  selectedLv2?: Lv2Option | null;
  username?: string;
}

export interface IChildResponse {
  success: boolean;
  child: IChild;
  message: string;
}

export interface IDeleteChildResponse {
  success: boolean;
  message: string;
}

export interface IChildrenResponse {
  children: IChild[];
}

export interface IMetricsResponse {
  metrics: IMetrics[];
}

export interface IProgressResponse {
  progress: ISubjectProgress[];
}

// Form data interfaces
export interface ICreateChildData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  schoolLevel: string;
  selectedLv2?: Lv2Option | null; // LV2 choisie (à partir de 5ème)
  username: string;
  password: string;
  subjects?: string[];
}

export interface IUpdateChildData {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  schoolLevel: string;
  selectedLv2?: Lv2Option | null; // LV2 choisie (à partir de 5ème)
}
