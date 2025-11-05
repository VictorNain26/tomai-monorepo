import { Outlet, Navigate } from 'react-router';
import type { ReactElement } from 'react';
import { useUser, useSession } from '@/lib/auth';
import { isITomAIUser } from '@/types';

/**
 * Composant pour routes publiques (login, register)
 * Empêche l'accès aux pages d'authentification si l'utilisateur est déjà connecté
 */
function PublicRoute(): ReactElement {
  const user = useUser();
  const { isPending } = useSession();

  // Attendre le chargement de la session AVANT de prendre toute décision
  if (isPending) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Vérification...</p>
        </div>
      </div>
    );
  }

  // Si l'utilisateur est connecté, rediriger vers son dashboard
  if (user) {
    if (isITomAIUser(user)) {
      const redirectPath = user.role === 'parent' ? '/parent' : '/student';
      return <Navigate to={redirectPath} replace />;
    }
    // Si l'utilisateur n'a pas de rôle, retourner au login pour compléter le profil
    return <Navigate to="/auth/login" replace />;
  }

  // Sinon, autoriser l'accès aux pages publiques
  return <Outlet />;
}

export default PublicRoute;
