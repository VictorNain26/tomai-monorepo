import { createFileRoute, redirect } from '@tanstack/react-router';
import { meQuery } from '../lib/me';

/** The guardian's screens: anyone else goes home. */
export const Route = createFileRoute('/foyer')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.query(meQuery);
    if (me?.role !== 'guardian') throw redirect({ to: '/' });
  },
});
