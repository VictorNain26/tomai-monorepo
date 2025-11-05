import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useSession } from '@/lib/auth';
import type { ITomAIUser } from '@/types';

/**
 * Callback simple - attend la session et redirige
 */
export default function OAuthCallback() {
  const navigate = useNavigate();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    // Attendre que la session soit chargée
    if (isPending) return;

    // Si on a une session, rediriger
    if (session?.user) {
      const userWithRole = session.user as ITomAIUser;
      const redirectPath = userWithRole.role === 'parent' ? '/parent' : '/student';
      void navigate(redirectPath, { replace: true });
      return;
    }

    // Pas de session après chargement = retour login
    void navigate('/auth/login', { replace: true });
  }, [session, isPending, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-3 text-muted-foreground">Connexion...</p>
      </div>
    </div>
  );
}
