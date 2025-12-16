/**
 * User Types - Authentification et profils utilisateurs
 */

import type { EducationLevelType } from './education.types';
import type { Lv2Option } from './parent.types';

// User role types consistent with backend (Better Auth + Tom)
export type UserRoleType = 'student' | 'parent' | 'admin';

// Account type for registration/login forms
export type AccountTypeType = 'student' | 'parent';

// Tom User interface - Single source of truth compatible avec Better Auth
export interface IAppUser {
  id: string;
  name: string;
  email: string;
  image?: string | null | undefined;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Tom fields - optionnels pour compatibilité Better Auth
  role?: UserRoleType;
  firstName?: string;
  lastName?: string;
  username?: string;
  schoolLevel?: EducationLevelType;
  selectedLv2?: Lv2Option | null;
  dateOfBirth?: string;
}

// Type alias for backward compatibility
export type ITomUser = IAppUser;

// Type guard simplifié
export function isITomUser(user: IAppUser | null): user is IAppUser {
  return user !== null && 'role' in user && user.role !== undefined;
}

// Better Auth session interface
export interface ITomSession {
  user: IAppUser;
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
    token: string;
    createdAt: Date;
    updatedAt: Date;
    ipAddress?: string;
    userAgent?: string;
  };
}

// Registration data interface
export interface IRegisterData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  role: 'parent' | 'student';
}
