import { Button } from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { authClient, authMessage } from '../lib/auth';
import { Notice } from './notice';

/**
 * Signs this device out, a guardian or a student, then loads the sign-in page afresh: on a device
 * the family shares, nothing of whoever left stays in memory.
 */
export function SignOut({ label }: { label: string }) {
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const signOut = async () => {
    setFailure(null);
    setPending(true);
    const { error } = await authClient.signOut();
    if (error) {
      setPending(false);
      setFailure(authMessage(error));
      return;
    }
    await navigate({ to: '/connexion', reloadDocument: true });
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
