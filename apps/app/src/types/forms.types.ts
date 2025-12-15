/**
 * Forms Types - Props de composants et données de formulaires
 */

import type { ComponentType, ReactNode } from 'react';

// Generic API Response type
export interface IApiResponse<T> {
  success: boolean;
  _data?: T;
  _error?: string;
  message?: string;
}

// Component Props types
export interface IProtectedRouteProps {
  children?: ReactNode;
}

export interface ILayoutProps {
  children?: ReactNode;
}

export interface ISubjectCardProps {
  subject: {
    id: string;
    name: string;
    icon: ComponentType<{ className?: string }>;
    color: string;
    lightColor: string;
    darkColor: string;
    description: string;
  };
  onClick: (subjectId: string) => void;
}

// Form types
export interface ILoginFormData {
  username: string;
  password: string;
}

// Input field props
export interface IInputFieldProps {
  label: string;
  _type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  icon?: ReactNode;
  required?: boolean;
  autoComplete?: string;
  'aria-describedby'?: string;
}

// Register form types
export interface IRegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  schoolLevel: string;
  parentFirstName?: string;
  parentLastName?: string;
  parentEmail?: string;
  parentPassword?: string;
}
