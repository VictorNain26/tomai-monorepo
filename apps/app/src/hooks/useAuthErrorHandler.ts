/**
 * Hook pour gérer automatiquement les erreurs d'authentification (401)
 * Écoute l'événement 'auth:unauthorized' déclenché par api-client
 * et déconnecte l'utilisateur via Better Auth
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { authClient } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

export function useAuthErrorHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleUnauthorized = async () => {
      logger.warn('Unauthorized event received - logging out user', {
        component: 'useAuthErrorHandler',
        operation: 'auto-logout'
      });

      try {
        // Déconnexion via Better Auth (nettoie cookies et session)
        await authClient.signOut({
          fetchOptions: {
            onSuccess: () => {
              // Rediriger vers login après déconnexion réussie
              void navigate('/auth/login', { replace: true });
              toast.error('Session expirée. Veuillez vous reconnecter.');
            },
            onError: (ctx) => {
              logger.error('SignOut failed during unauthorized handler', {
                component: 'useAuthErrorHandler',
                error: ctx.error.message ?? 'Unknown error',
                status: ctx.error.status
              });
              // Forcer redirection même si signOut échoue
              void navigate('/auth/login', { replace: true });
            }
          }
        });
      } catch (error) {
        logger.error('Error during unauthorized handler', {
          component: 'useAuthErrorHandler',
          error: error instanceof Error ? error.message : String(error)
        });
        // Forcer redirection en cas d'erreur
        void navigate('/auth/login', { replace: true });
      }
    };

    // Écouter l'événement 'auth:unauthorized' déclenché par api-client
    window.addEventListener('auth:unauthorized', handleUnauthorized);

    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [navigate]);
}
