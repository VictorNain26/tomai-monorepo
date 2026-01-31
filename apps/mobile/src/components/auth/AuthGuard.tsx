/**
 * Auth Guard Component
 *
 * Utility component for protecting individual screens.
 * NOTE: Main auth protection is handled in _layout.tsx NavigationGuard.
 */

import { useUser, type IAppUser } from '@/lib/auth';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: 'student' | 'parent';
  fallback?: React.ReactNode;
}

/**
 * Optional auth guard for protecting specific content within screens.
 * Returns fallback (or null) if user doesn't match requirements.
 */
export function AuthGuard({ children, requiredRole, fallback = null }: AuthGuardProps) {
  const user = useUser();

  if (!user) {
    return <>{fallback}</>;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Hook to get current user with type safety.
 * Throws if used outside authenticated context.
 */
export function useRequiredUser(): IAppUser {
  const user = useUser();
  if (!user) {
    throw new Error('useRequiredUser must be used in authenticated context');
  }
  return user;
}
