import { Button } from '@repo/ui';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { Page } from '../components/page';
import { authClient } from '../lib/auth';
import { meQuery } from '../lib/me';

/** The guardian's home: their household, which the next screens fill. */
export const Route = createFileRoute('/foyer')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.query(meQuery);
    if (me?.role !== 'guardian') throw redirect({ to: '/' });
  },
  component: Household,
});

function Household() {
  const { data: me } = useSuspenseQuery(meQuery);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const signOut = async () => {
    await authClient.signOut();
    queryClient.clear();
    await navigate({ to: '/connexion' });
  };

  return (
    <Page title={`Bonjour ${me?.name ?? ''}`}>
      <p className="text-muted-foreground">Votre foyer arrive bientôt : vous pourrez y créer le compte de votre enfant.</p>
      <Button variant="outline" onClick={() => void signOut()}>
        Se déconnecter
      </Button>
    </Page>
  );
}
