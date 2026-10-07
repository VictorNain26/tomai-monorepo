import { Button } from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { authClient, authMessage } from '../lib/auth';
import { Notice } from './notice';

/** Closes this device's session of a student: their parent gives a new code to come back. */
export function DeviceSignOut({ label }: { label: string }) {
  const navigate = useNavigate();
  const [failure, setFailure] = useState<string | null>(null);

  const signOut = async () => {
    setFailure(null);
    const { error } = await authClient.signOut();
    if (error) {
      setFailure(authMessage(error));
      return;
    }
    // A whole new page: nothing of the student stays in memory on a shared device.
    await navigate({ to: '/connexion', reloadDocument: true });
  };

  return (
    <>
      {failure && <Notice tone="error">{failure}</Notice>}
      <Button variant="outline" onClick={() => void signOut()}>
        {label}
      </Button>
    </>
  );
}
