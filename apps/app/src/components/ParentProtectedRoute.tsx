import { Navigate, Outlet } from 'react-router';
import { type ReactElement, useEffect, useState } from 'react';
import { useUser, useSession, authClient } from '@/lib/auth';
import { isITomAIUser } from '@/types';

function ParentProtectedRoute(): ReactElement {
  const user = useUser();
  const { isPending, error } = useSession();
  const [isRedirecting, setIsRedirecting] = useState(false);

  // ✅ ORPHANED SESSION DETECTION: Auto-logout silencieux si session invalide
  useEffect(() => {
    if (error && !isRedirecting) {
      setIsRedirecting(true);
      // Logout complet (clear cookies + state) puis redirection immédiate
      void authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            window.location.replace('/auth/login');
          },
          onError: () => {
            // Fallback: forcer redirection même si signOut échoue
            window.location.replace('/auth/login');
          }
        }
      });
    }
  }, [error, isRedirecting]);

  // Chargement simple
  if (isPending) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  // Session error → redirection silencieuse en cours
  if (error || isRedirecting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  // Pas de session → login
  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  // Vérifier si l'utilisateur a un rôle défini
  if (!isITomAIUser(user)) {
    return <Navigate to="/auth/login" replace />;
  }

  // Étudiant → dashboard étudiant
  if (user.role === 'student') {
    return <Navigate to="/student" replace />;
  }

  // Pas parent → login
  if (user.role !== 'parent') {
    return <Navigate to="/auth/login" replace />;
  }

  // OK → afficher contenu
  return <Outlet />;
}

export default ParentProtectedRoute;
