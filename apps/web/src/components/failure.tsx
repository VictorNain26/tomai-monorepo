import { Button } from '@repo/ui';
import { useRouter } from '@tanstack/react-router';
import { Page } from './page';

/** A screen that failed to load: a sentence in French and a retry, never the error itself. */
export function Failure() {
  const router = useRouter();
  return (
    <Page title="Une erreur est survenue">
      <p className="text-muted-foreground">Vérifiez votre connexion, puis réessayez.</p>
      <Button onClick={() => void router.invalidate()}>Réessayer</Button>
    </Page>
  );
}
