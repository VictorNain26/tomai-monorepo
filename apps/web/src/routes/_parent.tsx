import { useQuery } from '@tanstack/react-query';
import { Link, Outlet, createFileRoute } from '@tanstack/react-router';
import { Notice } from '../components/notice';
import { Page } from '../components/page';
import { SignOut } from '../components/sign-out';
import { meQuery } from '../lib/me';

/**
 * The guardian's sign-in, sign-up and passwords. A device paired to a student takes none of them,
 * the server's guard refusing it: these screens say whose the device is instead.
 */
export const Route = createFileRoute('/_parent')({ component: ParentScreens });

function ParentScreens() {
  // Not awaited: when /api/me fails, the form still shows.
  const { data: me } = useQuery(meQuery);
  if (me?.role !== 'student') return <Outlet />;

  return (
    <Page title="Cet appareil est relié">
      <Notice tone="info">
        Cet appareil est relié au compte de {me.name}. Pour vous connecter en parent, déconnectez d’abord {me.name} : il lui faudra un nouveau code
        pour revenir.
      </Notice>
      <SignOut label={`Déconnecter ${me.name} de cet appareil`} />
      <Link to="/" className="min-h-11 py-3 text-sm text-primary underline">
        Revenir à l’espace de {me.name}
      </Link>
    </Page>
  );
}
