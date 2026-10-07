import { Link, createFileRoute } from '@tanstack/react-router';
import { z } from '../lib/zod';
import { Notice } from '../components/notice';
import { Page } from '../components/page';

/** Where better-auth sends an error of its own links (`onAPIError.errorURL`), a confirmation link expired for instance. */
export const Route = createFileRoute('/erreur-connexion')({
  validateSearch: z.object({ error: z.string().optional() }),
  component: AuthError,
});

function AuthError() {
  const { error } = Route.useSearch();
  const expired = error === 'INVALID_TOKEN' || error === 'TOKEN_EXPIRED' || error === 'invalid_token';
  return (
    <Page title="Ce lien ne fonctionne pas">
      <Notice tone="error">
        {expired
          ? 'Ce lien n’est plus valable. Connectez-vous : un nouveau lien vous sera envoyé si votre adresse n’est pas encore confirmée.'
          : 'Une erreur est survenue avec ce lien.'}
      </Notice>
      <Link to="/connexion" className="min-h-11 py-3 text-sm text-primary underline">
        Aller à la connexion
      </Link>
    </Page>
  );
}
