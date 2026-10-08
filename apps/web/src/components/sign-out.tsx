import { Button } from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { authClient, authMessage } from '../lib/auth';
import { Notice } from './notice';

/**
 * Signs the guardian out of this device, then loads the app afresh: on a device the family shares,
 * nothing of theirs stays in memory. Where the device also holds a child's session, only theirs is
 * revoked, and the device goes back to the child: better-auth's sign-out would close them all.
 */
export function SignOut({ label }: { label: string }) {
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const signOut = async () => {
    setFailure(null);
    setPending(true);
    const [{ data: current }, { data: held }] = await Promise.all([authClient.getSession(), authClient.multiSession.listDeviceSessions()]);
    const shared = held?.some(({ session }) => session.token !== current?.session.token) ?? false;
    const { error } = current && shared ? await authClient.multiSession.revoke({ sessionToken: current.session.token }) : await authClient.signOut();
    if (error) {
      setPending(false);
      setFailure(authMessage(error));
      return;
    }
    await navigate({ to: '/', reloadDocument: true });
  };

  return (
    <>
      {failure && <Notice tone="error">{failure}</Notice>}
      <Button variant="outline" disabled={pending} onClick={() => void signOut()}>
        {label}
      </Button>
    </>
  );
}
