export type UserRole = 'student' | 'parent';
export type SchoolLevel = 'cp' | 'ce1' | 'ce2' | 'cm1' | 'cm2' | 'sixieme' | 'cinquieme' | 'quatrieme' | 'troisieme' | 'seconde' | 'premiere' | 'terminale';

export interface IUser {
  id: string;
  username?: string;
  email?: string;
  role: UserRole;
  schoolLevel?: SchoolLevel;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  parentId?: string;
  createdAt?: string;
  isActive?: boolean;
}

export interface IAuthPayload {
  id: string;
  username?: string;
  email?: string;
  role: UserRole;
  schoolLevel?: SchoolLevel;
  firstName?: string;
  lastName?: string;
  parentId?: string;
}
