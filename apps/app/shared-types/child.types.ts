import type { SchoolLevel } from './auth.types';

export interface IChild {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  schoolLevel?: SchoolLevel | null;
  dateOfBirth?: string | null;
  age?: number | null;
  parentId?: string;
  isActive?: boolean;
  createdAt?: string;
  email?: string | null;
}

export interface ICreateChildRequest {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  dateOfBirth: string;
  schoolLevel: SchoolLevel;
}

export interface IUpdateChildRequest {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  schoolLevel?: SchoolLevel;
  username?: string;
}

export interface IChildResponse {
  success: boolean;
  child: IChild;
  message: string;
}

export interface IChildrenResponse {
  children: IChild[];
}

export interface IDeleteChildResponse {
  success: boolean;
  message: string;
}
