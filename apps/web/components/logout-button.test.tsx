import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));

const signOut = vi.fn();
vi.mock('@/lib/auth-client', () => ({ signOut: (...a: unknown[]) => signOut(...a) }));

import { LogoutButton } from './logout-button';

describe('LogoutButton', () => {
  beforeEach(() => {
    push.mockClear();
    refresh.mockClear();
    signOut.mockReset();
  });

  it('signs out then redirects on success', async () => {
    signOut.mockResolvedValueOnce(undefined);
    render(<LogoutButton />);
    fireEvent.click(screen.getByRole('button', { name: /déconnexion/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'));
  });

  it('shows an error and does not redirect when sign out fails', async () => {
    signOut.mockRejectedValueOnce(new Error('network'));
    render(<LogoutButton />);
    fireEvent.click(screen.getByRole('button', { name: /déconnexion/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(push).not.toHaveBeenCalled();
  });

  it('disables the button while signing out', async () => {
    let resolve!: () => void;
    signOut.mockReturnValueOnce(new Promise<void>((r) => { resolve = r; }));
    render(<LogoutButton />);
    const btn = screen.getByRole('button', { name: /déconnexion/i });
    fireEvent.click(btn);
    expect(btn).toBeDisabled();
    resolve();
    // On success the component calls router.push('/login') without re-enabling —
    // the navigation redirect is the observable side-effect.
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'));
  });
});
