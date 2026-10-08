import { createFileRoute, redirect } from '@tanstack/react-router';
import { meQuery } from '../lib/me';

/** The guardian's screens: anyone else goes home, a guardian not named yet gives their first name. */
export const Route = createFileRoute('/foyer')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.query(meQuery);
    if (me?.role !== 'guardian') throw redirect({ to: '/' });
    if (me.name === '') throw redirect({ to: '/bienvenue' });
  },
});
